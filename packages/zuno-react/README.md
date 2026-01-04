# @iadev93/zuno-react

React adapter for **Zuno**.

This package provides idiomatic React bindings using `useSyncExternalStore`.

---

## Install

```bash
npm install @iadev93/zuno-react
```

Peer dependency:

* `react >= 18`

---

## Usage

```tsx
import { createZunoReact } from "@iadev93/zuno-react";

const zuno = createZunoReact();

const counter = zuno.store("counter", () => 0);

function App() {
  const value = counter.use();
  return <button onClick={() => counter.set(v => v + 1)}>{value}</button>;
}
```

---

## Features

* No Context
* No Provider
* Fine‑grained subscriptions
* Selector + equality support
* SSR‑safe via `useSyncExternalStore`

---

## Design Rules

* React adapter never mutates core
* React adapter never owns state
* React adapter only subscribes

---

If you’re using Zuno in a real project, please open an issue and tell us your use case.

---

## License

MIT
