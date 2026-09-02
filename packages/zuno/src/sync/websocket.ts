import type { ZunoMetric, ZunoStateEvent, ZunoTransport } from "./index";

export type ZunoWebSocketOptions = {
	url: string;
	syncUrl: string;
	clientId: string;
	onEvent: (event: ZunoStateEvent) => void;
	onSnapshot?: (
		snapshot: Record<string, { state: unknown; version: number }>,
		lastEventId: number,
	) => void;
	onMetric?: (metric: ZunoMetric) => void;
	onOpen?: () => void;
	onClose?: () => void;
	compressionThresholdBytes?: number;
	reconnectJitterRatio?: number;
	maxReconnectDelayMs?: number;
};

/** Optional WebSocket downstream with interoperable HTTP mutation upstream. */
export const startWebSocket = (opts: ZunoWebSocketOptions): ZunoTransport => {
	let socket: WebSocket | undefined;
	let stopped = false;
	let retry = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const jitter = opts.reconnectJitterRatio ?? 0.2;
	const maxDelay = opts.maxReconnectDelayMs ?? 30_000;
	const compressionThresholdBytes = opts.compressionThresholdBytes ?? 16 * 1024;
	if (
		!Number.isInteger(compressionThresholdBytes) ||
		compressionThresholdBytes < 0
	)
		throw new TypeError(
			"compressionThresholdBytes must be a non-negative integer",
		);
	const metric = (name: string, value: number, unit: ZunoMetric["unit"]) =>
		opts.onMetric?.({ name, value, unit, timestamp: Date.now() });
	const connect = () => {
		if (stopped) return;
		socket = new WebSocket(opts.url);
		socket.onopen = () => {
			retry = 0;
			metric("zuno.websocket.opened", 1, "count");
			opts.onOpen?.();
		};
		socket.onmessage = (message) => {
			const bytes =
				typeof message.data === "string"
					? new TextEncoder().encode(message.data).byteLength
					: ((message.data as Blob).size ?? 0);
			metric("zuno.transport.bytes_received", bytes, "bytes");
			const payload = JSON.parse(String(message.data));
			if (payload.type === "state") {
				const event = payload.event as ZunoStateEvent;
				if (event.origin === opts.clientId) return;
				opts.onEvent({ ...event, origin: "server" });
			} else if (payload.type === "snapshot")
				opts.onSnapshot?.(payload.state, payload.lastEventId);
			else if (
				payload.type === "control" &&
				payload.event?.type === "RESYNC_REQUIRED"
			)
				socket?.close();
		};
		socket.onclose = () => {
			if (!stopped) opts.onClose?.();
			if (stopped || timer) return;
			const base = Math.min(1000 * 2 ** retry++, maxDelay);
			const delay = Math.min(
				maxDelay,
				base + Math.round(Math.random() * base * jitter),
			);
			timer = setTimeout(() => {
				timer = undefined;
				connect();
			}, delay);
		};
	};
	const postMutation = async (value: unknown) => {
		const json = JSON.stringify(value);
		const input = new TextEncoder().encode(json);
		let body: BodyInit = json;
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (
			input.byteLength >= compressionThresholdBytes &&
			typeof CompressionStream !== "undefined"
		) {
			const stream = new Blob([input])
				.stream()
				.pipeThrough(new CompressionStream("gzip"));
			body = await new Response(stream).arrayBuffer();
			headers["Content-Encoding"] = "gzip";
		}
		const bytes =
			typeof body === "string"
				? new TextEncoder().encode(body).byteLength
				: body instanceof ArrayBuffer
					? body.byteLength
					: input.byteLength;
		metric("zuno.transport.bytes_sent", bytes, "bytes");
		const response = await fetch(opts.syncUrl, {
			method: "POST",
			headers,
			body,
		});
		const jsonResponse = await response.json();
		return { ok: response.ok, status: response.status, json: jsonResponse };
	};
	connect();
	return {
		async dispatch(event) {
			return postMutation(event);
		},
		async dispatchBatch(events) {
			return postMutation({ events });
		},
		unsubscribe() {
			stopped = true;
			if (timer) clearTimeout(timer);
			socket?.close();
		},
	};
};
