# @iadev93/zuno-angular

> The official Angular 18+ adapter for [Zuno](https://github.com/iadev93/zuno), the ultra-fast distributed state management library.

![Zuno Logo](https://raw.githubusercontent.com/iadev93/zuno/main/zuno.png)

## Features

- 🔋 **Full DI Integration**: Inject `ZunoService` anywhere in your app.
- 📡 **Dual Reactivity**: Use stores as **Signals** (for template performance) or **Observables** (for RxJS streams).
- 🔄 **Real-time Sync**: Automatic state synchronization across tabs and devices.
- ⚡️ **Optimistic Updates**: Immediate UI feedback with background confirmation.
- 🛡️ **Type-Safe**: Strictly typed state management.

## Installation

```bash
pnpm add @iadev93/zuno-angular @iadev93/zuno rxjs
# or
npm install @iadev93/zuno-angular @iadev93/zuno rxjs
```

## Quick Start

### 1. Provide Zuno

In your `app.config.ts` (or `AppModule`), provide Zuno with your backend configuration.

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideZuno } from '@iadev93/zuno-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZuno({
      syncUrl: 'http://localhost:3000/zuno/sync',
      sseUrl: 'http://localhost:3000/zuno/sse',
      // Optional: batchSync: true,
      // Optional: optimistic: true
    })
  ]
};
```

### 2. Create & Use a Store

Inject `ZunoService` into your component and create a store. You can then consume it as a **Signal** or **Observable**.

```typescript
// counter.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZunoService } from '@iadev93/zuno-angular';

@Component({
  selector: 'app-counter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h1>Count (Signal): {{ count() }}</h1>
    <h2>Count (Observable): {{ count$ | async }}</h2>
    
    <button (click)="inc()">Increment</button>
  `
})
export class CounterComponent {
  private zuno = inject(ZunoService);
  
  // 1. Initialize store (Pass a factory function!)
  private store = this.zuno.store('counter', () => 0);
  
  // 2. Consume as Signal (Best for templates)
  count = this.store.asSignal();
  
  // 3. Consume as Observable (Best for effects/streams)
  count$ = this.store.asObservable();
  
  inc() {
    // 4. Update state (Optimistic by default)
    this.store.set(c => c + 1);
  }
}
```

## API Reference

### `ZunoService`

The main service for interacting with Zuno.

#### `store<T>(key, init, reducer?, equals?)`
Creates or retrieves a store.
- **key**: Unique identifier for the store.
- **init**: Factory function returning the initial state `() => T`.
- **reducer** (optional): Function to handle intent-based updates.
- **equals** (optional): Custom equality function.

Returns an `AngularBoundStore<T>` with:
- `get()`: Get current value.
- `set(next)`: Update value.
- `mutate(intent)`: Dispatch an intent.
- `asSignal()`: Returns Angular `Signal<T>`.
- `asObservable()`: Returns RxJS `Observable<T>`.

### `provideZuno(options)`

Sets up the Zuno environment.
- **options**: `CreateZunoOptions` from `@iadev93/zuno`.

## License

MIT
