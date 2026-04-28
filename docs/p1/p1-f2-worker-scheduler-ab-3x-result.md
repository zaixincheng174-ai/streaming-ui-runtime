# P1-F2 Worker Scheduler A/B 3x Result

## Decision

F2 A/B paired 3x is valid and scheduler-positive.
F2-B scheduled reduces urgent projection latency relative to F2-A monolithic while preserving equivalent structural work.

- `measured_count=6`
- `valid_a_count=3`
- `valid_b_count=3`
- `equivalence_a_pass=true`
- `equivalence_b_pass=true`
- `decision=F2_AB_3X_SCHEDULER_POSITIVE`

This is not P2 implementation authorization.

This is not product trace replay.

This is not final runtime success.

## Experiment Setup

F2 compares:

F2-A monolithic:

- `scheduler_mode=monolithic`
- `worker_chunk_size=all`
- `worker_yield_strategy=none`
- `worker_chunk_count=1`
- `worker_yield_count=0`
- `worker_preemptions=0`

F2-B scheduled:

- `scheduler_mode=scheduled`
- `worker_chunk_size=128`
- `worker_yield_strategy=message-channel`
- `worker_chunk_count=313`
- `worker_yield_count=312`
- `worker_preemptions=1`

## F2-A Aggregate Metrics

F2-A monolithic:

- `urgent_main_ack_latency_ms values=[23.2, 19.2, 20.4]`
- `urgent_main_ack_latency_ms min=19.2`
- `urgent_main_ack_latency_ms mean=20.933333333333334`
- `urgent_main_ack_latency_ms max=23.2`

- `urgent_end_to_end_visible_ms values=[25, 22.3, 21.3]`
- `urgent_end_to_end_visible_ms min=21.3`
- `urgent_end_to_end_visible_ms mean=22.866666666666667`
- `urgent_end_to_end_visible_ms max=25`

- `f2_main_max_task_ms values=[4.306, 2.086, 2.039]`
- `f2_main_max_task_ms min=2.039`
- `f2_main_max_task_ms mean=2.8103333333333333`
- `f2_main_max_task_ms max=4.306`

- `worker_heavy_txn_total_ms values=[26.5, 26.4, 27.5]`
- `worker_heavy_txn_total_ms min=26.4`
- `worker_heavy_txn_total_ms mean=26.8`
- `worker_heavy_txn_total_ms max=27.5`

## F2-B Aggregate Metrics

F2-B scheduled:

- `urgent_main_ack_latency_ms values=[1, 0.8, 0.9]`
- `urgent_main_ack_latency_ms min=0.8`
- `urgent_main_ack_latency_ms mean=0.9`
- `urgent_main_ack_latency_ms max=1`

- `urgent_end_to_end_visible_ms values=[3.6, 3, 3.4]`
- `urgent_end_to_end_visible_ms min=3`
- `urgent_end_to_end_visible_ms mean=3.3333333333333335`
- `urgent_end_to_end_visible_ms max=3.6`

- `f2_main_max_task_ms values=[2.339, 2.499, 2.296]`
- `f2_main_max_task_ms min=2.296`
- `f2_main_max_task_ms mean=2.378`
- `f2_main_max_task_ms max=2.499`

- `worker_heavy_txn_total_ms values=[50.2, 46.9, 48.5]`
- `worker_heavy_txn_total_ms min=46.9`
- `worker_heavy_txn_total_ms mean=48.53333333333333`
- `worker_heavy_txn_total_ms max=50.2`

- `worker_chunk_count values=[313, 313, 313]`
- `worker_yield_count values=[312, 312, 312]`
- `worker_preemptions values=[1, 1, 1]`

## Equivalent Work

Both arms preserve equivalent structural work:

- `module_flush_count=20`
- `subscriber_notify_count=1920`
- `queue_drain_step_count=5120`
- `derived_selector_eval_count=15360`
- `state_nodes_touched_observed=32768`
- `derived_hash_rounds_observed=131072`
- `projection_update_count_observed=6`
- `synthetic_pressure_multiplier=1`

## Main Result Table

| Metric | F2-A Monolithic | F2-B Scheduled | Interpretation |
|---|---:|---:|---|
| valid_count | 3/3 | 3/3 | both valid |
| urgent_main_ack_latency_ms mean | 20.933ms | 0.900ms | scheduled admits urgent work much sooner |
| urgent_end_to_end_visible_ms mean | 22.867ms | 3.333ms | scheduled visible response much faster |
| f2_main_max_task_ms mean | 2.810ms | 2.378ms | both keep main thread bounded |
| worker_heavy_txn_total_ms mean | 26.8ms | 48.533ms | scheduled pays chunk/yield overhead |
| worker_chunk_count | 1 | 313 | scheduled splits work |
| worker_yield_count | 0 | 312 | scheduled yields |
| worker_preemptions | 0 | 1 | scheduled admits urgent projection |

## Paired Deltas

