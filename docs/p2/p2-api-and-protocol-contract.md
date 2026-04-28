# P2 API And Protocol Contract

## Decision

P2 implementation remains blocked.

This document defines the API/protocol boundary required before implementation.

The next allowed step after this doc is an interface skeleton plan, not runtime coding.

## Alignment With P2 Runtime Abstraction

The P2 runtime abstraction already defines worker-resident state, ops-stream, transactions, scheduler, and bounded projection.

This contract turns that abstraction into message schemas, validation rules, and fail-closed behavior.

## Protocol Boundary

The protocol boundary is:

- Main thread owns input/event shell and bounded visible projection commit.
- Worker owns session-scale state, op log, derived fanout, scheduling, and projection generation.
- Main thread never synchronously waits for worker.
- Worker never directly mutates DOM.
- All cross-thread communication is explicit message passing.

## Message Envelope

Every protocol message uses this envelope:

```ts
type ProtocolEnvelope<TPayload> = {
  protocol_version: string;
  message_id: string;
  message_type: string;
  parent_action_id: string;
  session_id: string;
  session_version: number;
  created_at_ms: number;
  priority: PriorityLane;
  source: "main" | "worker";
  target: "main" | "worker";
  payload: TPayload;
  checksum: string;
  trace_context: TraceContext;
};
```

Rules:

- `protocol_version` is mandatory.
- Unknown versions fail closed.
- Missing `message_id` fails closed.
- Duplicate `message_id` must be idempotent or rejected.

## Operation Schemas

```ts
type AppendChunk = {
  op_id: string;
  block_id: string;
  chunk_id: string;
  text_bytes_or_ref: string;
  append_offset: number;
  session_version: number;
  checksum: string;
};

type SealBlock = {
  op_id: string;
  block_id: string;
  final_length: number;
  checksum: string;
};

type PatchRange = {
  op_id: string;
  block_id: string;
  start_offset: number;
  end_offset: number;
  replacement_ref: string;
  checksum: string;
};

type AddMessage = {
  op_id: string;
  message_id: string;
  role: "system" | "user" | "assistant" | "tool";
  block_ids: string[];
  created_at_ms: number;
  checksum: string;
};

type SetViewport = {
  op_id: string;
  visible_range: VisibleRange;
  anchor: ViewportAnchor;
  viewport_version: number;
};

type RequestProjection = {
  op_id: string;
  visible_range: VisibleRange;
  priority: PriorityLane;
  deadline_ms: number;
  reason: string;
  session_version: number;
};

type CancelTransaction = {
  txn_id: string;
  reason: string;
  cancellation_policy: CancellationPolicy;
};

type CommitProjectionAck = {
  projection_id: string;
  result_version: number;
  committed_at_ms: number;
  status: "committed" | "rejected" | "stale";
};
```

## Transaction Schema

```ts
type Transaction = {
  txn_id: string;
  parent_action_id: string;
  op_ids: string[];
  transaction_type: TransactionType;
  priority: PriorityLane;
  deadline_ms: number;
  budget_ms: number;
  session_version: number;
  visible_range: VisibleRange;
  dirty_ranges: DirtyRange[];
  required_work_units: number;
  cancellation_policy: CancellationPolicy;
  stale_policy: StalePolicy;
  result_version: number;
  checksum: string;
  projection_contract: ProjectionContract;
  trace_context: TraceContext;
};

type TransactionType =
  | "urgent-input"
  | "visible-projection"
  | "stream-update"
  | "background-indexing"
  | "hydration-reconstruction"
  | "cleanup-compaction";
```

## Projection Result Schema

```ts
type ProjectionResult = {
  projection_id: string;
  txn_id: string;
  session_version: number;
  result_version: number;
  visible_range: VisibleRange;
  blocks: ProjectionBlock[];
  layout_hints: LayoutHints;
  anchor_update: ViewportAnchor;
  semantic_refs: SemanticRef[];
  checksum: string;
  equivalent_work_counters: EquivalentWorkCounters;
  committed_work_summary: CommittedWorkSummary;
  stale_status: "fresh" | "compatible" | "stale";
  error: ErrorReport | null;
};
```

Projection constraints:

- Bounded size.
- No full session transfer.
- No full history rerender.
- No unbounded subscriber callbacks on main thread.
- Must include version/checksum.

## Priority Lanes

Priority lanes:

- `urgent-input`
- `visible-projection`
- `stream-update`
- `background-indexing`

Rules:

- `urgent-input > visible-projection > stream-update > background-indexing`.
- `urgent-input` may preempt `background-indexing`.
- `visible-projection` may preempt `stream-update` and `background-indexing`.
- `stream-update` cannot block `urgent-input`.
- `background-indexing` must yield.
- Starvation control must exist for background work.

