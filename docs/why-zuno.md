# Why Zuno Exists

Zuno was created to solve a problem most state libraries avoid:

> **How does state move and stay consistent across replicas?**

Not just inside a component tree — but across **tabs, runtimes, and servers**.

---

## The Problem with Traditional State Libraries

Most state tools start with a **component tree** and work backwards. They optimize:

* rendering efficiency
* component reactivity
* developer ergonomics

and implicitly assume:

* a single runtime (usually one browser tab)
* a single source of truth (usually an in-memory store)
* a short-lived lifecycle (state dies with the component)

These assumptions collapse in real products where data must **outlive a view** and **survive a process restart**. They break down for:

* multi-tab apps that must keep user context aligned
* streaming platforms with long-running sessions
* collaborative tools that reconcile edits from many replicas
* admin dashboards where server authority matters
* auth/session state that must persist across navigations

---

## Zuno’s Mental Shift

Zuno treats every piece of data as a **replicated log** entry, not a UI convenience. State is:

* **replicated** — multiple runtimes own the same data and must converge.
* **versioned** — every mutation is tagged with the version it was based on.
* **event-driven** — changes are explicit events, not implicit setters.

UI frameworks become **consumers of events**, not owners of state. They subscribe, react, and render — but the data lifecycle lives outside the view layer.

---

## What Zuno Is (and Is Not)

### Zuno IS

* a universal state replication engine
* framework-agnostic — React, Vue, Svelte, vanilla, workers
* transport-agnostic — SSE, BroadcastChannel, HTTP, WebSocket
* deterministic and predictable — mutations either apply or reject

### Zuno is NOT

* a Redux replacement or reducer helper
* a UI state helper (it does not manage component-local state)
* a CRDT system (it favors version checks over merge strategies)
* a networking abstraction (you can swap transports as needed)

---

## Core Principles

### 1. Events, Not Setters

All mutations are explicit events. Events can be:

* logged and replayed for deterministic hydration
* validated or rejected based on the current authoritative version
* shipped across transports without leaking implementation details

---

### 2. State Outlives UI

State is a first-class citizen, not a byproduct. It should survive:

* component unmounts
* tab reloads and process restarts
* framework boundaries and adapter changes

---

### 3. Minimal API Surface

Zuno exposes only what is necessary to read, write, and observe:

* `get` — read the current replicated value
* `set` — propose a new state based on the latest version
* `subscribe` — stream events as they arrive

Everything else is infrastructure built on top of these primitives.

---

### 4. Boring by Design

If a concept feels clever, it probably does not belong in the core. Zuno prefers:

* explicit over implicit
* simple over flexible
* predictable over magical

---

## Where Zuno Fits Best

Zuno shines when:

* state must sync across tabs without drift
* server authority matters and conflicts must be rejected, not merged
* optimistic updates are needed while waiting for confirmation
* frameworks should not own data or lifecycle

Examples:

* streaming apps that keep playback metadata consistent
* dashboards that hydrate from server truth but allow optimistic edits
* feature flags that must propagate instantly across clients
* shared UI shells that span multiple micro-frontends

If your state never leaves a single component tree, Zuno is probably too much.

---

## Long-Term Vision

Zuno’s future is intentionally layered:

1. Stable protocol
2. Framework adapters
3. Multi-language servers
4. Native kernel (Rust / Zig)

The core remains small. The edges evolve. New transports and codecs can plug in without rewriting the mental model.

---

## How It Feels to Use

* Define a store (e.g., `counter`).
* Subscribe in any runtime; you immediately receive a snapshot.
* Emit events with the version you based them on.
* If the server accepts, everyone receives the new version. If it rejects, you reconcile with the authoritative state.

The result: predictable state movement across tabs, runtimes, and servers with minimal ceremony.

## Final Thought

Zuno is not about replacing tools. It is about **owning state semantics** instead of inheriting them.
