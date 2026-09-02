import { describe, expect, it, vi } from "vitest";
import {
	applyStateEvent,
	createMemoryZunoGatewayDirectory,
	createMemoryZunoServerEventBus,
	createZunoConnectionGateway,
	createZunoServerState,
	type ZunoGatewayMessage,
} from "../server";

const principal = (id: string, partition = "tenant-a") => ({
	id,
	partitions: [partition],
	topics: ["cart"],
});

const connection = (
	id: string,
	send: (message: ZunoGatewayMessage) => boolean = () => true,
	partition = "tenant-a",
) => ({
	metadata: {
		connectionId: id,
		principal: principal(id, partition),
		protocolVersion: 1,
		region: "eu-west",
	},
	partition,
	topics: new Set(["cart"]),
	send,
	close: vi.fn(),
});

describe("milestone 11 connection gateway", () => {
	it("enforces gateway and per-principal admission limits", () => {
		const server = createZunoServerState();
		const gateway = createZunoConnectionGateway(server, {
			maxConnections: 2,
			maxConnectionsPerPrincipal: 1,
		});
		const first = connection("first");
		first.metadata.principal = principal("alice");
		expect(gateway.connect(first).ok).toBe(true);
		const duplicatePrincipal = connection("second");
		duplicatePrincipal.metadata.principal = principal("alice");
		expect(gateway.connect(duplicatePrincipal)).toMatchObject({
			ok: false,
			reason: "PRINCIPAL_CONNECTION_LIMIT_EXCEEDED",
		});
		expect(gateway.connect(connection("bob")).ok).toBe(true);
		expect(gateway.connect(connection("carol"))).toMatchObject({
			ok: false,
			reason: "GATEWAY_CAPACITY_EXCEEDED",
		});
		gateway.stop();
	});

	it("routes shared-bus traffic only to gateways with matching partitions and topics", () => {
		const bus = createMemoryZunoServerEventBus();
		const firstServer = createZunoServerState({
			eventBus: bus,
			instanceId: "a",
		});
		const secondServer = createZunoServerState({
			eventBus: bus,
			instanceId: "b",
		});
		const firstGateway = createZunoConnectionGateway(firstServer);
		const secondGateway = createZunoConnectionGateway(secondServer);
		const firstSend = vi.fn(() => true);
		const secondSend = vi.fn(() => true);
		firstGateway.connect(connection("first", firstSend, "tenant-a"));
		secondGateway.connect(connection("second", secondSend, "tenant-b"));

		bus.publish({
			source: "writer",
			event: { storeKey: "tenant-a:cart:1", state: 1 },
		});
		expect(firstSend).toHaveBeenCalledOnce();
		expect(secondSend).not.toHaveBeenCalled();
		firstGateway.stop();
		secondGateway.stop();
		firstServer.dispose();
		secondServer.dispose();
	});

	it("evicts slow consumers with a typed resync control event", () => {
		const server = createZunoServerState();
		const gateway = createZunoConnectionGateway(server, {
			maxPendingMessages: 1,
		});
		const sent: ZunoGatewayMessage[] = [];
		const client = connection("slow", (message) => {
			sent.push(message);
			return message.type === "control";
		});
		gateway.connect(client);
		for (let index = 0; index < 3; index++)
			applyStateEvent(
				{ storeKey: `tenant-a:cart:${index}`, state: index },
				server,
			);
		expect(sent.at(-1)).toEqual({
			type: "control",
			event: { type: "RESYNC_REQUIRED", reason: "SLOW_CONSUMER" },
		});
		expect(client.close).toHaveBeenCalledOnce();
		expect(gateway.connectionCount).toBe(0);
		gateway.stop();
	});

	it("drains gracefully and rejects reconnect admission", () => {
		const server = createZunoServerState();
		const gateway = createZunoConnectionGateway(server);
		const sent: ZunoGatewayMessage[] = [];
		gateway.connect(
			connection("existing", (message) => {
				sent.push(message);
				return true;
			}),
		);
		gateway.drain();
		expect(gateway.status).toBe("draining");
		expect(sent.at(-1)).toMatchObject({
			type: "control",
			event: { reason: "GATEWAY_DRAINING" },
		});
		expect(gateway.connect(connection("new"))).toMatchObject({
			ok: false,
			reason: "GATEWAY_DRAINING",
		});
		gateway.stop();
	});

	it("registers healthy gateways by matching region and subscription", () => {
		const server = createZunoServerState();
		const gateway = createZunoConnectionGateway(server, { region: "eu-west" });
		gateway.connect(connection("regional"));
		const directory = createMemoryZunoGatewayDirectory();
		const unregister = directory.register(gateway);
		expect(directory.matching("tenant-a", "cart", "eu-west")).toEqual([
			gateway,
		]);
		expect(directory.matching("tenant-a", "cart", "us-east")).toEqual([]);
		unregister();
		expect(directory.health()).toEqual([]);
		gateway.stop();
	});

	it("uses the configured heartbeat interval", async () => {
		vi.useFakeTimers();
		try {
			const server = createZunoServerState();
			const gateway = createZunoConnectionGateway(server, {
				heartbeatIntervalMs: 100,
			});
			const sent = vi.fn(() => true);
			gateway.connect(connection("heartbeat", sent));
			await vi.advanceTimersByTimeAsync(100);
			expect(sent).toHaveBeenCalledWith({
				type: "heartbeat",
				timestamp: expect.any(Number),
			});
			gateway.stop();
		} finally {
			vi.useRealTimers();
		}
	});

	it("does not change authoritative conflict semantics when gateways scale out", () => {
		const server = createZunoServerState();
		const gateways = [
			createZunoConnectionGateway(server),
			createZunoConnectionGateway(server),
		];
		for (const [index, gateway] of gateways.entries())
			gateway.connect(connection(`client-${index}`));
		expect(
			applyStateEvent(
				{ storeKey: "tenant-a:cart:1", state: 1, baseVersion: 0 },
				server,
			),
		).toMatchObject({ ok: true });
		expect(
			applyStateEvent(
				{ storeKey: "tenant-a:cart:1", state: 2, baseVersion: 0 },
				server,
			),
		).toMatchObject({ ok: false, reason: "VERSION_CONFLICT" });
		for (const gateway of gateways) gateway.stop();
	});
});
