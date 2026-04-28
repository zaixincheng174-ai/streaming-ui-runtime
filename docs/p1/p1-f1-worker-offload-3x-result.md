# P1-F1 Worker-Offload 3x Result

## Decision

F1 Worker B 3x is valid and solution-positive.

This is the first controlled evidence that offloading equivalent fanout and derived work to a Worker removes the main-thread long task. It is not P2 authorization yet.

## Configuration

F1 used the same structural workload as F0-D:

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

## Aggregate Result

| Field | Value |
|---|---:|
| measured_count | 3 |
| valid_count | 3 |
| parity_fail_count | 0 |
| worker_equivalence_pass | true |
| main_thread_ok | true |
| decision | F1_WORKER_3X_SOLUTION_POSITIVE |

| Metric | Values | Mean |
|---|---:|---:|
| f1_main_run_task_max_ms | 4.164 / 1.964 / 1.909 | 2.679 |
| f1_main_long_task_count_50ms | 0 / 0 / 0 | 0 |
| f1_main_total_visible_update_ms | 2.2 / 1.9 / 1.9 | 2.0 |
| f1_worker_compute_ms | 52.6 / 50.6 / 50.9 | 51.367 |
| f1_worker_roundtrip_ms | 59.3 / 53.4 / 53.6 | 55.433 |

## Equivalence Check

All three runs preserved equivalent structural work:

| Field | Value |
|---|---:|
| worker_result_checksum | 3267955125 |
| worker_error | none |
| module_flush_count | 20 |
| subscriber_notify_count | 1920 |
| queue_drain_step_count | 5120 |
| derived_selector_eval_count | 15360 |
| state_nodes_touched | 32768 |
| derived_hash_rounds | 131072 |
| projection_update_count | 6 |

## F0-D Baseline Comparison

F0-D 3x was boundary-positive on the main thread:

| Metric | F0-D | F1 Worker B |
|---|---:|---:|
| main-thread max task mean | 68.633ms | 2.679ms |
| long task count per run | 1 | 0 |
| dominant work location | main-thread microtask/fanout | Worker compute |
| visible update | main-thread fanout path | about 2ms bounded projection |

F0-D mean `f0_run_task_max_ms` was about `68.633ms`; F1 mean main-thread max task was about `2.679ms`. F0-D produced one 50ms+ long task in every run; F1 produced zero 50ms+ main-thread long tasks in every run. F0-D kept microtask/fanout on the main thread; F1 moved the equivalent compute to the Worker and kept the visible main-thread update around `2ms`.

## Interpretation

Worker offload moves equivalent derived fanout work off the main thread. The main thread becomes bounded to dispatch plus projection commit.

This validates the Worker-offload direction as a solution-positive candidate. It supports the project's transaction, state partition, and scheduling thesis more than a renderer-first thesis.

## What This Does Not Prove

This result does not prove:

- P2 authorization.
- Product trace replay.
- Full runtime implementation.
- Canvas/WebGPU relevance.
- Generalization to all workloads.
- Final runtime success without broader baselines and paired A/B evaluation.

## Next Required Step

Do not continue parameter escalation. Do not implement P2 yet.

The next step should be a formal F0-D vs F1 Worker A/B comparison note, then a decision on whether to run paired A/B across broader cells or design P1-F2 transaction scheduler.

## Blocked

The following remain blocked:

- F0-E.
- More parameter escalation.
- P2 implementation.
- Canvas/WebGPU.
- allocation_probe.
- More DevTools collection.
- Claiming final runtime success.
