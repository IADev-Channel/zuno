export type CapacitySlo = {
	connectP95Ms: number;
	fanoutP95Ms: number;
	maxAdmissionErrorRate: number;
	minFanoutDeliveryRatio: number;
	maxHeapBytesPerConnection: number;
};

export type CapacityProfile = {
	schemaVersion: number;
	name: string;
	workloadType?: string;
	totalConnections: number;
	generators: number;
	gateways: number;
	partitions: number;
	topicsPerPartition: number;
	fanoutEventsPerGateway: number;
	payloadBytes: number;
	reconnectPercent: number;
	slo: CapacitySlo;
};

export type CapacityShardReport = {
	schemaVersion: number;
	profile: string;
	profileHash: string;
	shardIndex: number;
	shardCount: number;
	metrics: {
		admittedConnections: number;
		admissionErrors: number;
		reconnectAttempts: number;
		reconnectSuccesses: number;
		fanoutDeliveries: number;
		expectedDeliveries: number;
		heapBytes: number;
	};
	samples: { connectMs: number[]; fanoutMs: number[] };
};

export type CapacitySummary = {
	schemaVersion: number;
	profile: string;
	profileHash: string;
	shards: number;
	metrics: CapacityShardReport["metrics"] & {
		connectP95Ms: number;
		fanoutP95Ms: number;
		admissionErrorRate: number;
		fanoutDeliveryRatio: number;
		heapBytesPerConnection: number;
	};
};

export function profileHash(profile: CapacityProfile): string;
export function validateProfile(profile: CapacityProfile): CapacityProfile;
export function shardAllocation(
	total: number,
	shardIndex: number,
	shardCount: number,
): number;
export function percentile(values: number[], percentileValue: number): number;
export function aggregateReports(
	reports: CapacityShardReport[],
	profile: CapacityProfile,
): CapacitySummary;
export function evaluateSlo(
	summary: CapacitySummary,
	profile: CapacityProfile,
): {
	pass: boolean;
	checks: Array<{
		name: string;
		actual: number;
		expected: number;
		pass: boolean;
	}>;
};
