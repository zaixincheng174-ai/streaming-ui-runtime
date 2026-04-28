# P2 Minimal Interface Skeleton Plan

## Decision

P2 implementation remains blocked.

This document only defines a future file/module/interface skeleton. It translates the P2 runtime abstraction and API/protocol contract into reviewable module boundaries for a later implementation.

The next allowed step after this document is review of the skeleton plan, not runtime coding.

## Alignment With P2 Contract

The P2 runtime abstraction defines worker-resident state, an ops-stream, a transaction scheduler, a projection protocol, and correctness invariants.

The P2 API/protocol contract defines message schemas, fail-closed behavior, protocol versioning, checksums, equivalence counters, backpressure rules, and test gates.

This skeleton plan maps those concepts into future files and modules so the implementation can later start from explicit boundaries rather than ad hoc runtime code.

## Non-Implementation Boundary

Do not create source files in this task.

Do not implement runtime behavior.

Do not implement workers.

Do not implement React bindings.

Do not implement Canvas/WebGPU.

Do not write benchmark code.

Do not modify existing P1 targets.

This is a planning artifact only.

## Proposed Future Directory Layout

Proposed future layout:

```text
runtime/
  core/
    protocol.ts
    ops.ts
    transactions.ts
    priorities.ts
    checksums.ts
    errors.ts
  worker/
    worker-entry.ts
    state-store.ts
    op-log.ts
    scheduler.ts
    projection-engine.ts
    backpressure.ts
  main/
    runtime-client.ts
    projection-bridge.ts
    visibility-controller.ts
    input-dispatch.ts
  testing/
    protocol-fixtures.ts
    equivalence-fixtures.ts
    scheduler-fixtures.ts
    failure-fixtures.ts

tests/
  runtime/
    protocol-validation.test.ts
    stale-projection.test.ts
    checksum-fail-closed.test.ts
    scheduler-priority.test.ts
    backpressure.test.ts
    worker-crash-recovery.test.ts
```

This is proposed layout only, subject to review before implementation.

## Core Protocol Module

Future file: `runtime/core/protocol.ts`

It should define:

- `ProtocolVersion`
- `MessageEnvelope`
- `RuntimeMessage`
- `MainToWorkerMessage`
- `WorkerToMainMessage`
- `MessageType`
- `TraceContext`
- validation result types

Responsibilities:

- schema-level validation;
- `protocol_version` checking;
- `message_id` checking;
- unknown message fail-closed behavior;
- envelope normalization.

Non-responsibilities:

- no scheduling;
- no state mutation;
- no DOM interaction.

## Operation Model Module

Future file: `runtime/core/ops.ts`

It should define interfaces for:

- `AppendChunk`
- `SealBlock`
- `PatchRange`
- `AddMessage`
- `SetViewport`
- `RequestProjection`
- `CancelTransaction`
- `CommitProjectionAck`

Each op must include:

- `op_id`
- `parent_action_id` where relevant
- `session_version`
- `checksum`
- priority or priority source
- payload reference or bounded payload

The operation model should describe the ops-stream contract only. It should not own scheduler behavior, worker state mutation, or projection commit behavior.

## Transaction Model Module

Future file: `runtime/core/transactions.ts`

It should define:

- `Transaction`
- `TransactionType`
- `TransactionStatus`
- `TransactionResult`
- `ProjectionContract`
- `CancellationPolicy`
- `StalePolicy`

Required fields:

- `txn_id`
- `parent_action_id`
- `op_ids`
- `transaction_type`
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

The transaction model should be shared by main-thread and worker modules so both sides validate the same contract before behavior is implemented.

## Priority Model Module

Future file: `runtime/core/priorities.ts`

It should define:

- `PriorityLane`
- priority ordering: `urgent-input > visible-projection > stream-update > background-indexing`
- lane comparison helpers
- starvation guard policy
- preemption eligibility rules

This module should not implement runtime scheduling yet. It should only define shared priority semantics and helper contracts for later scheduler implementation.

## Checksum And Equivalence Module

Future file: `runtime/core/checksums.ts`

It should define:

