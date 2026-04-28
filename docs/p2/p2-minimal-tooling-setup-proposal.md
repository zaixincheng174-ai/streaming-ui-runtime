# P2 Minimal Tooling Setup Proposal

## Decision

P2 source scaffold remains blocked.

This document proposes minimal tooling only.

No tooling files are created in this task.

The next step after review may be a tooling setup patch, not runtime implementation.

## Current Tooling Gap

Current gap:

- no `package.json`
- no `tsconfig`
- no test runner config
- no lint/typecheck commands
- no `runtime/` source tree
- no `tests/runtime/` tree
- existing project uses standalone scripts

The repo is not ready to create TypeScript `runtime/core` source or `tests/runtime` files until the minimal tooling gate is accepted.

## Minimal Tooling Goal

The tooling setup should support TypeScript type/schema-only `runtime/core` files.

It should support minimal fail-closed tests.

It should avoid browser/DOM/React dependencies.

It should avoid a bundler/runtime build pipeline.

It should avoid Canvas/WebGPU.

It should avoid product integration.

The goal is to make the later scaffold reviewable and testable without turning P2 into runtime behavior.

## Proposed Files For Tooling Setup

Propose only:

- `package.json`
- `tsconfig.json`
- optionally a tiny test runner choice config only if necessary

`tests/runtime/` may remain absent until the scaffold step.

Do not propose:

- `runtime/` source files
- worker/main source
- bundler config
- React config
- browser test config
- Canvas/WebGPU config

## Package Scripts Proposal

Proposed scripts:

- `"typecheck": "tsc --noEmit -p tsconfig.json"`
- `"test:runtime": "npm run build:runtime-test && node --test .tmp/p2-runtime-test/tests/runtime/*.test.js"`
- `"check:runtime-guards": "node scripts/p2/check_runtime_guards.mjs"` if a guard script is approved, or a reviewed grep-based equivalent if the file surface stays small enough

If choosing `node:test`, TypeScript execution requires compilation first. Node does not execute `.ts` test files directly without an additional loader, and adding a loader would increase the dependency surface.

The future tooling patch may therefore include a compile-only helper script such as:

- `"build:runtime-test": "rm -rf .tmp/p2-runtime-test && tsc -p tsconfig.json --outDir .tmp/p2-runtime-test"`

This emits testable JavaScript only into a temporary build directory. It is not a runtime build pipeline.

## TypeScript Config Proposal

`tsconfig.json` should:

- target modern ES;
- use ESM;
- avoid DOM lib for `runtime/core` if feasible;
- enable strict mode;
- support `noEmit` for typecheck;
- allow emit only for tests if needed by `node:test`;
- include `runtime/core` and `tests/runtime` only after scaffold exists;
- avoid frontend/browser assumptions.

Candidate compiler posture:

- `target`: modern ES, such as `ES2022`;
- `module`: Node-compatible ESM, such as `NodeNext` or a reviewed equivalent;
- `moduleResolution`: aligned with the selected module mode;
- `strict`: true;
- `lib`: ES-only, without DOM unless a future non-core module explicitly needs it;
- `types`: Node test types only if needed and explicitly introduced.

## Test Runner Choice

Choose A: `node:test` with TypeScript compile step.

Recommendation criteria:

- minimal dependencies;
- works with TypeScript after a compile step;
- supports pure Node tests;
- no browser environment;
- no DOM required;
- no bundler assumptions;
- no React dependency.

`vitest` is not recommended as the first choice because it adds a larger test-runner dependency and often implies Vite-style conventions that are not needed for pure schema/validation tests.

Another minimal option should be rejected unless it is demonstrably smaller than `node:test` plus TypeScript.

## Forbidden Dependency Guard

Define a future guard to reject:

- React imports
- DOM globals
- Worker constructor
- Canvas/WebGPU APIs
- P1 target imports
- product-specific imports
- browser capture tooling

The guard should scan only the approved first scaffold files unless later reviewed otherwise.

The guard should fail closed if it finds tokens such as:

- `react`
- `document`
- `window`
- `Worker`
- `HTMLCanvasElement`
- `OffscreenCanvas`
- `WebGPU`
- `GPUDevice`
- `navigator.gpu`
- `bench/p1`
- `scripts/p1`
- capture helper imports

## Allowed Tooling Patch Scope

If approved later, a tooling patch may add only:

- `package.json`
- `tsconfig.json`
- minimal test runner config if needed
- maybe `scripts/p2/check_runtime_guards.mjs` if grep is too brittle

It may not add `runtime/` source files or `tests/runtime` files yet.

It may not add worker/main modules, benchmark code, browser capture code, React config, bundler config, Canvas/WebGPU config, or product integration hooks.

## Validation For Future Tooling Patch

Future patch must run:

- `npm install` or equivalent only if `package.json` is introduced;
- `npm run typecheck`;
- `npm run test:runtime`;
- `npm run check:runtime-guards`;
- `git diff --stat` to confirm no runtime source files.

If `test:runtime` has no tests yet in the tooling-only patch, the command must either:

- run a documented no-test placeholder successfully without creating `tests/runtime`; or
- be deferred until the scaffold patch, with the deferral explicitly documented.

The preferred route is to define the command now but keep `tests/runtime` creation for the later scaffold.

## Risks

Risks:

- introducing package tooling may broaden repo scope;
- dependency bloat;
- TypeScript config accidentally includes frontend/browser globals;
- test runner may force bundler assumptions;
- guard scripts may be brittle.

Mitigations:

- choose `node:test` over a framework runner for the first step;
- keep TypeScript config ES/Node-only;
- do not add DOM libs for `runtime/core`;
- do not add bundler config;
- scope guard checks to approved scaffold files;
- keep runtime behavior blocked.

## Recommendation

Choose the smallest safe tooling plan:

- `package.json`;
- `tsconfig.json`;
- TypeScript as the only necessary development dependency unless Node types are explicitly required;
- `node:test` with a TypeScript compile step;
- forbidden-dependency guard through either a small reviewed script or a narrow grep command.

Next step should be A: implement minimal tooling patch.

That patch must not create `runtime/`, `tests/runtime/`, source modules, tests, worker/main behavior, or benchmark changes.

## Blocked

Explicitly blocked:

- runtime source scaffold
- `tests/runtime` source scaffold
- P2 implementation
- Worker runtime
- Canvas/WebGPU
- product integration
- allocation_probe
- benchmark expansion
