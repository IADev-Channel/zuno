# Contributing to Zuno

First off, thanks for taking the time to contribute! Zuno is a community-driven project, and we value your input.

## Development Setup

Zuno is a monorepo managed with **pnpm**.

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- [pnpm](https://pnpm.io/)

### 2. Installation
```bash
pnpm install
```

### 3. Building
```bash
pnpm build
```

### 4. Running Tests
We use [Vitest](https://vitest.dev/) for testing.
```bash
pnpm test
```

### 5. Linting & Formatting
We use [Biome](https://biomejs.dev/) for linting and formatting.
```bash
pnpm check   # Check for linting/formatting issues
pnpm format  # Automatically fix issues
```

---

## Technical Standards

-   **Deterministic State**: Always ensure your changes maintain the versioned state contract.
-   **No Peer Deps in Core**: The core `zuno` package should have minimal dependencies.
-   **Adapter Consistency**: New adapters (Vue, Svelte, etc.) should follow the `ZunoReadable` contract.

## Contribution Process

1.  **Open an Issue**: For major changes, please open an issue first to discuss the design.
2.  **Fork & Branch**: Create a feature branch from `main`.
3.  **Tests**: Ensure all existing tests pass and add new tests for your features.
4.  **Pull Request**: Submit a PR with a clear description of what was changed and why.

## Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md) to ensure a welcoming environment for everyone.
