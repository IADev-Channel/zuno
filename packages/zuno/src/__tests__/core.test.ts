import { describe, it, expect } from 'vitest';
import { createStore, createUniverse } from '../core';

describe('Zuno Core', () => {
  describe('Store', () => {
    it('should create a store with initial value', () => {
      const store = createStore(10);
      expect(store.get()).toBe(10);
    });

    it('should update value', () => {
      const store = createStore(10);
      store.set(20);
      expect(store.get()).toBe(20);
    });

    it('should update value with updater function', () => {
      const store = createStore(10);
      store.set((prev) => prev + 5);
      expect(store.get()).toBe(15);
    });

    it('should notify subscribers', () => {
      const store = createStore(0);
      let value = 0;
      store.subscribe((v) => { value = v; });
      store.set(1);
      expect(value).toBe(1);
    });
  });

  describe('Universe', () => {
    it('should manage multiple stores', () => {
      const universe = createUniverse();
      const storeA = universe.getStore('a', () => 1);
      const storeB = universe.getStore('b', () => 2);

      expect(storeA.get()).toBe(1);
      expect(storeB.get()).toBe(2);

      const storeAAngain = universe.getStore('a', () => 100); // Should return existing
      expect(storeAAngain.get()).toBe(1); // Not 100
    });

    it('should take and restore snapshots', () => {
      const universe = createUniverse();
      const storeA = universe.getStore('a', () => 1);
      storeA.set(10);

      const snap = universe.snapshot();
      expect(snap).toEqual({ a: 10 });

      universe.restore({ a: 20, b: 30 });
      expect(universe.getStore('a', () => 0).get()).toBe(20);
      expect(universe.getStore('b', () => 0).get()).toBe(30);
    });
  });
});
