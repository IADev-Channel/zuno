import { describe, expect, it, vi } from "vitest";
import {
	createZunoSubscription,
	negotiateZunoProtocol,
	parseScopedStoreKey,
	scopedStoreKey,
	validateSubscriptions,
	zunoPartitionKey,
	zunoTopic,
} from "../sync";
import { authorizeStateEvent } from "../server/apply-state-event";
import { createZunoServerState } from "../server/core";
import { createZunoSubscriptionRegistry } from "../server/subscriptions";

describe("milestone 9 subscription protocol", () => {
	const principal = { id: "alice", partitions: ["tenant-a"], topics: ["cart", "presence"] };
	it("creates and parses scoped store keys", () => {
		const key = scopedStoreKey(zunoPartitionKey("tenant-a"), zunoTopic("cart"), "123");
		expect(key).toBe("tenant-a:cart:123");
		expect(parseScopedStoreKey(key)?.topic).toBe("cart");
	});
	it("negotiates legacy and subscription-aware protocols", () => {
		expect(negotiateZunoProtocol(1)).toEqual({ version: 1, subscriptions: true });
		expect(negotiateZunoProtocol(99)).toEqual({ version: 0, subscriptions: false });
	});
	it("rejects partition and topic escalation plus connection limits", () => {
		const forbiddenPartition = createZunoSubscription({ id: "1", partition: "tenant-b", topic: "cart" });
		expect(validateSubscriptions([forbiddenPartition], principal).reason).toBe("PARTITION_FORBIDDEN");
		const forbiddenTopic = createZunoSubscription({ id: "2", partition: "tenant-a", topic: "admin" });
		expect(validateSubscriptions([forbiddenTopic], principal).reason).toBe("TOPIC_FORBIDDEN");
		const allowed = createZunoSubscription({ id: "3", partition: "tenant-a", topic: "cart" });
		expect(validateSubscriptions([allowed], principal, { maxSubscriptionsPerConnection: 0 }).reason).toBe("SUBSCRIPTION_LIMIT_EXCEEDED");
	});
	it("rejects cross-tenant mutations before state access", () => {
		const errors = authorizeStateEvent({ storeKey: "tenant-b:cart:1", state: {} }, principal);
		expect(errors[0]?.message).toContain("partition");
	});
	it("indexes delivery by partition and topic", () => {
		const registry = createZunoSubscriptionRegistry();
		const cart = vi.fn();
		const other = vi.fn();
		registry.subscribe(createZunoSubscription({ id: "cart", partition: "tenant-a", topic: "cart" }), cart);
		registry.subscribe(createZunoSubscription({ id: "other", partition: "tenant-b", topic: "cart" }), other);
		expect(registry.publish(zunoPartitionKey("tenant-a"), zunoTopic("cart"))).toBe(1);
		expect(cart).toHaveBeenCalledOnce();
		expect(other).not.toHaveBeenCalled();
	});
	it("supports subscription churn without stale delivery", () => {
		const registry = createZunoSubscriptionRegistry();
		const listener = vi.fn();
		const sub = createZunoSubscription({ id: "churn", partition: "tenant-a", topic: "cart" });
		const stop = registry.subscribe(sub, listener);
		stop();
		registry.publish(zunoPartitionKey("tenant-a"), zunoTopic("cart"));
		expect(listener).not.toHaveBeenCalled();
		expect(registry.size).toBe(0);
	});
	it("scopes live delivery, replay, and snapshots", () => {
		const server = createZunoServerState();
		const cartListener = vi.fn();
		server.subscribeToScopedStateEvents("tenant-a", new Set(["cart"]), cartListener);
		server.compareAndSet({ storeKey: "tenant-a:cart:1", state: { n: 1 } });
		const cart = server.compareAndSet({ storeKey: "tenant-a:cart:1", state: { n: 2 }, baseVersion: 1 });
		const admin = server.compareAndSet({ storeKey: "tenant-a:admin:1", state: { secret: true } });
		if (cart.ok) server.publishToStateEvent(cart.event);
		if (admin.ok) server.publishToStateEvent(admin.event);
		expect(cartListener).toHaveBeenCalledTimes(1);
		expect(server.getScopedEventsAfter(0, "tenant-a", new Set(["cart"]))).toHaveLength(2);
		expect(Object.keys(server.getScopedUniverseState("tenant-a", new Set(["cart"])))).toEqual(["tenant-a:cart:1"]);
	});
});
