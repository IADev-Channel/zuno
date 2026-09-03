import { createHash } from "node:crypto";

export const profileHash = (profile) =>
	createHash("sha256").update(JSON.stringify(profile)).digest("hex");

const positiveInteger = (value, name) => {
	if (!Number.isInteger(value) || value < 1)
		throw new TypeError(`${name} must be a positive integer`);
};

export const validateProfile = (profile) => {
	if (profile.schemaVersion !== 1)
		throw new TypeError("profile.schemaVersion must be 1");
	for (const field of [
		"totalConnections",
		"generators",
		"gateways",
		"partitions",
		"topicsPerPartition",
		"fanoutEventsPerGateway",
		"payloadBytes",
	])
		positiveInteger(profile[field], `profile.${field}`);
	if (profile.gateways < profile.generators)
		throw new TypeError("profile.gateways must be at least profile.generators");
	if (
		typeof profile.reconnectPercent !== "number" ||
		profile.reconnectPercent < 0 ||
		profile.reconnectPercent > 100
	)
		throw new TypeError("profile.reconnectPercent must be between 0 and 100");
	for (const field of [
		"connectP95Ms",
		"fanoutP95Ms",
		"maxAdmissionErrorRate",
		"minFanoutDeliveryRatio",
		"maxHeapBytesPerConnection",
	]) {
		if (typeof profile.slo?.[field] !== "number" || profile.slo[field] < 0)
			throw new TypeError(`profile.slo.${field} must be a non-negative number`);
	}
	return profile;
};

export const shardAllocation = (total, shardIndex, shardCount) => {
	positiveInteger(total, "total");
	positiveInteger(shardCount, "shardCount");
	if (
		!Number.isInteger(shardIndex) ||
		shardIndex < 0 ||
		shardIndex >= shardCount
	)
		throw new TypeError("shardIndex must be within shardCount");
	return (
		Math.floor(total / shardCount) + (shardIndex < total % shardCount ? 1 : 0)
	);
};

export const percentile = (values, percentileValue) => {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.ceil((percentileValue / 100) * sorted.length) - 1];
};

export const aggregateReports = (reports, profile) => {
	validateProfile(profile);
	if (reports.length !== profile.generators)
		throw new Error(
			`expected ${profile.generators} shard reports, received ${reports.length}`,
		);
	const expectedHash = profileHash(profile);
	const indexes = new Set();
	for (const report of reports) {
		if (report.profileHash !== expectedHash)
			throw new Error("report profile hash does not match");
		if (report.shardCount !== profile.generators)
			throw new Error("report shard count does not match profile");
		if (indexes.has(report.shardIndex))
			throw new Error(`duplicate shard report ${report.shardIndex}`);
		indexes.add(report.shardIndex);
	}
	const sum = (field) =>
		reports.reduce((total, report) => total + report.metrics[field], 0);
	const connectSamples = reports.flatMap((report) => report.samples.connectMs);
	const fanoutSamples = reports.flatMap((report) => report.samples.fanoutMs);
	const admittedConnections = sum("admittedConnections");
	const admissionErrors = sum("admissionErrors");
	const expectedDeliveries = sum("expectedDeliveries");
	const fanoutDeliveries = sum("fanoutDeliveries");
	const heapBytes = sum("heapBytes");
	return {
		schemaVersion: 1,
		profile: profile.name,
		profileHash: expectedHash,
		shards: reports.length,
		metrics: {
			admittedConnections,
			admissionErrors,
			reconnectAttempts: sum("reconnectAttempts"),
			reconnectSuccesses: sum("reconnectSuccesses"),
			fanoutDeliveries,
			expectedDeliveries,
			connectP95Ms: percentile(connectSamples, 95),
			fanoutP95Ms: percentile(fanoutSamples, 95),
			admissionErrorRate:
				admittedConnections + admissionErrors === 0
					? 0
					: admissionErrors / (admittedConnections + admissionErrors),
			fanoutDeliveryRatio:
				expectedDeliveries === 0 ? 1 : fanoutDeliveries / expectedDeliveries,
			heapBytes,
			heapBytesPerConnection:
				admittedConnections === 0 ? 0 : heapBytes / admittedConnections,
		},
	};
};

export const evaluateSlo = (summary, profile) => {
	const { metrics } = summary;
	const checks = [
		{
			name: "connections",
			actual: metrics.admittedConnections,
			expected: profile.totalConnections,
			pass: metrics.admittedConnections === profile.totalConnections,
		},
		{
			name: "connect_p95_ms",
			actual: metrics.connectP95Ms,
			expected: profile.slo.connectP95Ms,
			pass: metrics.connectP95Ms <= profile.slo.connectP95Ms,
		},
		{
			name: "fanout_p95_ms",
			actual: metrics.fanoutP95Ms,
			expected: profile.slo.fanoutP95Ms,
			pass: metrics.fanoutP95Ms <= profile.slo.fanoutP95Ms,
		},
		{
			name: "admission_error_rate",
			actual: metrics.admissionErrorRate,
			expected: profile.slo.maxAdmissionErrorRate,
			pass: metrics.admissionErrorRate <= profile.slo.maxAdmissionErrorRate,
		},
		{
			name: "reconnect_successes",
			actual: metrics.reconnectSuccesses,
			expected: metrics.reconnectAttempts,
			pass: metrics.reconnectSuccesses === metrics.reconnectAttempts,
		},
		{
			name: "fanout_delivery_ratio",
			actual: metrics.fanoutDeliveryRatio,
			expected: profile.slo.minFanoutDeliveryRatio,
			pass: metrics.fanoutDeliveryRatio >= profile.slo.minFanoutDeliveryRatio,
		},
		{
			name: "heap_bytes_per_connection",
			actual: metrics.heapBytesPerConnection,
			expected: profile.slo.maxHeapBytesPerConnection,
			pass:
				profile.slo.maxHeapBytesPerConnection === 0 ||
				metrics.heapBytesPerConnection <= profile.slo.maxHeapBytesPerConnection,
		},
	];
	return { pass: checks.every((check) => check.pass), checks };
};
