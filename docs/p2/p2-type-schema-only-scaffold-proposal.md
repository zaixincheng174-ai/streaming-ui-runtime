# P2 Type/Schema-Only Scaffold Proposal

## Decision

This is still a proposal, not implementation.

No source files are created in this task.

If approved later, the first scaffold may create only core schema/type modules and minimal fail-closed validation tests.

Worker/main runtime behavior remains blocked.

## Alignment With Readiness Checklist

The P2 runtime abstraction defines ops-stream, transactions, worker-resident state, scheduler, and projection protocol.

The P2 API/protocol contract defines schemas, message envelopes, versioning, checksum, and fail-closed behavior.

The P2 readiness checklist permits only a narrow type/schema scaffold after review.

This proposal defines that narrow scaffold: core shared contracts first, no worker/main runtime behavior, and only enough pure validation to prove fail-closed protocol behavior.

## Environment Choice Proposal

Recommend:

- TypeScript for `runtime/core` schema modules.
- Node-based tests for protocol/checksum validation.
- No browser/DOM dependency in the first scaffold.
- No React dependency.
- No Worker runtime dependency.
- No bundler-specific assumptions in the first scaffold.

If the repo does not yet have TypeScript config for runtime, the first source step must include the minimal config required for typechecking only, but not runtime behavior.

## Allowed First Scaffold Files

Allowed future files:

- `runtime/core/protocol.ts`
- `runtime/core/ops.ts`
- `runtime/core/transactions.ts`
- `runtime/core/priorities.ts`
- `runtime/core/checksums.ts`
- `runtime/core/errors.ts`
- `tests/runtime/protocol-validation.test.ts`
- `tests/runtime/checksum-fail-closed.test.ts`

No other runtime files are allowed in the first scaffold.

## Forbidden In First Scaffold

Explicitly forbidden:

- `runtime/worker/*`
- `runtime/main/*`
- scheduler implementation
- worker-entry implementation
- state-store implementation
- projection-engine implementation
- React/DOM integration
- Canvas/WebGPU
- benchmark harness
- browser capture tools
- async worker message loop
- actual rendering behavior
- product integration

## protocol.ts Scope

Future file: `runtime/core/protocol.ts`

Allowed:

- `ProtocolVersion` type/value.
- `MessageEnvelope` interface.
- `RuntimeMessage` union placeholder.
- `MainToWorkerMessage` placeholder.
- `WorkerToMainMessage` placeholder.
- `MessageType` enum/string union.
- `TraceContext` interface.
- `ValidationResult` type.
- pure validation helpers for envelope-level fail-closed checks.

Must not:

- route messages;
- mutate state;
- schedule transactions;
- create workers;
- touch DOM;
- import React.

## ops.ts Scope

Future file: `runtime/core/ops.ts`

Allowed interfaces:

- `AppendChunk`
- `SealBlock`
- `PatchRange`
- `AddMessage`
- `SetViewport`
- `RequestProjection`
- `CancelTransaction`
- `CommitProjectionAck`

Allowed:

- op type unions;
- required field definitions;
- bounded payload/reference definitions;
- checksum fields.

Must not:

- apply ops;
- store ops;
- replay ops;
- compute projections.

## transactions.ts Scope

Future file: `runtime/core/transactions.ts`

Allowed:

- `Transaction` interface.
- `TransactionType` union.
- `TransactionStatus` union.
- `TransactionResult` interface.
- `ProjectionContract` interface.
- `CancellationPolicy` union.
- `StalePolicy` union.

Must include:

- `txn_id`
- `parent_action_id`
- `op_ids`
- `priority`
- `deadline_ms`
- `budget_ms`
- `session_version`
- `visible_range`
- `dirty_ranges`
- `required_work_units`
- `cancellation_policy`
- `stale_policy`
- `result_version`
- `checksum`

Must not:

- implement scheduling;
- implement cancellation behavior;
- implement stale rejection behavior beyond type/validation helpers.

## priorities.ts Scope

Future file: `runtime/core/priorities.ts`

Allowed:

- `PriorityLane` union/enum:
  - `urgent-input`
  - `visible-projection`
  - `stream-update`
  - `background-indexing`
- priority ordering constant.
- pure `comparePriority` helper.
- pure `isPreemptibleBy` helper.

Must not:

- implement queue/scheduler;
- mutate transactions;
- run timers.

## checksums.ts Scope