- `workload_source_hash` type
- `action_sequence_hash` type
- `worker_result_checksum` type
- `projection_checksum` type
- `equivalent_work_counters` type

Counters:

- `module_flush_count`
- `subscriber_notify_count`
- `queue_drain_step_count`
- `derived_selector_eval_count`
- `state_nodes_touched_observed`
- `derived_hash_rounds_observed`
- `projection_update_count_observed`

Purpose:

Support future tests that prove work was not skipped or reduced. These counters are test and audit primitives first; production telemetry choices should be reviewed separately.

## Error Model Module

Future file: `runtime/core/errors.ts`

It should define:

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

Each error must carry:

- `error_code`
- `message_id`
- `txn_id` if applicable
- `recoverability`
- `safe_fallback`
- `trace_context`

The error model should make fail-closed behavior explicit and testable before worker/main runtime code exists.

## Worker State Store Module

Future file: `runtime/worker/state-store.ts`

Responsibilities:

- own session-scale state;
- own message/block store;
- maintain `session_version`;
- expose bounded state access for projection;
- support append-heavy and tail-mutating workloads.

Non-responsibilities:

- no DOM;
- no React;
- no main-thread projection commit.

## Worker Op Log Module

Future file: `runtime/worker/op-log.ts`

Responsibilities:

- append ops;
- preserve order;
- support replay for deterministic tests;
- expose workload/source hashes;
- support compaction only after correctness rules are defined.

The op log should be the auditable source for deterministic replay and equivalence checks. It should not decide projection priority or visible commit policy.

## Worker Scheduler Module

Future file: `runtime/worker/scheduler.ts`

Responsibilities:

- transaction admission;
- priority lane scheduling;
- chunk budgeting;
- yielding;
- preemption;
- cancellation;
- stale transaction handling;
- backpressure response.

Required invariants:

- urgent-input and visible-projection cannot be blocked behind unbounded background work;
- stale visible projection must not commit;
- main thread must never synchronously wait.

The scheduler should consume shared transaction and priority contracts from `runtime/core`, not define private local variants.

## Projection Engine Module

Future file: `runtime/worker/projection-engine.ts`

Responsibilities:

- compute bounded visible projection;
- honor `visible_range`;
- produce projection checksum;
- include `projection_version` / `result_version`;
- avoid full session transfer;
- avoid full history rerender;
- prepare small projection result for main thread.

The projection engine should not directly commit UI. It should return a bounded projection result for the main-thread bridge to validate and commit.

## Backpressure Module

Future file: `runtime/worker/backpressure.ts`

Responsibilities:

- enforce `max_pending_transactions`;
- enforce `max_pending_bytes`;
- enforce `max_projection_result_bytes`;
- define stream update merge/drop policy under semantic equivalence;
- throttle background work;
- never drop urgent-input.

Backpressure policy must be observable through metrics and fail-closed tests before broader runtime behavior is added.

## Worker Entry Module

Future file: `runtime/worker/worker-entry.ts`

Responsibilities:

- receive `MainToWorkerMessage`;
- validate protocol envelope;
- route operations/transactions/projection requests;
- report `WorkerToMainMessage`;
- report `ErrorReport`;
- expose `MetricsSnapshot`.

This planning task should not implement actual runtime behavior. Later implementation must keep worker entry thin and route through validated core modules.

## Main Runtime Client Module

Future file: `runtime/main/runtime-client.ts`

Responsibilities:

- initialize worker runtime;
- dispatch ops;
- request projections;
- cancel transactions;
- receive projection results;
- surface errors and metrics;
- maintain client-side session reference.

Must not:

- run session-scale derived fanout;
- synchronously wait for worker.

## Main Projection Bridge Module

Future file: `runtime/main/projection-bridge.ts`

Responsibilities:

- validate projection result version/checksum;
- reject stale projection;
- commit bounded visible projection to shell;
- acknowledge commit;
- measure `projection_commit_ms`.

This module is the future bridge to the React/DOM shell, not a renderer backend.

## Input Dispatch Module

Future file: `runtime/main/input-dispatch.ts`

Responsibilities:

