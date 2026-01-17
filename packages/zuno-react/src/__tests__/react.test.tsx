import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createZunoReact } from '../index';
import { createStore } from '@iadev93/zuno';

describe('Zuno React', () => {
  it('should create store hook and update state', () => {
    const z = createZunoReact({});
    const store = z.store('counter', () => 0);

    const { result } = renderHook(() => store.use());
    expect(result.current).toBe(0);

    act(() => {
      store.set(10);
    });

    expect(result.current).toBe(10);
  });

  it('should share state between multiple hooks', () => {
    const z = createZunoReact({});
    const store = z.store('shared', () => 'a');

    const { result: r1 } = renderHook(() => store.use());
    const { result: r2 } = renderHook(() => store.use());

    expect(r1.current).toBe('a');
    expect(r2.current).toBe('a');

    act(() => {
      store.set('b');
    });

    expect(r1.current).toBe('b');
    expect(r2.current).toBe('b');
  });

  it('should support optimistic updates (middleware implicit check)', async () => {
    // Mock middleware that delays slightly? Or just check immediate update.
    // Zuno is synchronous locally by default (optimistic).
    const z = createZunoReact({ optimistic: true });
    const store = z.store('opt', () => 0);

    const { result } = renderHook(() => store.use());

    await act(async () => {
      store.set(5);
    });

    expect(result.current).toBe(5);
  });
});
