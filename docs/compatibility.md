# Compatibility

Zuno packages support maintained Node.js releases starting with Node.js 22. The
consumer verification matrix covers Node.js 22 and 24, plus Bun 1.2 and the
latest Bun release.

## Framework and toolchain ranges

| Integration | Supported range | Verified development stack |
| --- | --- | --- |
| Core, React, Express, and Elysia | Node.js `>=22` | TypeScript 7.0 native checker; TypeScript 6.0 declaration bridge |
| Angular adapter | Angular `^22.0.0` | Angular 22.1, TypeScript 6.0, RxJS 7.8 |
| Angular example | Angular `^22.1.4` | Analog 2.7, Vite 8.2, Zone.js 0.16 |

The Angular adapter declares Angular as a peer dependency so applications use
their own framework installation. Zuno's workspace pins the compiler used to
produce declarations; TypeScript is not a runtime dependency of published
packages.

TypeScript 7 is installed as `@typescript/native` in each non-Angular package
and its local `typecheck` script runs during every `pnpm verify`. Angular remains on TypeScript
6 because Angular 22 requires `>=6.0 <6.1`. The TypeScript 6 compatibility
package also supplies the legacy JavaScript compiler API currently required by
`tsup` to bundle declarations; it does not limit the non-Angular packages' CI
type-checking to TypeScript 6.

## Upgrade policy

- Node.js type definitions target the minimum supported Node.js major (22).
- Angular upgrades are evaluated one major at a time. The Angular adapter tests
  and production example build must pass before moving to the next major.
- TypeScript changes must pass the native non-Angular checks and satisfy
  Angular's separate compiler peer range before release.
- Analog and Vite are upgraded together with Angular only when their published
  peer ranges overlap.
