import type { Universe } from "../core";

// --- Types ---

/**
 * Authoritative state event.
 */
export type ZunoStateEvent = {
  storeKey: string;
  state: any;
  version?: number;
  baseVersion?: number;
  origin?: string;
  ts?: number;
  eventId?: number;
};

/**
 * Generic transport status.
 */
export type TransportStatus = {
  ok: boolean;
  status: number;
  json: any;
  reason?: string;
};

/**
 * Client transport interface.
 */
export interface ZunoTransport {
  dispatch(event: ZunoStateEvent): Promise<TransportStatus>;
  unsubscribe?(): void;
}

/**
 * Apply incoming event to the universe and local bookkeeping.
 */
export function applyIncomingEvent(
  universe: Universe,
  event: ZunoStateEvent,
  context: {
    clientId: string;
    localState: Map<string, unknown>;
    versions: Map<string, number>;
  }
) {
  const { clientId, versions } = context;

  // 1. Loopback suppression
  if (event.origin === clientId) return;

  // 2. Version check (if provided by transport)
  if (typeof event.version === "number") {
    const current = versions.get(event.storeKey) ?? 0;
    if (event.version <= current) return; // Stale
    versions.set(event.storeKey, event.version);
  }

  // 3. Apply to universe
  universe.getStore(event.storeKey, () => event.state).set(event.state);
}

// --- SSE Client ---

export type SSEOptions = {
  universe: Universe;
  url: string;
  syncUrl: string;
  optimistic: boolean;
  clientId: string;
  versions: Map<string, number>;
  getLastEventId: () => number;
  onOpen?: () => void;
  onClose?: () => void;
};

