import type { ZunoStateEvent } from "../sync";

export type ZunoServerBusMessage = {
	source: string;
	event: ZunoStateEvent;
};

/** Shared live-event fan-out contract (Redis, NATS, etc. can implement this). */
export interface ZunoServerEventBus {
	publish(message: ZunoServerBusMessage): void;
	subscribe(listener: (message: ZunoServerBusMessage) => void): () => void;
}

/** In-process reference bus used by tests and multi-instance development. */
export class MemoryZunoServerEventBus implements ZunoServerEventBus {
	private readonly listeners = new Set<
		(message: ZunoServerBusMessage) => void
	>();

	publish(message: ZunoServerBusMessage): void {
		for (const listener of this.listeners) listener(structuredClone(message));
	}

	subscribe(listener: (message: ZunoServerBusMessage) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

export const createMemoryZunoServerEventBus = () =>
	new MemoryZunoServerEventBus();
