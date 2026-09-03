import { describe, expect, it } from "vitest";
import {
	aggregateReports,
	evaluateSlo,
	profileHash,
	shardAllocation,
	validateProfile,
} from "../../../../scripts/capacity/lib.mjs";

const profile = {
	schemaVersion: 1,
	name: "test-v1",
	totalConnections: 5,
	generators: 2,
	gateways: 2,
	partitions: 2,
	topicsPerPartition: 1,
	fanoutEventsPerGateway: 1,
	payloadBytes: 10,
	reconnectPercent: 0,
	slo: {
		connectP95Ms: 5,
		fanoutP95Ms: 5,
		maxAdmissionErrorRate: 0,
		minFanoutDeliveryRatio: 1,
		maxHeapBytesPerConnection: 100,
	},
};

describe("capacity report aggregation", () => {
	it("allocates totals without losing remainder", () => {
		expect(shardAllocation(5, 0, 2)).toBe(3);
		expect(shardAllocation(5, 1, 2)).toBe(2);
	});

	it("rejects incomplete distributed reports", () => {
		validateProfile(profile);
		expect(() => aggregateReports([], profile)).toThrow(
			"expected 2 shard reports",
		);
	});

	it("aggregates shards and enforces every SLO", () => {
		const makeReport = (shardIndex: number, connections: number) => ({
			schemaVersion: 1,
			profile: profile.name,
			profileHash: profileHash(profile),
			shardIndex,
			shardCount: 2,
			metrics: {
				admittedConnections: connections,
				admissionErrors: 0,
				reconnectAttempts: 0,
				reconnectSuccesses: 0,
				fanoutDeliveries: connections,
				expectedDeliveries: connections,
				heapBytes: connections * 50,
			},
			samples: { connectMs: [1, 2], fanoutMs: [1] },
		});
		const summary = aggregateReports(
			[makeReport(0, 3), makeReport(1, 2)],
			profile,
		);
		expect(summary.metrics.admittedConnections).toBe(5);
		expect(evaluateSlo(summary, profile).pass).toBe(true);
	});
});
