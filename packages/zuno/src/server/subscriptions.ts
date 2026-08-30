import type {
	ZunoPartitionKey,
	ZunoSubscription,
	ZunoSubscriptionId,
	ZunoTopic,
} from "../sync/subscriptions";

export type ZunoSubscriptionListener = (subscription: ZunoSubscription) => void;

const indexKey = (partition: ZunoPartitionKey, topic: ZunoTopic) =>
	`${partition}\u0000${topic}`;

/** Indexed registry so delivery work follows matching recipients, not all clients. */
export class ZunoSubscriptionRegistry {
	private readonly subscriptions = new Map<ZunoSubscriptionId, ZunoSubscription>();
	private readonly listeners = new Map<ZunoSubscriptionId, ZunoSubscriptionListener>();
	private readonly index = new Map<string, Set<ZunoSubscriptionId>>();

	subscribe(subscription: ZunoSubscription, listener: ZunoSubscriptionListener): () => void {
		this.unsubscribe(subscription.id);
		this.subscriptions.set(subscription.id, subscription);
		this.listeners.set(subscription.id, listener);
		const key = indexKey(subscription.partition, subscription.topic);
		let ids = this.index.get(key);
		if (!ids) {
			ids = new Set();
			this.index.set(key, ids);
		}
		ids.add(subscription.id);
		return () => this.unsubscribe(subscription.id);
	}

	unsubscribe(id: ZunoSubscriptionId): boolean {
		const subscription = this.subscriptions.get(id);
		if (!subscription) return false;
		this.subscriptions.delete(id);
		this.listeners.delete(id);
		const key = indexKey(subscription.partition, subscription.topic);
		const ids = this.index.get(key);
		ids?.delete(id);
		if (ids?.size === 0) this.index.delete(key);
		return true;
	}

	replace(currentIds: Iterable<ZunoSubscriptionId>, next: readonly ZunoSubscription[], listener: ZunoSubscriptionListener): () => void {
		for (const id of currentIds) this.unsubscribe(id);
		for (const subscription of next) this.subscribe(subscription, listener);
		return () => {
			for (const subscription of next) this.unsubscribe(subscription.id);
		};
	}

	matching(partition: ZunoPartitionKey, topic: ZunoTopic): ZunoSubscription[] {
		const ids = this.index.get(indexKey(partition, topic));
		if (!ids) return [];
		const result: ZunoSubscription[] = [];
		for (const id of ids) {
			const subscription = this.subscriptions.get(id);
			if (subscription) result.push(subscription);
		}
		return result;
	}

	publish(partition: ZunoPartitionKey, topic: ZunoTopic): number {
		const matches = this.matching(partition, topic);
		for (const subscription of matches) this.listeners.get(subscription.id)?.(subscription);
		return matches.length;
	}

	get size(): number {
		return this.subscriptions.size;
	}

	clear(): void {
		this.subscriptions.clear();
		this.listeners.clear();
		this.index.clear();
	}
}

export const createZunoSubscriptionRegistry = () => new ZunoSubscriptionRegistry();
