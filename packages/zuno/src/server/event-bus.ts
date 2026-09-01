import { parseScopedStoreKey, type ZunoStateEvent } from "../sync";

export type ZunoServerBusMessage = {
	source: string;
	event: ZunoStateEvent;
	partition: string;
	offset: number;
};

export type ZunoServerBusPublish = Omit<
	ZunoServerBusMessage,
	"partition" | "offset"
> & { partition?: string };
export type ZunoServerBusSubscription = {
	consumerId?: string;
	partitions?: ReadonlySet<string>;
};

/** Shared live-event fan-out contract (Redis, NATS, etc. can implement this). */
export interface ZunoServerEventBus {
	publish(message: ZunoServerBusPublish): ZunoServerBusMessage;
	subscribe(
		listener: (message: ZunoServerBusMessage) => void,
		options?: ZunoServerBusSubscription,
	): () => void;
	getConsumerOffset(consumerId: string, partition: string): number;
	commitConsumerOffset(
		consumerId: string,
		partition: string,
		offset: number,
	): void;
}

/** In-process reference bus used by tests and multi-instance development. */
export class MemoryZunoServerEventBus implements ZunoServerEventBus {
	private readonly listeners = new Map<
		(message: ZunoServerBusMessage) => void,
		ZunoServerBusSubscription
	>();
	private readonly partitionOffsets = new Map<string, number>();
	private readonly consumerOffsets = new Map<string, number>();

	publish(message: ZunoServerBusPublish): ZunoServerBusMessage {
		const partition =
			message.partition ??
			parseScopedStoreKey(message.event.storeKey)?.partition ??
			"";
		const offset = (this.partitionOffsets.get(partition) ?? 0) + 1;
		this.partitionOffsets.set(partition, offset);
		const delivered = { ...message, partition, offset };
		for (const [listener, options] of this.listeners) {
			if (options.partitions && !options.partitions.has(partition)) continue;
			listener(structuredClone(delivered));
		}
		return structuredClone(delivered);
	}

	subscribe(
		listener: (message: ZunoServerBusMessage) => void,
		options: ZunoServerBusSubscription = {},
	): () => void {
		this.listeners.set(listener, options);
		return () => {
			this.listeners.delete(listener);
		};
	}

	getConsumerOffset(consumerId: string, partition: string): number {
		return this.consumerOffsets.get(`${consumerId}\u0000${partition}`) ?? 0;
	}

	commitConsumerOffset(
		consumerId: string,
		partition: string,
		offset: number,
	): void {
		const key = `${consumerId}\u0000${partition}`;
		this.consumerOffsets.set(
			key,
			Math.max(offset, this.consumerOffsets.get(key) ?? 0),
		);
	}
}

export const createMemoryZunoServerEventBus = () =>
	new MemoryZunoServerEventBus();
