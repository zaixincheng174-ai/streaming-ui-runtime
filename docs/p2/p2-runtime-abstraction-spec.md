# P2 Runtime Abstraction Spec

## Decision

P2 design/spec gate is open.

P2 implementation remains blocked.

The project should now define runtime primitives: ops-stream, transactions, worker-resident state, scheduler, projection protocol, and correctness invariants.

Canvas/WebGPU remains blocked until the runtime abstraction is defined.

## Evidence Basis From P1

P1 provides the evidence basis for P2 design:

- Product evidence: `click/pointerup -> Run microtasks -> state/context/fanout coordination`.
- F0-D: controlled main-thread bottleneck reproduction.
- F1: Worker offload solution-positive result.
- F2: transaction scheduler/projection scheduler-positive result.

## Core Runtime Thesis

Long-lived AI surfaces should not treat the DOM/VDOM tree as the source of truth for append-heavy, long-lived, viewport-centric workloads.

The runtime should maintain a worker-resident operation/state model and commit bounded visible projections to the main thread.

## Runtime Architecture Overview

The P2 runtime abstraction has these components:

- Main-thread shell.
- Worker-resident state store.
- Op log / ops-stream.
- Transaction scheduler.
- Projection engine.
- Main-thread projection commit bridge.
- Measurement and equivalence layer.

## Ops-Stream Model

Operation types:

- `AppendChunk`
- `SealBlock`
- `PatchRange`
- `AddMessage`
- `UpdateMessage`
- `SetViewport`
- `SetVisibleRange`
- `RequestProjection`
- `CancelTransaction`
- `CommitProjection`
- `AckProjection`

Each operation must define:

- `op_id`
- `parent_action_id`
- `session_version`
- target range/block
- priority
- payload checksum
- expected visibility impact

## Transaction Model

Transaction fields:

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
- `result_version`
- `checksum`
- `projection_contract`

Transaction types:

- `urgent-input`
- `visible-projection`
- `stream-update`
- `background-indexing`
- `hydration/reconstruction`
- `cleanup/compaction`

## Priority Lanes And Scheduling Rules

Priority lanes:

`urgent-input > visible-projection > stream-update > background-indexing`

Scheduling rules:

- `urgent-input` and `visible-projection` may preempt background work.
- Background work must be chunked.
- Worker chunks must yield.
- The main thread must never synchronously wait for Worker completion.
- Stale transactions cannot commit.
- The scheduler must preserve equivalence counters/checksums.
- The scheduler must support cancellation and backpressure.

## Worker-Resident State Model

The Worker-resident state model includes:

- Session store.
- Message/block store.
- Derived selector cache.
- Queue drain model.
- State versioning.
- Visibility index.
- Dirty range index.
- Projection cache.

State must support:

- Append-heavy updates.
- Tail mutation.
- Long-lived session growth.
- Viewport projection.
- Deterministic checksums.

## Projection Protocol

The projection protocol defines:

- Visible projection request.
- Projection result.
- Projection checksum.
- `projection_version`.
- Projection visible range.
- Stale rejection.
- Bounded main-thread commit.
- React/DOM shell integration boundary.

Projection result must be small and bounded:

- No full session transfer.
- No full history rerender.
- No unbounded subscriber callbacks on main thread.

## Main-Thread Contract

Main thread may:

- Capture input/scroll events.
- Dispatch ops to Worker.
- Receive bounded projections.
- Commit visible projection.
- Maintain focus/caret/control shell.

Main thread must not:

- Run session-scale fanout.
- Synchronously wait for Worker.
- Hold full derived state.
- Perform unbounded subscriber notification.
- Commit stale projection results.

## Correctness Invariants

P2 correctness depends on these invariants:

- Equivalent work invariant: Worker-side work must preserve approved counters/checksums for the configured transaction.
- No-skipped-work invariant: modules, subscribers, state traversal, queue drain, and projection work cannot be silently reduced.
- No-stale-visible-commit invariant: stale projection results must be rejected before visible commit.
- Bounded-main-thread-commit invariant: visible commits must remain bounded and cannot transfer full session work back to the main thread.
- Priority-order invariant: higher-priority lanes must be admitted ahead of lower-priority background work at yield boundaries.
- Version monotonicity invariant: session and projection versions must only advance through accepted transactions.
- Projection checksum invariant: visible projection payloads must carry deterministic checksums.
- Cancellation correctness invariant: canceled transactions cannot produce visible commits unless explicitly revalidated.
- Backpressure correctness invariant: overload handling must preserve priority and correctness rather than silently dropping required work.

## Measurement Contract

Future implementation must report:

- `main_thread_max_task_ms`
- `main_thread_long_task_count_50ms`
- `urgent_ack_latency_ms`
- `urgent_end_to_end_visible_ms`
- `worker_compute_ms`
- `worker_chunk_count`
- `worker_yield_count`
- `worker_preemptions`
- `stale_txn_count`
- `completed_txn_count`
- `dropped_txn_count`
- `projection_commit_ms`
- equivalence counters/checksums
- visibility/frame parity

## Failure Modes

P2 design must explicitly handle:

- Worker overload.
- Message serialization overhead.
- Projection result too large.
- Stale result commit.
- Priority inversion.
- Background starvation.
- Main-thread projection commit becomes bottleneck.
- Cross-thread timing mistakes.
- Equivalence counter mismatch.
- Worker crash / recovery.
- Memory growth / cache retention.

## Relationship To Canvas/WebGPU

Canvas/WebGPU is not P2.

Renderer backend remains secondary.

Canvas/OffscreenCanvas may become P3 once P2 runtime abstraction is stable.

WebGPU remains ceiling backend, not current thesis.

## Relationship To React/DOM

React/DOM may remain as main-thread shell.

Runtime aims to avoid session-scale state/fanout on main thread.

This is not a claim that React universally fails.

This is a scoped runtime for long-lived AI surfaces.

## P2 Implementation Gate

Before coding P2 implementation, the project must have:

- Approved abstraction spec.
- Minimal API contract.
- Correctness invariants.
- Test matrix.
- Failure-mode tests.
- Benchmark plan.
- No-go criteria.
- Scope boundary.

## Blocked

The following remain blocked:

- P2 implementation before this spec is reviewed.
- Canvas/WebGPU implementation.
- `allocation_probe`.
- Product integration.
- More F0/F1/F2 parameter escalation.
- Claiming final runtime success.

## Final Recommendation

The next step after this spec should be a narrow P2 API/protocol contract document or minimal interface skeleton plan, not runtime implementation.
