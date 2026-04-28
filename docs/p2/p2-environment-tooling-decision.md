# P2 Environment And Tooling Decision

## Decision

P2 implementation remains blocked.

This document decides the tooling/environment gate for the future type/schema-only scaffold.

No source files are created in this step.

The next step after this document may be a narrow type/schema-only scaffold only if all gates are satisfied.

## Existing Repo Tooling Snapshot

Observed repository state:

- `package.json`: absent.
- TypeScript configuration: absent. No `tsconfig*.json` files were found.
- Test runner configuration: absent. No `vitest`, `jest`, or equivalent test config files were found.
- Lint/typecheck commands: absent. There is no package manifest exposing repo scripts.
- `runtime/`: absent.
- `tests/runtime/`: absent.
- Existing automation: present as repo-local shell scripts and Node ESM `.mjs` scripts under `scripts/p0`, `scripts/p0f`, and `scripts/p1`.
- Existing package boundaries: no frontend/backend package boundary was observed in repo config. The repo currently reads as documentation, benchmark assets, HTML targets, and standalone Node scripts rather than a package-managed app.

Current tooling is repo-wide in practice but not formalized through `package.json`, TypeScript, or a test runner.

## Language Decision

TypeScript is preferred for `runtime/core` schema modules.

The first scaffold should be type/schema-only.

Runtime behavior remains blocked.

A JavaScript-only scaffold should be rejected unless the repo cannot support TypeScript without disproportionate tooling changes.

Reasoning:

- protocol schemas benefit from static field names and discriminated unions;
- message envelopes need compile-time constraints before worker/main behavior exists;
- transaction types and priority lanes are easier to review with explicit types;
- fail-closed validation can be tested against typed result shapes;
- TypeScript supports future worker/main boundary safety without requiring runtime implementation in the first scaffold.

## Module System Decision

ESM is preferred if existing repo supports it.

The repo's current executable scripts use `.mjs`, which already aligns with ESM-style standalone Node scripts.

Do not introduce CJS unless existing repo constraints require it.

Avoid bundler-specific assumptions in the first scaffold. The first scaffold should not depend on Vite, Webpack, browser bundling, worker bundling, or React build behavior.

## Test Runner Decision

Prefer the repo's existing test runner if one exists.

No existing test runner or test config was observed.

If none exists at implementation time, recommend the smallest test runner/config needed for pure TypeScript schema/validation tests. The test runner should run in Node and should not require a browser, DOM, React, Worker runtime, or bundler.

Do not add the test runner in this docs task.

Required future test targets:

- protocol-validation
- checksum-fail-closed
- stale-projection representation
- no-runtime-behavior guard

## Typecheck Decision

The first scaffold must have a typecheck command.

Typecheck must cover `runtime/core` files.

Typecheck must not require browser/DOM globals for core modules.

`runtime/core` must remain framework-agnostic.

Because no current `package.json` or `tsconfig*.json` exists, the future scaffold cannot proceed until a minimal typecheck environment is explicitly approved.

## Forbidden Dependency Decision

The first scaffold must not depend on:

- React
- DOM APIs
- Worker constructor
- Canvas/WebGPU
- browser capture tooling
- P1 targets
- product-specific code
- benchmark harnesses

Forbidden dependency checks must be part of the future scaffold validation plan.

## Minimal Future Config Changes

Existing tooling is insufficient for TypeScript source plus tests because the repo currently lacks `package.json`, TypeScript config, and test runner config.

Minimal future config changes allowed, if approved:

- a package script for typecheck if absent;
- TypeScript config or TypeScript config extension if needed;
- a Node-based test runner config if absent;
- a guard script or grep command for forbidden runtime dependencies/APIs.

Still not allowed in the tooling setup:

- bundler/runtime build pipeline;
- worker bundling setup;
- browser app framework setup;
- React integration;
- Canvas/WebGPU setup;
- benchmark/capture expansion.

Do not implement these config changes now.

## First Scaffold Allowed Only If

The first scaffold is allowed only if all of the following are accepted:

- language decision accepted;
- module system accepted;
- typecheck command defined;
- test runner path defined;
- forbidden dependency guard defined;
- `runtime/core`-only scope accepted;
- no source files outside approved list;
- no behavior beyond pure validation helpers.

If any item is unresolved, source scaffolding remains blocked.

## First Scaffold Still Blocked If

Block scaffold if:

- environment is disputed;
- test runner cannot be decided;
- typecheck cannot be run;
- first scaffold would require broad repo restructuring;
- scaffold would create worker/main behavior;
- scaffold would pull in React/DOM/Canvas/WebGPU;
- scaffold lacks fail-closed tests.

## Future Allowed Files After Approval

If this environment/tooling decision is accepted, the next source step may create only:

- `runtime/core/protocol.ts`
- `runtime/core/ops.ts`
- `runtime/core/transactions.ts`
- `runtime/core/priorities.ts`
- `runtime/core/checksums.ts`
- `runtime/core/errors.ts`
- `tests/runtime/protocol-validation.test.ts`
- `tests/runtime/checksum-fail-closed.test.ts`

No `worker/`, `main/`, scheduler implementation, projection engine, React integration, or renderer backend is allowed.

## Validation Plan For Future Scaffold

Candidate future commands/checks, subject to the approved tooling:

- typecheck command, for example `npm run typecheck` after a minimal package/typecheck setup exists;
- test command, for example `npm test -- --runInBand` or `npm run test` depending on the accepted runner;
- guard command for forbidden imports/APIs, checking scaffold files for React, DOM globals, Worker constructor, Canvas/WebGPU APIs, timers, async scheduling, P1 target imports, product-specific code, and benchmark/capture code;
- `git diff --stat -- runtime tests bench/p1 scripts/p1 docs/p0 bench/p0 docs/p0f bench/p0f scripts/p0 scripts/p0f` to verify only allowed runtime/test files changed and protected benchmark/evidence paths stayed untouched.

Exact commands are not fully knowable until the tooling setup is approved. The immediate unresolved items are the package script names, TypeScript config path, and test runner choice.

## Recommended Next Gate

Choose B: require additional tooling setup proposal first.

Reason: the actual repo snapshot has no `package.json`, no TypeScript config, no test runner config, and no lint/typecheck commands. A type/schema-only scaffold should not be created until the smallest tooling setup is reviewed and accepted.

The tooling setup proposal should be narrow: package/typecheck/test configuration only, no runtime behavior, no worker/main modules, and no benchmark changes.

## Blocked

Explicitly blocked:

- P2 runtime behavior implementation
- worker runtime
- scheduler implementation
- projection engine
- React/DOM integration
- Canvas/WebGPU
- product integration
- allocation_probe
- benchmark expansion
- claiming final runtime success

## Final Recommendation

Tooling is not ready for a TypeScript type/schema-only scaffold because the repo lacks package, typecheck, and test-runner configuration.

The next action after this document should be a minimal tooling setup proposal before source files. That proposal should define the smallest acceptable TypeScript and Node test setup, exact commands, forbidden-dependency guards, and protected-path validation before any `runtime/` or `tests/runtime/` files are created.
