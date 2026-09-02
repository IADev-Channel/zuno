import type { ZunoStateEvent, ZunoSubscriptionPrincipal } from "../sync";
import type { ZunoServerState } from "./core";

export type ZunoGatewayStatus = "healthy" | "draining" | "stopped";
export type ZunoGatewayControlEvent = {
	type: "RESYNC_REQUIRED";
	reason: "SLOW_CONSUMER" | "GATEWAY_DRAINING";
};
export type ZunoGatewayMessage =
	| { type: "state"; event: ZunoStateEvent }
	| { type: "heartbeat"; timestamp: number }
	| { type: "control"; event: ZunoGatewayControlEvent };

export type ZunoGatewayConnectionMetadata = {
	connectionId: string;
	principal: ZunoSubscriptionPrincipal;
	protocolVersion: number;
	region?: string;
	remoteAddress?: string;
	userAgent?: string;
};

export type ZunoGatewayConnection = {
	metadata: ZunoGatewayConnectionMetadata;
	partition?: string;
	topics?: ReadonlySet<string>;
	send(message: ZunoGatewayMessage): boolean;
	close(): void;
};

export type ZunoConnectionAdmission =
	| { ok: true; connectionId: string; writable(): void; close(): void }
	| {
			ok: false;
			reason:
				| "GATEWAY_DRAINING"
				| "GATEWAY_CAPACITY_EXCEEDED"
				| "PRINCIPAL_CONNECTION_LIMIT_EXCEEDED";
			retryAfterMs: number;
	  };

export type CreateZunoConnectionGatewayOptions = {
	id?: string;
	region?: string;
	heartbeatIntervalMs?: number;
	healthTimeoutMs?: number;
	maxConnections?: number;
	maxConnectionsPerPrincipal?: number;
	maxPendingMessages?: number;
	now?: () => number;
};

type ActiveConnection = {
	connection: ZunoGatewayConnection;
	unsubscribe: () => void;
	pending: ZunoGatewayMessage[];
	backpressured: boolean;
};

export interface ZunoConnectionGateway {
	readonly id: string;
	readonly region?: string;
	readonly status: ZunoGatewayStatus;
	readonly connectionCount: number;
	connect(connection: ZunoGatewayConnection): ZunoConnectionAdmission;
	hasSubscribers(partition: string, topic: string): boolean;
	drain(): void;
	stop(): void;
	heartbeat(): void;
	health(): {
		id: string;
		region?: string;
		status: ZunoGatewayStatus;
		connections: number;
		lastHeartbeatAt: number;
	};
}

export class DefaultZunoConnectionGateway implements ZunoConnectionGateway {
	readonly id: string;
	readonly region?: string;
	private state: ZunoGatewayStatus = "healthy";
	private readonly connections = new Map<string, ActiveConnection>();
	private readonly principalConnections = new Map<string, number>();
	private readonly heartbeatIntervalMs: number;
	private readonly healthTimeoutMs: number;
	private readonly maxConnections: number;
	private readonly maxConnectionsPerPrincipal: number;
	private readonly maxPendingMessages: number;
	private readonly now: () => number;
	private lastHeartbeat: number;
	private heartbeatTimer: ReturnType<typeof setInterval>;

	constructor(
		private readonly server: ZunoServerState,
		options: CreateZunoConnectionGatewayOptions = {},
	) {
		this.id = options.id ?? crypto.randomUUID();
		this.region = options.region;
		this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15_000;
		this.healthTimeoutMs = options.healthTimeoutMs ?? 45_000;
		this.maxConnections = options.maxConnections ?? 10_000;
		this.maxConnectionsPerPrincipal = options.maxConnectionsPerPrincipal ?? 10;
		this.maxPendingMessages =
			options.maxPendingMessages ?? server.maxSubscriberBuffer;
		this.now = options.now ?? Date.now;
		for (const [name, value] of [
			["heartbeatIntervalMs", this.heartbeatIntervalMs],
			["healthTimeoutMs", this.healthTimeoutMs],
			["maxConnections", this.maxConnections],
			["maxConnectionsPerPrincipal", this.maxConnectionsPerPrincipal],
			["maxPendingMessages", this.maxPendingMessages],
		] as const) {
			if (!Number.isInteger(value) || value < 1)
				throw new TypeError(`${name} must be a positive integer`);
		}
		this.lastHeartbeat = this.now();
		this.heartbeatTimer = setInterval(
			() => this.heartbeat(),
			this.heartbeatIntervalMs,
		);
		this.heartbeatTimer.unref?.();
	}

	get status() {
		return this.state;
	}
	get connectionCount() {
		return this.connections.size;
	}

	hasSubscribers(partition: string, topic: string): boolean {
		for (const { connection } of this.connections.values()) {
			if (!connection.partition && !connection.topics) return true;
			if (connection.partition === partition && connection.topics?.has(topic))
				return true;
		}
		return false;
	}

