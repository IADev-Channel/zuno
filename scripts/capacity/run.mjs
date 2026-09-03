import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import {
	createZunoConnectionGateway,
	createZunoServerState,
} from "../../packages/zuno/dist/server/index.js";
import { profileHash, shardAllocation, validateProfile } from "./lib.mjs";

const argument = (name, fallback) => {
	const index = process.argv.indexOf(`--${name}`);
	return index === -1 ? fallback : process.argv[index + 1];
};
const profilePath = argument("profile");
if (!profilePath) throw new Error("--profile is required");
const profile = validateProfile(
	JSON.parse(await readFile(profilePath, "utf8")),
);
const shardIndex = Number(argument("shard-index", "0"));
const shardCount = Number(argument("shard-count", String(profile.generators)));
if (shardCount !== profile.generators)
	throw new Error("--shard-count must equal profile.generators");
const connectionTarget = shardAllocation(
	profile.totalConnections,
	shardIndex,
	shardCount,
);
const gatewayCount = shardAllocation(profile.gateways, shardIndex, shardCount);
const maxSamples = 10_000;
const sampleEvery = Math.max(1, Math.floor(connectionTarget / maxSamples));
const connectSamples = [];
const fanoutSamples = [];
let admissionErrors = 0;
let admittedConnections = 0;
let fanoutDeliveries = 0;
let expectedDeliveries = 0;
let reconnectAttempts = 0;
let reconnectSuccesses = 0;
const heapBefore = process.memoryUsage().heapUsed;
const runtimes = [];

for (let gatewayIndex = 0; gatewayIndex < gatewayCount; gatewayIndex++) {
	const connections = shardAllocation(
		connectionTarget,
		gatewayIndex,
		gatewayCount,
	);
	const server = createZunoServerState({
		maxEvents: profile.fanoutEventsPerGateway + 1,
	});
	const gateway = createZunoConnectionGateway(server, {
		id: `shard-${shardIndex}-gateway-${gatewayIndex}`,
		maxConnections: connections + 1,
		maxConnectionsPerPrincipal: 1,
		heartbeatIntervalMs: 3_600_000,
		onMetric(metric) {
			if (metric.name === "zuno.gateway.fanout_deliveries")
				fanoutDeliveries += metric.value;
		},
	});
	const admissions = [];
	const subscriptions = new Map();
	for (let index = 0; index < connections; index++) {
		const globalIndex =
			shardIndex + shardCount * (gatewayIndex + gatewayCount * index);
		const partition = `p-${globalIndex % profile.partitions}`;
		const topic = `t-${globalIndex % profile.topicsPerPartition}`;
		const subscriptionKey = `${partition}\u0000${topic}`;
		subscriptions.set(
			subscriptionKey,
			(subscriptions.get(subscriptionKey) ?? 0) + 1,
		);
		const started = performance.now();
		const admission = gateway.connect({
			metadata: {
				connectionId: `c-${shardIndex}-${gatewayIndex}-${index}`,
				principal: {
					id: `principal-${shardIndex}-${gatewayIndex}-${index}`,
					partitions: [partition],
					topics: [topic],
				},
				protocolVersion: 1,
			},
			partition,
			topics: new Set([topic]),
			send: () => true,
			close: () => {},
		});
		if (index % sampleEvery === 0)
			connectSamples.push(performance.now() - started);
		if (admission.ok) {
			admittedConnections++;
			admissions.push({ admission, partition, topic });
		} else admissionErrors++;
	}
	runtimes.push({ server, gateway, admissions, subscriptions, gatewayIndex });
}

const reconnectCount = Math.floor(
	(connectionTarget * profile.reconnectPercent) / 100,
);
let remainingReconnects = reconnectCount;
for (const runtime of runtimes) {
	const count = Math.min(remainingReconnects, runtime.admissions.length);
	for (let index = 0; index < count; index++) {
		const previous = runtime.admissions[index];
		previous.admission.close();
		reconnectAttempts++;
		const reconnect = runtime.gateway.connect({
			metadata: {
				connectionId: `reconnect-${shardIndex}-${runtime.gatewayIndex}-${index}`,
				principal: {
					id: `reconnect-principal-${shardIndex}-${runtime.gatewayIndex}-${index}`,
					partitions: [previous.partition],
					topics: [previous.topic],
				},
				protocolVersion: 0,
			},
			partition: previous.partition,
			topics: new Set([previous.topic]),
			send: () => true,
			close: () => {},
		});
		if (reconnect.ok) reconnectSuccesses++;
		else admissionErrors++;
	}
	remainingReconnects -= count;
}

const payload = "x".repeat(profile.payloadBytes);
for (const runtime of runtimes) {
	const keys = [...runtime.subscriptions.keys()];
	for (let index = 0; index < profile.fanoutEventsPerGateway; index++) {
		const key = keys[index % keys.length];
		const [partition, topic] = key.split("\u0000");
		expectedDeliveries += runtime.subscriptions.get(key) ?? 0;
		const started = performance.now();
		const result = runtime.server.compareAndSet({
			storeKey: `${partition}:${topic}:load-${index}`,
			state: { payload, sequence: index },
			baseVersion: 0,
			origin: `load-${shardIndex}`,
		});
		if (!result.ok) throw new Error("unexpected load-test conflict");
		runtime.server.publishToStateEvent(result.event);
		fanoutSamples.push(performance.now() - started);
	}
}

const heapBytes = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
const report = {
	schemaVersion: 1,
	profile: profile.name,
	profileHash: profileHash(profile),
	shardIndex,
	shardCount,
	metrics: {
		admittedConnections,
		admissionErrors,
		reconnectAttempts,
		reconnectSuccesses,
		fanoutDeliveries,
		expectedDeliveries,
		heapBytes,
	},
	samples: { connectMs: connectSamples, fanoutMs: fanoutSamples },
	runtime: {
		node: process.version,
		platform: process.platform,
		architecture: process.arch,
	},
};
for (const runtime of runtimes) runtime.gateway.stop();
const output = argument("output");
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
else console.log(JSON.stringify(report, null, 2));
