import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startSSE, ZunoStateEvent } from '../sync';
import { createUniverse } from '../core';

describe('Zuno Sync', () => {
  const universe = createUniverse();
  const versions = new Map<string, number>();
  const opts = {
    universe,
    url: 'http://sse',
    syncUrl: 'http://sync',
    optimistic: true,
    clientId: 'test-client',
    versions,
    getLastEventId: () => 0,
  };

  // Mock EventSource
  class MockEventSource {
    url: string;
    constructor(url: string) {
      this.url = url;
      setTimeout(() => this.onopen?.(), 0);
    }
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: (() => void) | null = null;
    close() { }
    addEventListener() { }
    removeEventListener() { }
  }
  global.EventSource = MockEventSource as any;

  beforeEach(() => {
    vi.clearAllMocks();
    universe.clear();
    versions.clear();
    // Reset global fetch mock
    global.fetch = vi.fn();
    // Mock navigator online
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true });
  });

  it('should dispatch event via fetch', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ event: { version: 1 } }),
    });

    const transport = startSSE(opts);
    const event: ZunoStateEvent = { storeKey: 'test', state: 1 };

    await transport.dispatch(event);

    expect(global.fetch).toHaveBeenCalledWith('http://sync', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(event),
    }));
    expect(universe.getStore('test', () => 0).get()).toBe(1); // Optimistic update
  });

  it('should queue events when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false });

    const transport = startSSE(opts);
    const result = await transport.dispatch({ storeKey: 'offline', state: 99 });

    expect(result.reason).toBe('OFFLINE_QUEUED');
    expect(global.fetch).not.toHaveBeenCalled();
    // Optimistic offline update
    expect(universe.getStore('offline', () => 0).get()).toBe(99);
  });

  it('should resolve conflict (Server Wins default helper)', async () => {
    // Simulate 409 Conflict
    const serverState = 100;
    (global.fetch as any).mockResolvedValueOnce({
      status: 409,
      json: async () => ({ current: { state: serverState, version: 10 } }),
    });

    const transport = startSSE(opts);
    const result = await transport.dispatch({ storeKey: 'conflict', state: 5 });

    expect(result.reason).toBe('CONFLICT');
    // Should have updated local state to server state
    expect(universe.getStore('conflict', () => 0).get()).toBe(serverState);
    expect(versions.get('conflict')).toBe(10);
  });

  it('should use custom resolveConflict strategy', async () => {
    const serverState = { count: 100 };
    const localState = { count: 5 };
    const mergedState = { count: 105 }; // Simple merge logic

    (global.fetch as any).mockResolvedValueOnce({
      status: 409,
      json: async () => ({ current: { state: serverState, version: 20 } }),
    });

    // Mock the SECOND fetch which is the auto-sync after resolution
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const customOpts = {
      ...opts,
      resolveConflict: (local: any, server: any) => {
        return { count: local.count + server.count };
      }
    };

    const transport = startSSE(customOpts);

    // Set initial local state so resolver has it
    universe.getStore('merge', () => ({ count: 0 })).set(localState);

    await transport.dispatch({ storeKey: 'merge', state: localState });

    // 1. Should have updated local state to merged state
    expect(universe.getStore('merge', () => ({ count: 0 })).get()).toEqual(mergedState);
    // 2. Should have updated version base to server version
    expect(versions.get('merge')).toBe(20);

    // 3. Should have called fetch TWICE:
    //    - 1st: The original dispatch (failed 409)
    //    - 2nd: The auto-sync dispatch with merged state
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const secondCallBody = JSON.parse((global.fetch as any).mock.calls[1][1].body);
    expect(secondCallBody.state).toEqual(mergedState);
    expect(secondCallBody.baseVersion).toBe(20);
  });
});
