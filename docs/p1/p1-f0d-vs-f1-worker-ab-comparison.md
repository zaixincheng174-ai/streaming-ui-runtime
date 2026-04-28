# P1 F0-D vs F1 Worker-Offload A/B Comparison

## Decision

F0-D vs F1 Worker B is solution-positive.

F0-D reproduces a stable main-thread microtask/fanout long task. F1 Worker B performs equivalent structural work in a Worker and removes the main-thread long task. This is not P2 authorization yet.

## Evidence Inputs

This comparison uses the existing result and evidence notes:

- `docs/p1/p1-f0d-product-range-3x-result.md`
- `docs/p1/p1-f0d-product-range-3x-attribution.md`
- `docs/p1/p1-f1-worker-offload-3x-result.md`
- `docs/p0/p0-product-click-ownership-decomposition.md`

## Workload Equivalence

F0-D and F1 Worker B use the same structural workload:

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

## Main Result Table

| Metric | F0-D Main Thread | F1 Worker B | Interpretation |
|---|---:|---:|---|
| valid_count | 3/3 | 3/3 | both valid |
| parity_fail_count | 0 | 0 | both measurement-valid |
| f0/f1 main max task mean | 68.633ms | 2.679ms | main-thread long task removed |
| long task count | 1 per run | 0 per run | long task cleared |
| main visible update | F0-D main flush window ~=66.987ms microtask | ~=2.0ms visible update | main thread bounded |
| worker compute | none | ~=51.367ms | work moved off main thread |
| worker roundtrip | none | ~=55.433ms | async cost preserved off-main |

## F0-D Baseline Summary

F0-D 3x:

- `measured_count=3`
- `valid_count=3`
- `boundary_positive_count=3`
- `f0_window_ms` mean `73.764ms`
- `f0_microtask_window_ms` mean `66.987ms`
- `f0_run_task_max_ms` mean `68.633ms`
- `f0_long_task_count_50ms=[1,1,1]`

Attribution shows the long task is dominated by microtask/flush target work, not React commit, layout/paint/style, or GC.

## F1 Worker B Summary

F1 Worker B 3x:

- `measured_count=3`
- `valid_count=3`
- `worker_equivalence_pass=true`
- `main_thread_ok=true`
- `f1_main_run_task_max_ms=[4.164,1.964,1.909]`, mean `2.679ms`
- `f1_main_long_task_count_50ms=[0,0,0]`
- `f1_main_total_visible_update_ms` mean `2.0ms`
- `f1_worker_compute_ms` mean `51.367ms`
- `f1_worker_roundtrip_ms` mean `55.433ms`

Worker counters match the F0-D structure.

## Timing Reconciliation

F0-D main-thread `f0_run_task_max_ms` mean is approximately `68.633ms`. F0-D `f0_microtask_window_ms` mean is approximately `66.987ms`.

F1 Worker B `f1_worker_compute_ms` mean is approximately `51.367ms`, and `f1_worker_roundtrip_ms` mean is approximately `55.433ms`. F1 main visible update mean is approximately `2.0ms`.

Worker compute is about `17ms` lower than the F0-D main-thread max task. This difference should not be overread as exact timing equivalence. Plausible contributors include:

- Different execution environment between Worker and main thread.
- Main-thread-specific overhead in F0-D.
- Cache, JIT, or GC differences.
- Possible minor differences in execution path despite equivalent counters.

The equivalence claim is structural, counter-based, and checksum-based. It is not cycle-identical execution.

## Parameter Grounding

F0-D parameters are structurally motivated. They are not exact ChatGPT reverse engineering.

Product evidence showed multi-bundle coordination, state/context propagation hints, Run microtasks dominance, and subscriber/fanout-like behavior. F0-D maps that evidence into a controlled approximation:

- `module_count=20` approximates multi-bundle/module coordination.
- `subscribers_per_module=96` creates `1920` subscriber notifications.
- `queue_drain_steps_per_module=256` approximates queue/cascade depth.
- Derived selector, hash, and state traversal work models context/state propagation.

F0-D reproduces a mechanism family, not a private product implementation.

## Measurement Validity

All accepted F0-D and F1 Worker B samples used the visibility/frame parity gate.

Accepted samples required:

- `visibility_frame_probe_status=ok`
- `visibility_frame_parity_status=pass` or `pass_with_warning`
- `p0:capture:end` observed
- `config_valid=true`
- `capture_allowed=true`
- Complete F0/F1 marks and counters

Captures failing visibility/frame parity or incomplete mark/counter contracts are excluded from result interpretation.

## Magnitude Caveat

F0-D produces stable `50-70ms` main-thread long tasks. Product traces included larger `400-650ms` bursts.

Therefore F0-D is a smaller controlled reproduction of the mechanism family. Plausible reasons include:

- F0-D parameters may undershoot product internal scale.
- Product includes additional systems not modeled, such as telemetry, feature flags, product queues, richer state graphs, and private framework internals.
- Product traces include minified multi-bundle behavior not exactly reproduced.

The smaller magnitude is sufficient for testing the Worker-offload solution lever. It is not sufficient to claim quantitative product replay.

## Worker-Offload Scope Limitation

F1 Worker B offloads derived computation: selectors, queue drain, state traversal, hash rounds, and projection preparation.

It does not offload:

- DOM commit.
- Browser layout/paint.
- React/framework reconciliation that must remain on main thread.
- Subscriber callbacks that directly touch DOM.
- Any synchronous product logic that must continue on main thread.

Worker offload is validated as a solution lever for pure/derived/session-scale fanout work. It is not a universal fix for all main-thread costs.

## Reviewer-Facing Claim Boundary

The safe claim is:

"In a controlled production React workload modeling action-triggered derived fanout, moving equivalent derived fanout work to a Worker reduces main-thread max task from ~68.6ms to ~2.7ms and removes 50ms+ main-thread long tasks. This supports worker-resident state/fanout scheduling as a runtime direction, but does not prove product trace replay or final runtime generality."

## Mechanism Interpretation

F0-D shows that main-thread microtask/derived fanout can create a stable boundary. F1 shows equivalent work can be moved to a Worker while keeping main-thread projection bounded.

This supports a state/fanout/scheduling runtime direction. It weakens a renderer-first interpretation.

## What This Supports

This A/B supports:

- Action-triggered fanout/derived work is a real controlled bottleneck.
- Worker offload is a credible solution lever.
- Transaction/state partitioning is now a justified next design direction.
- Canvas/WebGPU is not the immediate next lever.

## What This Does Not Prove

This A/B does not prove:

- Product trace replay.
- Final runtime success.
- P2 authorization.
- Generalization to all AI UI workloads.
- React fails generally.
- Canvas/WebGPU is irrelevant forever.
- Worker offload solves presentation/layout-heavy cases.

## Next Gate

Do not run more F0/F1 captures immediately.

The next step should be P1-F2 design: transaction scheduler / worker projection protocol. An alternative acceptable next step is a broader A/B workload plan, but only after this comparison is reviewed.

P2 remains blocked until broader baseline and workload coverage exists.

## Blocked

The following remain blocked:

- F0-E parameter escalation.
- More DevTools collection.
- P2 implementation.
- Canvas/WebGPU implementation.
- allocation_probe.
- Claiming final runtime success.

## Final Recommendation

F0-D vs F1 Worker B should be treated as the project's first controlled problem-solution closure. It justifies moving from evidence gathering to transaction/state-partition design, but not yet full runtime implementation.
