export const ZUNO_PROTOCOL_VERSION = 1 as const;
export const ZUNO_LEGACY_PROTOCOL_VERSION = 0 as const;
export type ZunoProtocolVersion =
	| typeof ZUNO_LEGACY_PROTOCOL_VERSION
	| typeof ZUNO_PROTOCOL_VERSION;

export type ZunoTopic = string & { readonly __zunoTopic: unique symbol };
export type ZunoPartitionKey = string & {
	readonly __zunoPartitionKey: unique symbol;
};
export type ZunoSubscriptionId = string & {
	readonly __zunoSubscriptionId: unique symbol;
};

export type ZunoSubscription = {
	id: ZunoSubscriptionId;
	partition: ZunoPartitionKey;
	topic: ZunoTopic;
};

export type ZunoSubscriptionOperation =
	| { type: "subscribe"; subscriptions: readonly ZunoSubscription[] }
	| { type: "unsubscribe"; subscriptionIds: readonly ZunoSubscriptionId[] }
	| {
			type: "replace-subscriptions";
			subscriptions: readonly ZunoSubscription[];
	  };

export type ZunoSubscriptionTransportStatus = {
	ok: boolean;
	reason?: string;
};

export interface ZunoSubscriptionTransport {
	subscribe(
		subscriptions: readonly ZunoSubscription[],
	): Promise<ZunoSubscriptionTransportStatus>;
	unsubscribeSubscriptions(
		subscriptionIds: readonly ZunoSubscriptionId[],
	): Promise<ZunoSubscriptionTransportStatus>;
	replaceSubscriptions(
		subscriptions: readonly ZunoSubscription[],
	): Promise<ZunoSubscriptionTransportStatus>;
}

export type ZunoSubscriptionPrincipal = {
	id: string;
	partitions: readonly string[];
	topics: readonly string[];
};

export type ZunoSubscriptionPolicy = {
	maxSubscriptionsPerConnection?: number;
	maxTopicsPerPrincipal?: number;
	authorize?: (
		principal: ZunoSubscriptionPrincipal,
		subscription: ZunoSubscription,
	) => boolean;
};

export type ZunoProtocolNegotiation = {
	version: ZunoProtocolVersion;
	subscriptions: boolean;
};

const nonEmpty = (value: string, name: string): string => {
	const normalized = value.trim();
	if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
	return normalized;
};

export const zunoTopic = (value: string) =>
	nonEmpty(value, "topic") as ZunoTopic;
export const zunoPartitionKey = (value: string) =>
	nonEmpty(value, "partition") as ZunoPartitionKey;
export const zunoSubscriptionId = (value: string) =>
	nonEmpty(value, "subscription id") as ZunoSubscriptionId;

export const createZunoSubscription = (input: {
	id: string;
	partition: string;
	topic: string;
}): ZunoSubscription => ({
	id: zunoSubscriptionId(input.id),
	partition: zunoPartitionKey(input.partition),
	topic: zunoTopic(input.topic),
});

export const negotiateZunoProtocol = (
	requested?: number,
): ZunoProtocolNegotiation => {
	if (requested === ZUNO_PROTOCOL_VERSION) {
		return { version: ZUNO_PROTOCOL_VERSION, subscriptions: true };
	}
	return { version: ZUNO_LEGACY_PROTOCOL_VERSION, subscriptions: false };
};

export const validateSubscriptions = (
	subscriptions: readonly ZunoSubscription[],
	principal: ZunoSubscriptionPrincipal,
	policy: ZunoSubscriptionPolicy = {},
): ZunoSubscriptionTransportStatus => {
	const maxSubscriptions = policy.maxSubscriptionsPerConnection ?? 100;
	if (subscriptions.length > maxSubscriptions) {
		return { ok: false, reason: "SUBSCRIPTION_LIMIT_EXCEEDED" };
	}
	const topics = new Set(subscriptions.map((item) => item.topic));
	if (topics.size > (policy.maxTopicsPerPrincipal ?? 100)) {
		return { ok: false, reason: "TOPIC_LIMIT_EXCEEDED" };
	}
	for (const subscription of subscriptions) {
		if (!principal.partitions.includes(subscription.partition)) {
			return { ok: false, reason: "PARTITION_FORBIDDEN" };
		}
		if (!principal.topics.includes(subscription.topic)) {
			return { ok: false, reason: "TOPIC_FORBIDDEN" };
		}
		if (policy.authorize && !policy.authorize(principal, subscription)) {
			return { ok: false, reason: "SUBSCRIPTION_FORBIDDEN" };
		}
	}
	return { ok: true };
};

export const scopedStoreKey = (
	partition: ZunoPartitionKey,
	topic: ZunoTopic,
	storeKey: string,
) => `${partition}:${topic}:${nonEmpty(storeKey, "storeKey")}`;

export const parseScopedStoreKey = (storeKey: string) => {
	const [partition, topic, ...rest] = storeKey.split(":");
	if (
		!partition ||
		!topic ||
		rest.length === 0 ||
		rest.join(":").length === 0
	) {
		return undefined;
	}
	return {
		partition: zunoPartitionKey(partition),
		topic: zunoTopic(topic),
		storeKey: rest.join(":"),
	};
};
