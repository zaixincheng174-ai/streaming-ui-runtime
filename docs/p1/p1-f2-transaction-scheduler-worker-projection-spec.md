# P1-F2 Transaction Scheduler And Worker Projection Protocol Spec

## Decision

F1 Worker B proved that equivalent off-main-thread fanout can remove the main-thread long task.

F2 is approved as a design step to test a reusable scheduler/projection protocol. F2 is not full runtime implementation and not P2.

## Evidence Basis

F0-D main-thread baseline creates a stable 50ms+ microtask/fanout long task. F1 Worker B removes the main-thread long task while preserving equivalent worker compute.

The remaining risk is that Worker offload alone may not handle concurrent urgent work, streaming, priority inversion, stale projections, or backpressure. F2 tests whether a reusable transaction scheduler can handle that risk without turning the F1 result into a one-off workload split.

## Core F2 Question

Can a worker-resident transaction scheduler preserve main-thread responsiveness while handling heavy background fanout and urgent visible projection requests under the same structural workload?

## F2 A/B Arms

### F2-A: Monolithic Worker Baseline

F2-A uses F1 Worker B behavior.

Heavy fanout runs as one worker transaction. An urgent projection request arriving during heavy work must wait behind it. This establishes the worker-side priority inversion baseline.

### F2-B: Scheduled Worker Transaction Protocol

F2-B uses the same heavy fanout work, but the Worker splits work into chunks. An urgent transaction can be admitted between chunks.

The scheduler uses priority lanes:

- `urgent-input`
- `visible-projection`
- `stream-update`
- `background-indexing`

The main thread receives bounded projection output. The Worker may continue background work after urgent visible projection is satisfied.

## Required Transaction Model

Each transaction must define:

- `txn_id`
- `parent_action_id`
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

## Priority And Scheduling Rules

Required rules:

- `urgent-input > visible-projection > stream-update > background-indexing`
- The scheduler must yield between chunks.
- No single worker chunk should exceed the configured budget unless explicitly marked non-preemptible.
- Stale transactions must not commit visible projection.
- Visible projection must be version-checked before commit.
- The main thread must never synchronously wait for Worker completion.

## Workload Equivalence

F2-A and F2-B must use the same structural workload as F1/F0-D:

| Field | Value |
|---|---:|
| session_size | 2500 |
| module_count | 20 |
| subscribers_per_module | 96 |
| fanout_width | 192 |
| queued_effect_count | 2048 |
| state_nodes_touched | 32768 |
| flush_batch_size | 2048 |
| commit_update_count | 4 |
| microtask_chain_length | 8 |
| payload_shape | derived-json |
| history_mount_size | 2500 |
| content_richness | derived |
| synthetic_pressure_multiplier | 1 |
| derived_work_enabled | true |
| selector_passes_per_subscriber | 8 |
| queue_drain_steps_per_module | 256 |
| state_read_stride | 7 |
| derived_hash_rounds | 4 |
| projection_update_count | 6 |

## New F2 Scenario

The F2 scenario:

1. Start a heavy background fanout transaction.
2. After a controlled delay, inject an urgent visible projection request.
3. Measure urgent request latency.
4. Require heavy work to still complete with equivalent counters/checksum.
5. Reject precompute before click.
6. Reject skipped work.
7. Reject reduced traversal.

## Metrics

Main-thread metrics:

- `main_thread_max_task_ms`
- `main_thread_long_task_count_50ms`
- `urgent_projection_visible_update_ms`
- `projection_commit_ms`
- `input_dispatch_ms`

Worker scheduler metrics:

- `worker_heavy_txn_total_ms`
- `worker_urgent_txn_latency_ms`
- `worker_urgent_wait_ms`
- `worker_chunk_count`
- `worker_max_chunk_ms`
- `worker_yield_count`
- `worker_preemptions`
- `worker_stale_txn_count`
- `worker_completed_txn_count`
- `worker_dropped_txn_count`
- `worker_equivalence_checksum`
- `worker_roundtrip_ms`

Equivalence metrics:

- `module_flush_count`
- `subscriber_notify_count`
- `queue_drain_step_count`
- `derived_selector_eval_count`
- `state_nodes_touched_observed`
- `derived_hash_rounds_observed`
- `projection_update_count_observed`

## Success Criteria

F2-B is successful only if:

- Equivalent heavy work is preserved.
- Urgent projection latency is lower than F2-A.
- Main-thread max task stays below `50ms`.
- No main-thread long tasks occur.
- Worker max chunk is bounded.
- Stale results are rejected.
- Visible projection remains correct.
- No synthetic pressure multiplier is used.

## Failure Criteria

F2-B fails if:

- It skips work.
- Urgent latency is not improved.
- The main thread waits synchronously.
- Projection correctness is unverifiable.
- A stale transaction commits.
- Parity fails.
- Worker chunking merely moves latency without improving urgent responsiveness.

## Minimal Implementation Slice After This Spec

The next implementation slice should:

- Add a P1-F2 target or extend the Worker target only if isolation is safe.
- Prefer a separate target: `bench/p1/targets/p1_worker_scheduler_projection_baseline.html`.
- Add scenario: `bench/p1/scenarios/p1_f2_worker_scheduler_projection.json`.
- Add audit: `scripts/p1/audit_p1f2_scheduler_projection.mjs`.
- Run no capture until no-capture and simulated audits pass.

## Blocked

The following remain blocked:

- P2 implementation.
- Canvas/WebGPU.
- allocation_probe.
- More F0/F1 parameter escalation.
- More DevTools collection.
- Claiming final runtime success.
- Implementation before this spec is reviewed.

## Final Recommendation

Implement the minimal F2 support slice next, after this spec is committed.

Do not ask for more evidence.
