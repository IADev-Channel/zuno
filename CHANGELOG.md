# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Golden Test Suite**: Comprehensive tests for critical flows including offline queueing (FIFO), conflict resolution determinism, and middleware isolation.
- **Conflict Resolution Strategies**: New documentation and internal support for "Prefer Local", "Prefer Server", and custom manual merge resolvers.
- **Protocol Truth Table**: Detailed documentation of Zuno's synchronization behavior across different network and state conditions.
- **Middleware Support**: Enhanced `createZuno` with onion-style middleware for intercepting and logging events.
- **Architecture Documentation**: Added `ARCHITECTURE.md` explaining the core concepts of Replicas, Universe, and Transport layers.
- **Contributor Guide**: Added `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` to support community growth.
- **Logger Middleware**: Added example logger middleware and conflict resolver to the `basic-html` exercise.

### Fixed
- **Type Invariance in Store Management**: Resolved a critical TypeScript error where `Store<T>` could not be assigned to `Store<unknown>` in the internal `Universe` map.
- **Broad Linting Cleanup**: Standardized code style using Biome across all packages, fixing dozens of `noExplicitAny`, `noNonNullAssertion`, and formatting issues.
- **Reactive Hooks**: Cleaned up `useEffect` dependencies in `@iadev93/zuno-react` for better performance and reliability.

### Changed
- **Wire Protocol v1 Refinement**: Improved clarity on event ordering and base versioning for offline reconciliation.
