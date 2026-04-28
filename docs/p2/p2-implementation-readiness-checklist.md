# P2 Implementation Readiness Checklist

## Decision

P2 implementation remains blocked.

This checklist defines the gate for later implementation. It decides what must be true before creating any `runtime/` source files, what may be considered as a first scaffold, and what remains blocked.

The next possible step after this checklist is review, not code. A type/schema-only scaffold may be considered only if every required gate below is accepted.

## Evidence Basis

P0 product evidence identified the mechanism family: `click/pointerup -> Run microtasks -> state/context/fanout coordination`.

F0-D reproduced controlled main-thread derived fanout long tasks.

F1 Worker B showed that equivalent worker offload removes main-thread long tasks.

F2 showed that worker-side scheduling/projection reduces urgent projection latency.

P2 abstraction, API/protocol contract, and minimal interface skeleton docs have been written. These documents define the design basis for a future runtime, but they do not authorize implementation.

## Required Documents Before Implementation

Required documents that must exist and be reviewed:

- `docs/p2/p2-runtime-abstraction-spec.md`
- `docs/p2/p2-api-and-protocol-contract.md`
- `docs/p2/p2-minimal-interface-skeleton-plan.md`
- this readiness checklist

Implementation cannot begin if any of these are missing, stale, or contradictory.

## Environment Choice Gate

Before source files are created, the project must explicitly decide:

- TypeScript or JavaScript
- browser-only or Node/browser shared test environment
- module system
- test runner
- lint/typecheck command
- worker bundling strategy
- whether runtime source is framework-agnostic or React-adjacent

If environment is undecided, implementation remains blocked.

## Scope Boundary Gate

Allowed first scaffold scope:

- core protocol types
- operation interfaces
- transaction interfaces
- priority enum/helpers
- checksum/equivalence types
- error types
- no runtime behavior

Explicitly blocked in the first scaffold:

- Worker implementation
- scheduler behavior
- projection engine behavior
- React integration
- DOM commit
- Canvas/WebGPU
- benchmarks
- product integration

## Module Boundary Gate

Future modules requiring approval before any scaffold:

- `runtime/core/protocol.ts`
- `runtime/core/ops.ts`
- `runtime/core/transactions.ts`
- `runtime/core/priorities.ts`
- `runtime/core/checksums.ts`
- `runtime/core/errors.ts`

Only these core schema/type modules may be considered for the first scaffold. `worker/`, `main/`, and runtime behavior modules remain blocked until core schema tests pass.

## Test Gate Before Scaffold

Planned tests required before creating source:

- protocol-validation
- stale-projection
- checksum-fail-closed
- scheduler-priority
- backpressure
- worker-crash-recovery

For the first type/schema scaffold, require at minimum:

- protocol version missing fails closed
- unsupported protocol version fails closed
- missing `message_id` fails closed
- unknown `message_type` fails closed
- checksum missing/reduced counters fail closed in test mode
- stale projection schema can be represented

If these tests are not defined narrowly enough to prevent accidental runtime implementation, the scaffold remains blocked.

## Correctness Invariant Gate

Invariants that must be mapped to tests:

- No skipped work
- No stale visible commit
- Bounded main-thread commit
- Priority order
- Version monotonicity
- Projection checksum
- Cancellation correctness
- Backpressure correctness
- Worker error recoverability

If an invariant has no planned test, implementation remains blocked.

## Fail-Closed Gate

Required fail-closed behavior:

- unknown `protocol_version` rejected
- missing required field rejected
- duplicate `message_id` idempotent or rejected
- invalid checksum rejected
- stale projection rejected
- projection too large rejected
- equivalence mismatch rejected
- unsupported priority lane rejected

These behaviors must be represented in the contract tests before runtime behavior is attempted.

## No-Go Criteria

Implementation must not begin if:

- module boundaries are disputed
- environment choice is undecided
- tests are not defined
- correctness invariants lack tests
- runtime files would include behavior beyond schema/types
- Canvas/WebGPU appears in first scaffold
- worker/main behavior is attempted before core contract
- benchmark pressure causes shortcutting correctness

Any one no-go condition keeps P2 implementation blocked.

## Allowed First Scaffold If Gate Passes

If and only if the checklist is approved, the first implementation step may be:

P2 type/schema-only scaffold.

Allowed files:

- `runtime/core/protocol.ts`
- `runtime/core/ops.ts`
- `runtime/core/transactions.ts`
- `runtime/core/priorities.ts`
- `runtime/core/checksums.ts`
- `runtime/core/errors.ts`
- `tests/runtime/protocol-validation.test.ts`
- `tests/runtime/checksum-fail-closed.test.ts`

Allowed behavior:

- type/interface definitions
- pure validation helpers
- pure checksum/equivalence type helpers
- fail-closed validation tests

Still forbidden:

- `worker-entry`
- `state-store`
- scheduler implementation
- `projection-engine`
- main runtime client
- React binding
- DOM commit
- Canvas/WebGPU

## Review Questions Before Approval

- Are protocol schemas stable enough to scaffold?
- Are field names consistent with P1 measurement language?
- Are checksums/equivalence counters sufficient?
- Are error types exhaustive enough for first scaffold?
- Are tests narrow enough to avoid accidental runtime implementation?
- Is the first scaffold useful without becoming behavior code?

## Recommended Next Step

Choose A: proceed to a type/schema-only scaffold proposal after this checklist is reviewed.

This is the narrower next step because it keeps runtime behavior blocked while allowing the project to review exact files, exported types, validation helpers, and fail-closed tests before any source is created.

Do not revise the P2 contract docs first unless review finds a contradiction between the runtime abstraction, API/protocol contract, minimal skeleton plan, and this checklist.

## Blocked

Explicitly blocked:

- P2 behavior implementation
- worker runtime
- transaction scheduler implementation
- projection engine
- React/DOM integration
- Canvas/WebGPU
- product integration
- allocation_probe
- more benchmark escalation
- claiming final runtime success

## Final Recommendation

The checklist should approve only a narrow type/schema-only scaffold proposal if all gates pass. It should not approve runtime behavior.
