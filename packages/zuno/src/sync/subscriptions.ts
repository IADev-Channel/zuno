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
	| { type: "replace-subscriptions"; subscriptions: readonly ZunoSubscription[] };

export type ZunoSubscriptionTransportStatus = {
	ok: boolean;
	reason?: string;
};

/** Optional Milestone 9 capability implemented by subscription-aware transports. */
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

const nonEmpty = (value: string, name: string): string => {
	const normalized = value.trim();
	if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
	return normalized;
};

export const zunoTopic = (value: string) => nonEmpty(value, "topic") as ZunoTopic;
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