- capture input/click/scroll action;
- create `parent_action_id`;
- dispatch urgent-input / visible-projection ops;
- measure `urgent_ack_latency_ms` and `urgent_end_to_end_visible_ms`.

Input dispatch should create action identity and timing evidence. It should not perform session-scale state traversal or derived fanout on the main thread.

## Visibility Controller Module

Future file: `runtime/main/visibility-controller.ts`

Responsibilities:

- report visibility state;
- protect measurement validity;
- support viewport/visible range changes;
- interact with projection request policy.

The visibility controller should help preserve parity and viewport correctness. It should not own worker scheduling or projection computation.

## Testing Skeleton

Future file: `tests/runtime/protocol-validation.test.ts`

Purpose: verify message envelope validation, required fields, protocol version handling, unknown message rejection, and duplicate `message_id` idempotency or rejection.

Minimum cases:

- missing `protocol_version` fails closed;
- unsupported `protocol_version` fails closed;
- missing `message_id` fails closed;
- unknown `message_type` fails closed.

Future file: `tests/runtime/stale-projection.test.ts`

Purpose: verify stale visible projection rejection and version monotonicity.

Minimum cases:

- older `session_version` is rejected;
- non-monotonic `result_version` is rejected;
- compatible stale result requires explicit compatibility flag;
- rejected projection is not committed.

Future file: `tests/runtime/checksum-fail-closed.test.ts`

Purpose: verify checksum and equivalence counter enforcement.

Minimum cases:

- invalid projection checksum is rejected;
- missing worker checksum fails closed in test mode;
- reduced equivalence counters fail closed;
- checksum mismatch emits an `EquivalenceMismatch` error.

Future file: `tests/runtime/scheduler-priority.test.ts`

Purpose: verify priority order, preemption eligibility, and urgent projection admission.

Minimum cases:

- urgent-input outranks visible-projection;
- visible-projection outranks stream-update and background-indexing;
- background chunk yields before urgent projection admission;
- background work eventually completes under starvation guard.

Future file: `tests/runtime/backpressure.test.ts`

Purpose: verify transaction, byte, and projection result limits.

Minimum cases:

- `max_pending_transactions` is enforced;
- `max_pending_bytes` is enforced;
- oversized projection is rejected;
- stream update merge/drop policy preserves semantic equivalence;
- urgent-input is not dropped.

Future file: `tests/runtime/worker-crash-recovery.test.ts`

Purpose: verify crash reporting, safe fallback, and recoverability contracts.

Minimum cases:

- worker crash emits `WorkerCrashed`;
- pending transactions are reported or canceled;
- safe fallback is declared;
- main thread does not synchronously wait during recovery.

Do not implement tests in this planning task.

## Minimal Implementation Order Later

Future implementation order:

1. core type/schema-only modules;
2. protocol validation tests;
3. checksum/equivalence fixtures;
4. worker state/op-log skeleton;
5. scheduler skeleton;
6. projection bridge skeleton;
7. worker/main message loop;
8. minimal P2 synthetic harness;
9. only then consider P3 Canvas/OffscreenCanvas presentation.

This order keeps correctness and protocol boundaries ahead of runtime behavior.

## Implementation Gate Checklist

Implementation may begin only after:

- this skeleton plan is reviewed;
- module boundaries are accepted;
- TypeScript/environment choice is approved;
- test matrix is accepted;
- failure-mode tests are specified;
- no-go criteria are defined.

Until those items are accepted, P2 remains in design/spec mode.

## Blocked

Explicitly blocked:

- creating runtime source files in this task;
- P2 implementation before approval;
- Canvas/WebGPU;
- product integration;
- allocation_probe;
- replacing DOM renderer;
- F0/F1/F2 parameter escalation;
- claiming final runtime success.

## Final Recommendation

Choose A: P2 implementation readiness checklist.

The readiness checklist should come before a type/schema-only scaffold proposal because it can lock the remaining gates without creating source files prematurely. It should confirm environment choice, module boundaries, no-go criteria, failure-mode tests, and the smallest acceptable first scaffold before any runtime code is created.