	connect(connection: ZunoGatewayConnection): ZunoConnectionAdmission {
		if (this.state !== "healthy")
			return { ok: false, reason: "GATEWAY_DRAINING", retryAfterMs: 1_000 };
		if (this.connections.size >= this.maxConnections)
			return {
				ok: false,
				reason: "GATEWAY_CAPACITY_EXCEEDED",
				retryAfterMs: this.heartbeatIntervalMs,
			};
		const principalId = connection.metadata.principal.id;
		if (
			(this.principalConnections.get(principalId) ?? 0) >=
			this.maxConnectionsPerPrincipal
		)
			return {
				ok: false,
				reason: "PRINCIPAL_CONNECTION_LIMIT_EXCEEDED",
				retryAfterMs: this.heartbeatIntervalMs,
			};
		if (this.connections.has(connection.metadata.connectionId))
			this.closeConnection(connection.metadata.connectionId);

		const active: ActiveConnection = {
			connection,
			pending: [],
			backpressured: false,
			unsubscribe: () => {},
		};
		const listener = (event: ZunoStateEvent) =>
			this.deliver(active, { type: "state", event });
		active.unsubscribe =
			connection.partition && connection.topics
				? this.server.subscribeToScopedStateEvents(
						connection.partition,
						connection.topics,
						listener,
					)
				: this.server.subscribeToStateEvents(listener);
		this.connections.set(connection.metadata.connectionId, active);
		this.principalConnections.set(
			principalId,
			(this.principalConnections.get(principalId) ?? 0) + 1,
		);
		return {
			ok: true,
			connectionId: connection.metadata.connectionId,
			writable: () => this.flush(connection.metadata.connectionId),
			close: () => this.closeConnection(connection.metadata.connectionId),
		};
	}

	heartbeat(): void {
		this.lastHeartbeat = this.now();
		for (const active of this.connections.values())
			this.deliver(active, {
				type: "heartbeat",
				timestamp: this.lastHeartbeat,
			});
	}

	health() {
		const stale = this.now() - this.lastHeartbeat > this.healthTimeoutMs;
		return {
			id: this.id,
			region: this.region,
			status:
				stale && this.state === "healthy" ? ("stopped" as const) : this.state,
			connections: this.connections.size,
			lastHeartbeatAt: this.lastHeartbeat,
		};
	}

	drain(): void {
		if (this.state !== "healthy") return;
		this.state = "draining";
		for (const active of [...this.connections.values()]) {
			active.connection.send({
				type: "control",
				event: { type: "RESYNC_REQUIRED", reason: "GATEWAY_DRAINING" },
			});
			this.closeConnection(active.connection.metadata.connectionId);
		}
	}

	stop(): void {
		if (this.state === "stopped") return;
		this.state = "stopped";
		clearInterval(this.heartbeatTimer);
		for (const id of [...this.connections.keys()]) this.closeConnection(id);
	}

	private deliver(active: ActiveConnection, message: ZunoGatewayMessage): void {
		if (active.backpressured) {
			if (active.pending.length >= this.maxPendingMessages) {
				active.connection.send({
					type: "control",
					event: { type: "RESYNC_REQUIRED", reason: "SLOW_CONSUMER" },
				});
				this.closeConnection(active.connection.metadata.connectionId);
				return;
			}
			active.pending.push(message);
			return;
		}
		active.backpressured = !active.connection.send(message);
	}

	private flush(connectionId: string): void {
		const active = this.connections.get(connectionId);
		if (!active) return;
		active.backpressured = false;
		while (!active.backpressured && active.pending.length > 0) {
			const message = active.pending.shift();
			if (message) active.backpressured = !active.connection.send(message);
		}
	}

	private closeConnection(connectionId: string): void {
		const active = this.connections.get(connectionId);
		if (!active) return;
		this.connections.delete(connectionId);
		active.unsubscribe();
		const principalId = active.connection.metadata.principal.id;
		const count = (this.principalConnections.get(principalId) ?? 1) - 1;
		if (count === 0) this.principalConnections.delete(principalId);
		else this.principalConnections.set(principalId, count);
		active.connection.close();
	}
}

export const createZunoConnectionGateway = (
	server: ZunoServerState,
	options: CreateZunoConnectionGatewayOptions = {},
) => new DefaultZunoConnectionGateway(server, options);

/** Service-discovery reference implementation; production registries may use Redis or etcd. */
export class MemoryZunoGatewayDirectory {
	private readonly gateways = new Map<string, ZunoConnectionGateway>();
	register(gateway: ZunoConnectionGateway): () => void {
		this.gateways.set(gateway.id, gateway);
		return () => this.gateways.delete(gateway.id);
	}
	matching(partition: string, topic: string, region?: string) {
		return [...this.gateways.values()].filter(
			(gateway) =>
				gateway.health().status === "healthy" &&
				(!region || gateway.region === region) &&
				gateway.hasSubscribers(partition, topic),
		);
	}
	health() {
		return [...this.gateways.values()].map((gateway) => gateway.health());
	}
}

export const createMemoryZunoGatewayDirectory = () =>
	new MemoryZunoGatewayDirectory();
