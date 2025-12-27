# Why Zuno Exists

Zuno was created to solve a problem most state libraries avoid:

> **How does state move and stay consistent across replicas?**

Not just inside a component tree — but across **tabs, runtimes, and servers**.

---

## The Problem with Traditional State Libraries

Most libraries focus on:

* rendering efficiency
* component reactivity
* developer ergonomics

They assume:

* a single runtime
* a single source of truth
* a short-lived lifecycle

These assumptions break down for:

* multi-tab apps
* streaming platforms
* collaborative tools
* admin dashboards
* auth/session state

---

## Zuno’s Mental Shift

Zuno treats state as:

* **replicated**
* **versioned**
* **event-driven**

UI frameworks become **consumers**, not owners.

---

## What Zuno Is (and Is Not)

### Zuno IS

* a universal state replication engine
* framework-agnostic
* transport-agnostic
* deterministic and predictable

### Zuno is NOT

* a Redux replacement
* a UI state helper
* a CRDT system
* a networking abstraction

---

## Core Principles

### 1. Events, Not Setters

All mutations are explicit events.
Events can be logged, replayed, validated, or rejected.

---

### 2. State Outlives UI

State should survive:

* component unmounts
* tab reloads
* framework boundaries

---

### 3. Minimal API Surface

Zuno exposes only what is necessary:

* `get`
* `set`
* `subscribe`

Everything else is infrastructure.

---

### 4. Boring by Design

If a concept feels clever, it probably does not belong in the core.

Zuno prefers:

* explicit over implicit
* simple over flexible
* predictable over magical

---

## Where Zuno Fits Best

Zuno shines when:

* state must sync across tabs
* server authority matters
* optimistic updates are needed
* frameworks should not own data

Examples:

* streaming apps
* dashboards
* feature flags
* shared UI shells

---

## Long-Term Vision

Zuno’s future is intentionally layered:

1. Stable protocol
2. Framework adapters
3. Multi-language servers
4. Native kernel (Rust / Zig)

The core remains small.
The edges evolve.

---

## Final Thought

Zuno is not about replacing tools.

It is about **owning state semantics** instead of inheriting them.
