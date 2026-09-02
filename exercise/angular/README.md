# Zuno Angular Tutorial

This exercise demonstrates the `@iadev93/zuno-angular` adapter with standalone
Angular components, Signals, RxJS-compatible stores, and durable synchronization.

## What you will build

- A counter exposed as an Angular Signal.
- A typed todo-list store exposed as a Signal.
- A standalone component using Angular control flow and FormsModule.
- A globally provided Zuno client connected to the shared configured server.

## Run it

From the repository root, start the shared server and Angular client:

```bash
pnpm start-express
pnpm start-angular
```

Run those commands in separate terminals. To create a production bundle:

```bash
pnpm --filter exercise-angular build
```

## Files

- `src/main.ts`: loads Angular compiler/Zone.js and bootstraps the application.
- `src/app/app.config.ts`: provides the configured Zuno service.
- `src/app/app.component.ts`: creates stores, Signals, and UI actions.
- `src/styles.css`: shared exercise styling.
- `vite.config.mts`: Angular support through Analog's Vite plugin.

## Providing Zuno

`provideZuno()` registers one configured `ZunoService`:

```ts
import { ZUNO_SERVER_URL } from "../../../config";

provideZuno({
  syncUrl: `${ZUNO_SERVER_URL}/zuno/sync`,
  sseUrl: `${ZUNO_SERVER_URL}/zuno/sse`,
  channelName: "zuno-demo",
  clientId: `angular-client-${Math.random().toString(36).slice(2)}`,
  offlineQueue: createIndexedDBOfflineQueue({
    databaseName: "zuno-exercises",
    queueKey: "angular",
  }),
});
```

The explicit `clientId` identifies this browser replica. In a real application,
use a stable session/device identifier when appropriate.

## Injecting the service and creating stores

```ts
zuno = inject(ZunoService);
counterStore = this.zuno.store("counter", () => 0);
count = this.counterStore.asSignal();
```

The adapter returns the normal Zuno store plus:

- `asSignal()`: Angular Signal integration with injection-context cleanup.
- `asObservable()`: RxJS Observable integration using store equality checks.

Typed stores work the same way:

```ts
todoStore = this.zuno.store<Todo[]>("todos", () => []);
todos = this.todoStore.asSignal();
```

## Updating state

Functional setters derive the next value from the current value:

```ts
this.counterStore.set((count) => count + 1);
```

Todo updates use immutable array operations so Angular and Zuno can identify a
new state value and notify subscribers.

## Features demonstrated

- Angular dependency injection.
- Signals and RxJS interoperability.
- Optimistic, versioned server synchronization.
- SSE replay and snapshot fallback.
- BroadcastChannel tab synchronization.
- IndexedDB offline durability.
- Per-store final-state coalescing after reconnect.
- Cross-framework state sharing with React and Basic HTML.

## Exercises to try

1. Open Angular and React side-by-side and update the counter.
2. Replace `asSignal()` with `asObservable()` for one UI section.
3. Add a selector-style computed Signal for incomplete todo count.
4. Go offline, edit both stores, reload, and reconnect.
5. Change the queue key and observe that it creates an isolated durable queue.

See the [Angular adapter README](../../packages/zuno-angular/README.md),
[Protocol v1](../../docs/protocol-v1.md), and [exercise overview](../README.md).