| Pair | F2-A ack | F2-B ack | Ack delta | F2-A visible | F2-B visible | Visible delta |
|---|---:|---:|---:|---:|---:|---:|
| 01 | 23.2ms | 1.0ms | 22.2ms | 25.0ms | 3.6ms | 21.4ms |
| 02 | 19.2ms | 0.8ms | 18.4ms | 22.3ms | 3.0ms | 19.3ms |
| 03 | 20.4ms | 0.9ms | 19.5ms | 21.3ms | 3.4ms | 17.9ms |

All three paired deltas favor F2-B scheduled.

## Interpretation

F2-B demonstrates that worker-side chunking/yielding/preemption can reduce urgent projection acknowledgement and projection-commit latency relative to monolithic worker execution.

F2-B preserves equivalent structural work.

This supports worker-resident transaction scheduling and priority projection as a runtime direction.

This builds on F1: F1 established worker offload; F2 isolates worker-internal scheduling.

## Reviewer-Facing Caveats

### Throughput vs urgent-latency tradeoff

- F2-B scheduled is not faster in total worker compute.
- F2-A worker_heavy_txn_total_ms mean is about 26.8ms.
- F2-B worker_heavy_txn_total_ms mean is about 48.533ms.
- F2-B pays chunk/yield overhead.
- The positive result is urgent responsiveness, not total worker throughput.
- Safe claim: scheduled worker trades worker-side throughput for much lower urgent projection latency.

### Scheduled mode is not universally better

- F2-B is preferable when urgent visible responsiveness is prioritized.
- F2-B may be worse for pure throughput-only background work.
- The result supports priority scheduling, not a blanket claim that scheduled execution dominates monolithic execution in all cases.

### Single-urgent-request boundary

- Each F2 run injects one urgent visible projection request during heavy worker work.
- Therefore worker_preemptions=1 per scheduled run is expected.
- This result does not prove behavior under multiple simultaneous urgent requests.
- Multi-urgent stress remains future work.

### F2 isolates worker-internal scheduling, not offload itself

- F1 already tested main-thread vs worker-offloaded fanout.
- F2 compares monolithic worker execution against scheduled/chunked worker execution.
- F2’s question is whether worker-side transaction scheduling improves urgent projection latency after work is already off-main-thread.

### F2 is not primarily a main-thread long-task experiment

- Both F2-A and F2-B already run heavy work off-main-thread.
- Both keep main-thread tasks bounded.
- The differentiating metric is urgent projection latency, not main-thread long-task removal.
- Main-thread long-task removal was already established by F1 Worker B.

### Same-clock urgent metrics are the final A/B basis

- Final F2 A/B interpretation uses:
  - urgent_main_ack_latency_ms
  - urgent_end_to_end_visible_ms

- Worker-clock or mixed-clock fields are diagnostic only and must not be used for the final scheduler-positive claim.
- Diagnostic-only fields include:
  - urgent_main_to_worker_delay_ms
  - urgent_end_to_end_latency_ms
  - urgent_request_received_at_worker
  - urgent_worker_start_at
  - urgent_worker_done_at

### Commit latency is not full pixel/user-perceived latency

- urgent_end_to_end_visible_ms measures urgent request to main-thread projection commit completion.
- It does not include the full display pipeline, paint, compositor, or monitor scanout.
- Do not claim exact human-perceived pixel latency.
- Safe claim: F2-B reduces projection-commit latency / visible update commit latency.

### Controlled solution evidence, not product replay

- F2 is controlled solution evidence.
- It does not replay ChatGPT’s private implementation.
- Product evidence motivates the mechanism family, but F2 tests a controlled runtime protocol.
- Safe claim: F2 supports worker-resident transaction scheduling and priority projection as a runtime direction, not proof that the current product can be migrated without additional architecture work.

## Safe Claim

“In the controlled F2 workload, scheduled worker transaction processing reduces same-clock urgent projection acknowledgement and projection-commit latency relative to monolithic worker execution, while preserving equivalent structural work. This is scheduler-positive evidence, not product trace replay, not total throughput improvement, and not final runtime success.”

## What This Supports

- Worker-side transaction scheduling matters beyond basic worker offload.
- Urgent visible projection can be admitted during background worker work.
- Priority lanes / chunking / yields are justified runtime mechanisms.
- P2 runtime design should continue toward worker-resident transaction scheduling and bounded projection.

## What This Does Not Prove

- Not P2 implementation authorization.
- Not final runtime success.
- Not product trace replay.
- Not exact user-perceived pixel latency.
- Not generalization to every AI UI workload.
- Not proof that scheduled mode is always better than monolithic mode.
- Not Canvas/WebGPU relevance.

## Blocked

- More F2 parameter escalation.
- P2 implementation before core contracts and slices remain clean.
- Canvas/WebGPU implementation.
- `allocation_probe`.
- More DevTools collection.
- Claiming final runtime success.