Future file: `runtime/core/checksums.ts`

Allowed:

- branded/string/number types for:
  - `workload_source_hash`
  - `action_sequence_hash`
  - `worker_result_checksum`
  - `projection_checksum`
- `EquivalentWorkCounters` interface:
  - `module_flush_count`
  - `subscriber_notify_count`
  - `queue_drain_step_count`
  - `derived_selector_eval_count`
  - `state_nodes_touched_observed`
  - `derived_hash_rounds_observed`
  - `projection_update_count_observed`
- pure validation helpers checking presence/equality of counters.

Must not:

- implement production hash algorithm beyond deterministic test helper if needed.
- perform runtime work.
- hide missing counters.

## errors.ts Scope

Future file: `runtime/core/errors.ts`

Allowed:

- `RuntimeErrorCode` union/enum.
- `RuntimeError` interface.
- `safe_fallback` type.
- `recoverability` type.

Must include errors:

- `ProtocolVersionUnsupported`
- `MissingRequiredField`
- `InvalidChecksum`
- `StaleProjectionRejected`
- `WorkerCrashed`
- `WorkerTimeout`
- `TransactionCanceled`
- `ProjectionTooLarge`
- `BackpressureLimitExceeded`
- `EquivalenceMismatch`
- `UnknownMessageType`

Must not:

- implement recovery behavior;
- restart workers;
- interact with UI.

## Required First Tests

Future file: `tests/runtime/protocol-validation.test.ts`

Minimum cases:

- missing `protocol_version` fails closed.
- unsupported `protocol_version` fails closed.
- missing `message_id` fails closed.
- unknown `message_type` fails closed.
- duplicate `message_id` policy is explicit.

Future file: `tests/runtime/checksum-fail-closed.test.ts`

Minimum cases:

- missing `worker_result_checksum` fails closed in test mode.
- reduced `equivalent_work_counters` fail closed.
- invalid `projection_checksum` fails closed.
- `EquivalenceMismatch` error shape is produced.

## Source-Level Guardrails

The scaffold must prove:

- no imports from React.
- no DOM globals.
- no Worker constructor usage.
- no Canvas/WebGPU APIs.
- no timers or async scheduling.
- no benchmark/capture code.
- no P1 target imports.
- no product-specific code.

## Validation Commands For Future Scaffold

Proposed future commands, subject to repo environment:

- typecheck command
- test command
- grep/guard command for forbidden imports/APIs
- `git diff --stat` check to ensure only allowed files changed

If current repo lacks TypeScript/test setup, the future implementation proposal must first define the smallest config change needed.

Example guard intent for later review:

- search allowed scaffold files for `React`, `document`, `window`, `Worker`, `Canvas`, `WebGPU`, `setTimeout`, `queueMicrotask`, capture helpers, and P1 target imports.
- fail the scaffold review if any forbidden runtime surface appears.

## No-Go Criteria

Do not approve source scaffold if:

- environment choice is unresolved;
- test runner is undefined;
- scaffold includes worker/main behavior;
- scaffold includes scheduling behavior;
- scaffold includes rendering behavior;
- scaffold lacks fail-closed tests;
- files exceed core/schema scope;
- module boundaries conflict with existing P2 docs.

## Review Questions

- Are TypeScript and test environment accepted?
- Are first scaffold files too many or too few?
- Are validation helpers allowed, or should first scaffold be pure types only?
- Are checksum helpers allowed to compute deterministic test hashes?
- Are test files allowed in same step as type files?
- What command will prove no runtime behavior slipped in?

## Recommended Next Step

Choose B: add an environment/tooling decision doc first.

The scaffold proposal depends on TypeScript, a Node-based test runner, typecheck command, and guard commands. If those are not explicitly accepted, creating source files would prematurely mix environment decisions with runtime contract work.

After environment/tooling is confirmed, the next proposal may approve the type/schema-only scaffold and its fail-closed tests.

## Blocked

Explicitly blocked:

- runtime behavior implementation;
- worker runtime;
- scheduler implementation;
- projection engine;
- React/DOM integration;
- Canvas/WebGPU;
- product integration;
- allocation_probe;
- benchmark expansion;
- claiming final runtime success.

## Final Recommendation

Recommend a narrow type/schema-only scaffold only after environment/tooling is confirmed. If TypeScript/test setup is not already ready, create an environment/tooling decision doc before source files.
