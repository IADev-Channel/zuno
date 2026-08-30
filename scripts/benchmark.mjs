import { performance } from "node:perf_hooks";
import { createZunoServerState } from "../packages/zuno/dist/server/index.js";

const clients = 100;
const operationsPerClient = 100;
const totalOperations = clients * operationsPerClient;
const server = createZunoServerState({ maxEvents: totalOperations });
const started = performance.now();

for (let client = 0; client < clients; client++) {
	for (let operation = 0; operation < operationsPerClient; operation++) {
		const result = server.compareAndSet({
			storeKey: `client-${client}`,
			state: operation + 1,
			baseVersion: operation,
			origin: `benchmark-${client}`,
		});
		if (!result.ok) throw new Error("Unexpected isolated-workload conflict");
	}
}

const elapsedMs = performance.now() - started;
let accepted = 0;
let conflicts = 0;
for (let client = 0; client < clients; client++) {
	const result = server.compareAndSet({
		storeKey: "contended",
		state: client,
		baseVersion: 0,
		origin: `contender-${client}`,
	});
	if (result.ok) accepted++;
	else conflicts++;
}

console.log(
	JSON.stringify(
		{
			clients,
			operationsPerClient,
			totalOperations,
			elapsedMs: Number(elapsedMs.toFixed(2)),
			operationsPerSecond: Math.round(totalOperations / (elapsedMs / 1000)),
			contention: { accepted, conflicts },
		},
		null,
		2,
	),
);
