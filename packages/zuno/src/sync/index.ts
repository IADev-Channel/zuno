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
    };

    es.onerror = () => {
      es?.close();
      opts.onClose?.();
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      retryCount++;
      setTimeout(connect, delay);
    };
  }

  connect();

  return {
    dispatch: async (event) => {
      try {
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

        return { ok: true, status: 200, json: await res.json() };
      } catch (err) {
        return { ok: false, status: 500, json: err, reason: "NETWORK_ERROR" };
      }
    },
    unsubscribe: () => {
      es?.close();
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