export function startSSE(opts: SSEOptions): ZunoTransport {
  const { url, syncUrl, universe, clientId, versions, getLastEventId } = opts;
  let es: EventSource | null = null;
  let retryCount = 0;

  // --- Offline Support ---
  const queue: ZunoStateEvent[] = [];
  let isFlushing = false;

  async function flushQueue() {
    if (isFlushing || queue.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    isFlushing = true;

    // --- Coalesce / Deduplicate Logic ---
    // 1. Map index of first occurrence of each storeKey
    const keyIndex = new Map<string, number>();
    // 2. Reduced queue construction
    const reducedQueue: ZunoStateEvent[] = [];

    for (const event of queue) {
      if (keyIndex.has(event.storeKey)) {
        // We've seen this key before. We want to update the existing entry in reducedQueue.
        const idx = keyIndex.get(event.storeKey)!;
        const prev = reducedQueue[idx];
        // Merge: keep original baseVersion (from the start of the chain) but use NEW state.
        // Note: We also likely want to keep the original 'ts' if strictly ordering, 
        // but state is what matters.
        // The 'version' in the event is the *optimistic* version. 
        // We can keep the *latest* optimistic version (e.g. v10) in the event, 
        // but server will likely only verify baseVersion.
        reducedQueue[idx] = { ...event, baseVersion: prev.baseVersion };
      } else {
        keyIndex.set(event.storeKey, reducedQueue.length);
        reducedQueue.push(event);
      }
    }

    // Replace original queue with reduced one.
    // We modify 'queue' in place or reset it.
    // Since 'queue' is const binding to array, we can't reassign variable, 
    // but we can clear and push.
    queue.length = 0;
    queue.push(...reducedQueue);

    try {
      while (queue.length > 0) {
        const event = queue[0];
        try {
          const res = await fetch(syncUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event),
          });

          if (!res.ok && res.status !== 409) {
            // Keep in queue for retry if it's a transient server error?
            // For now we dequeue on non-network errors to avoid blocking.
            if (res.status >= 400 && res.status < 500) {
              queue.shift();
              continue;
            }
            // For 500, we might want to retry? Let's treat it as network-ish for now.
            // But to be safe and not block forever:
            queue.shift();
            continue;
          }

          if (res.status === 409) {
            const data = await res.json();
            if (data.current) {
              const { state, version } = data.current;
              versions.set(event.storeKey, version);
              universe.getStore(event.storeKey, () => state).set(state);
            }
            queue.shift();
          } else if (res.ok) {
            const json = await res.json();
            if (json.event && typeof json.event.version === "number") {
              versions.set(event.storeKey, json.event.version);
            }
            queue.shift();
          } else {
            queue.shift();
          }

        } catch (err) {
          console.error("[Zuno] Flush failed, retrying later", err);
          break; // Network error, stop flushing
        }
      }
    } finally {
      isFlushing = false;
    }
  }
  function connect() {
    const lastId = getLastEventId();
    const connectUrl = new URL(url, globalThis.location?.href);
    if (lastId > 0) connectUrl.searchParams.set("lastEventId", String(lastId));

    es = new EventSource(connectUrl.toString());

    es.addEventListener("snapshot", (e: any) => {
      try {
        const snap = JSON.parse(e.data);
        for (const [key, rec] of Object.entries(snap)) {
          const r = rec as { state: any; version: number };
          versions.set(key, Math.max(versions.get(key) ?? 0, r.version));
          universe.getStore(key, () => r.state).set(r.state);
        }
      } catch (err) {
        console.error("[Zuno] Failed to parse snapshot", err);
      }
    });

    es.addEventListener("state", (e: any) => {
      try {
        const event = JSON.parse(e.data) as ZunoStateEvent;
        if (event.origin === clientId) return;

        if (typeof event.version === "number") {
          const current = versions.get(event.storeKey) ?? 0;
          if (event.version <= current) return;
          versions.set(event.storeKey, event.version);
        }

        universe.getStore(event.storeKey, () => event.state).set(event.state);
      } catch (err) {
        console.error("[Zuno] Failed to parse SSE event", err);
      }
    });

    es.onopen = () => {
      retryCount = 0;
      opts.onOpen?.();
      flushQueue();
    };

    es.onerror = () => {
      es?.close();
      opts.onClose?.();
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      retryCount++;
      setTimeout(connect, delay);
    };
  }

  if (typeof window !== "undefined") {
    window.addEventListener("online", flushQueue);
  }

  connect();

  return {
    dispatch: async (event) => {
      try {
        if (opts.optimistic) {
          universe.getStore(event.storeKey, () => event.state).set(event.state);
        }

        // Check online status first
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          queue.push(event);
          // Optimistically increment version so next event uses correct baseVersion
          const currentV = versions.get(event.storeKey) ?? 0;
          versions.set(event.storeKey, currentV + 1);
          return { ok: false, status: 0, json: null, reason: "OFFLINE_QUEUED" };
        }

        const res = await fetch(syncUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });

        if (res.status === 409) {
          const data = await res.json();
          if (data.current) {
            const { state, version } = data.current;
            versions.set(event.storeKey, version);
            universe.getStore(event.storeKey, () => state).set(state);
          }
          return { ok: false, status: 409, json: data, reason: "CONFLICT" };
        }

        if (!res.ok) return { ok: false, status: res.status, json: await res.json() };

        const json = await res.json();
        if (json.event) {
          const { state, version } = json.event;
          if (typeof version === "number") {
            versions.set(event.storeKey, version);
          }
        }

        return { ok: true, status: 200, json };
      } catch (err) {
        // Network failure catch
        console.warn("[Zuno] Dispatch failed, queuing", err);
        queue.push(event);
        // Optimistically increment version here too, assuming the previous one is "pending"
        // and subsequent edits should build on top of it.
        const currentV = versions.get(event.storeKey) ?? 0;
        versions.set(event.storeKey, currentV + 1);

        setTimeout(flushQueue, 1000);
        return { ok: false, status: 500, json: err, reason: "NETWORK_ERROR_QUEUED" };
      }
    },
    unsubscribe: () => {
      es?.close();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", flushQueue);
      }
    },
  };
}

// --- BroadcastChannel ---

export type BCOptions = {
  channelName: string;
  clientId: string;
  onEvent: (event: ZunoStateEvent) => void;
  getSnapshot: () => Record<string, { state: unknown; version: number }>;
  onSnapshot: (snap: Record<string, { state: unknown; version: number }>) => void;
};

export function startBroadcastChannel(opts: BCOptions) {
  const { channelName, clientId, onEvent, getSnapshot, onSnapshot } = opts;
  const channel = new BroadcastChannel(channelName);

  channel.onmessage = (e) => {
    const msg = e.data;
    if (msg.origin === clientId) return;

    if (msg.type === "event") onEvent(msg.event);
    if (msg.type === "hello") channel.postMessage({ type: "snapshot", snapshot: getSnapshot(), origin: clientId });
    if (msg.type === "snapshot") onSnapshot(msg.snapshot);
  };

  return {
    publish: (event: ZunoStateEvent) => channel.postMessage({ type: "event", event, origin: clientId }),
    hello: () => channel.postMessage({ type: "hello", origin: clientId }),
    stop: () => channel.close(),
  };
}