## Scheduling Contract

The scheduling contract defines:

- `chunk_budget_ms`
- `max_worker_chunk_ms`
- `yield_strategy`
- admission policy
- preemption policy
- cancellation policy
- stale rejection policy
- backpressure policy

Required behavior:

- Worker chunks yield between budgets.
- Urgent projection admitted between chunks.
- Stale result cannot commit.
- Transaction may be canceled before visible commit.
- Main thread must not block waiting for worker completion.

## Versioning And Stale Result Rules

Rules:

- `session_version` is monotonic.
- Projection result with older `session_version` must be rejected unless explicitly marked compatible.
- `result_version` must be monotonic per projection stream.
- Stale visible projection must not commit.
- Main thread must verify version before commit.
- Worker must include `stale_status`.

## Equivalence And Checksum Contract

Required hashes/checksums:

- `workload_source_hash`
- `action_sequence_hash`
- `worker_result_checksum`
- `projection_checksum`
- `equivalent_work_counters`

Required counters:

- `module_flush_count`
- `subscriber_notify_count`
- `queue_drain_step_count`
- `derived_selector_eval_count`
- `state_nodes_touched_observed`
- `derived_hash_rounds_observed`
- `projection_update_count_observed`

These are test/audit counters, not necessarily production telemetry.

Missing checksum fails closed in test mode.

Reduced counters fail closed.

## Error Contract

Error types:

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

Each error must include:

- `error_code`
- `message_id`
- `txn_id` if applicable
- `recoverability`
- `safe_fallback`
- `trace_context`

## Backpressure Contract

Backpressure fields and policies:

- `max_pending_transactions`
- `max_pending_bytes`
- `max_projection_result_bytes`
- `max_uncommitted_projection_count`
- `stream_update_drop_or_merge_policy`
- `background_queue_throttle_policy`

Stream updates may be coalesced only if semantic equivalence is preserved.

`urgent-input` cannot be dropped.

`visible-projection` cannot be starved.

## Main Thread API Surface

API methods:

```ts
function initRuntime(config: RuntimeConfig): RuntimeHandle;
function dispatchOp(op: RuntimeOperation): DispatchResult;
function requestProjection(range: VisibleRange, priority: PriorityLane): ProjectionRequestHandle;
function cancelTransaction(txn_id: string): CancelResult;
function commitProjection(projection: ProjectionResult): CommitResult;
function acknowledgeProjection(projection_id: string): AckResult;
function reportVisibilityState(state: VisibilityState): void;
function shutdownRuntime(): Promise<void>;
```

This is API contract only, not implementation.

## Worker API Surface

Worker message handlers:

- `onInit`
- `onOperation`
- `onTransaction`
- `onProjectionRequest`
- `onCancel`
- `onViewportChange`
- `onVisibilityChange`
- `onShutdown`

Worker must respond with:

- `ProjectionResult`
- `TransactionStatus`
- `ErrorReport`
- `MetricsSnapshot`

## Measurement Fields

Future implementation must report:

- `main_thread_max_task_ms`
- `main_thread_long_task_count_50ms`
- `urgent_ack_latency_ms`
- `urgent_end_to_end_visible_ms`
- `projection_commit_ms`
- `worker_compute_ms`
- `worker_chunk_count`
- `worker_yield_count`
- `worker_preemptions`
- `stale_txn_count`
- `completed_txn_count`
- `dropped_txn_count`
- equivalence counters/checksums
- `visibility_frame_parity_status`

## Minimal Test Matrix Before Implementation

Required protocol tests:

- Missing `protocol_version` fails closed.
- Unsupported `protocol_version` fails closed.
- Duplicate `message_id` is idempotent or rejected.
- Stale projection rejected.
- Checksum mismatch rejected.
- Reduced equivalence counters rejected.
- Urgent projection preempts background chunk.
- Background work eventually completes.
- Worker crash produces recoverable error.
- Projection too large rejected.
- Main thread never synchronously waits.

## Implementation Gate

P2 implementation can only start after:

- This API/protocol contract is reviewed.
- Message schemas are approved.
- Correctness invariants are mapped to tests.
- Minimal interface skeleton plan is written.
- Fail-closed tests are listed.
- Scope boundary is accepted.

## Blocked

The following remain blocked:

- Runtime implementation.
- Canvas/WebGPU.
- DOM renderer replacement.
- Product integration.
- `allocation_probe`.
- More F0/F1/F2 parameter escalation.
- Claiming final runtime success.

## Final Recommendation

The next document should be P2 minimal interface skeleton plan. It should define files/classes/modules to create later, but still not implement runtime behavior.
