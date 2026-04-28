# F1 Worker Offload v0

## Purpose of This Section

F0-D establishes a controlled main-thread bottleneck. F1 tests whether equivalent derived fanout work can be moved off the main thread, preserving structural work while reducing main-thread long tasks.

This section should present worker offload as a solution lever for the controlled F0-D mechanism, not as a claim that all UI work can move to a Worker or that the product has been migrated.

## Research Question

Can equivalent derived fanout / queue drain / state traversal work be moved to a Worker so that main-thread long tasks disappear, without skipping or reducing the structural workload?

The question has two parts. First, does offload remove the reproduced main-thread long task? Second, does the worker path preserve the structural work that made the F0-D baseline meaningful?

## Experimental Setup

F1 Worker B is compared against the F0-D main-thread baseline. F1 keeps the structural workload equivalent while moving heavy derived fanout work to a Worker.

The main thread receives bounded projection / visible update work. F1 does not claim a renderer backend change. It does not use Canvas/WebGPU, and it does not replay product internals.

Equivalent work signals preserved in F1 include:

- module count preserved;
- subscriber notify count preserved;
- queue drain steps preserved;
- derived selector eval count preserved;
- state nodes touched preserved;
- derived hash rounds preserved;
- projection update count preserved;
- worker checksum / equivalence counters preserved.

F1 uses the same structural workload as F0-D:

| Field | Value |
|---|---:|
| `session_size` | `2500` |
| `module_count` | `20` |
| `subscribers_per_module` | `96` |
| `fanout_width` | `192` |
| `queued_effect_count` | `2048` |
| `state_nodes_touched` | `32768` |
| `flush_batch_size` | `2048` |
| `commit_update_count` | `4` |
| `microtask_chain_length` | `8` |
| `payload_shape` | `derived-json` |
| `history_mount_size` | `2500` |
| `content_richness` | `derived` |
| `synthetic_pressure_multiplier` | `1` |
| `derived_work_enabled` | `true` |
| `selector_passes_per_subscriber` | `8` |
| `queue_drain_steps_per_module` | `256` |
| `state_read_stride` | `7` |
| `derived_hash_rounds` | `4` |
| `projection_update_count` | `6` |

F1 equivalence counters:

| Field | Value |
|---|---:|
| `worker_result_checksum` | `3267955125` |
| `worker_error` | `none` |
| `module_flush_count` | `20` |
| `subscriber_notify_count` | `1920` |
| `queue_drain_step_count` | `5120` |
| `derived_selector_eval_count` | `15360` |
| `state_nodes_touched` | `32768` |
| `derived_hash_rounds` | `131072` |
| `projection_update_count` | `6` |

## Main Result

F1 Worker B 3x aggregate:

- `measured_count=3`
- `valid_count=3`
- `parity_fail_count=0`
- `worker_equivalence_pass=true`
- `main_thread_ok=true`
- `decision=F1_WORKER_3X_SOLUTION_POSITIVE`

Main comparison:

- F0-D main-thread max task mean approx. `68.633ms`.
- F0-D long task count = `1` per run.
- F1 main-thread max task mean approx. `2.679ms`.
- F1 main-thread long task count = `0` per run.
- F1 worker compute mean approx. `51.367ms`.
- F1 worker roundtrip mean approx. `55.433ms`.
- F1 visible update remains around approx. `2.0ms`.

F1 run values:

| Metric | Values | Mean |
|---|---:|---:|
| `f1_main_run_task_max_ms` | `4.164 / 1.964 / 1.909` | `2.679` |
| `f1_main_long_task_count_50ms` | `0 / 0 / 0` | `0` |
| `f1_main_total_visible_update_ms` | `2.2 / 1.9 / 1.9` | `2.0` |
| `f1_worker_compute_ms` | `52.6 / 50.6 / 50.9` | `51.367` |
| `f1_worker_roundtrip_ms` | `59.3 / 53.4 / 53.6` | `55.433` |

## Interpretation

F1 shows that the controlled F0-D bottleneck is not inherently tied to main-thread rendering. Equivalent derived fanout work can be moved off-main-thread, removing 50ms+ main-thread long tasks in the controlled setting.

The main thread becomes bounded to dispatch plus projection commit work. The heavy derived fanout work still exists; it has moved to the Worker and remains visible through equivalence counters, checksum, worker compute time, and worker roundtrip time.

This supports worker-resident state/fanout as a runtime direction more directly than renderer replacement. The bottleneck relieved by F1 is the session-scale derived/fanout work, not layout or paint.

## Timing Reconciliation

Worker compute is not cycle-identical to main-thread execution. F0-D main-thread `f0_run_task_max_ms` mean is approximately `68.633ms`, while F1 Worker B `f1_worker_compute_ms` mean is approximately `51.367ms`.

That difference should not be overread as exact timing equivalence. Plausible contributors include:

- different execution environment between Worker and main thread;
- main-thread-specific overhead in F0-D;
- JIT, cache, or GC differences;
- possible minor execution-path differences despite equivalent counters.

The equivalence claim is structural and counter/checksum-based, not cycle-identical. F1 preserves the workload shape and removes the main-thread long task; it does not prove that worker execution is a perfect timing replica.

## What F1 Proves

- Worker offload is a credible solution lever for derived/session-scale fanout work.
- Main-thread long tasks can be removed in this controlled workload.
- Equivalent structural work can be preserved while moving compute off-main-thread.
- This supports worker-resident state/fanout as a runtime direction.

## What F1 Does Not Prove

- Not proof that all UI work can move to Worker.
- Not proof DOM/React commit can be moved.
- Not product replay.
- Not production runtime success.
- Not proof of generalized workload coverage.
- Not Canvas/WebGPU relevance.
- Not proof that all main-thread latency disappears in real products.

## Relationship To F0-D

F0-D provides the controlled main-thread bottleneck. F1 uses that baseline to test worker offload.

F1 does not replace F0-D; it depends on F0-D as the baseline. Without F0-D, the paper would not have an isolated main-thread bottleneck for the worker-offload comparison.

Together, F0-D and F1 form the first controlled problem-solution closure: action-triggered derived fanout can create a main-thread long task, and equivalent fanout can be moved off-main-thread while keeping the visible update bounded.

## Relationship To F2

F1 tests offload. F2 tests worker-internal scheduling after offload.

F1 answers: can heavy derived work leave the main thread?

F2 answers: once it is in Worker, can urgent projection avoid waiting behind monolithic worker work?

This relationship matters because worker offload can remove main-thread long tasks while still leaving urgent work delayed behind a large Worker task. F2 evaluates that next bottleneck.

## Figure / Table Draft

Figure: "F0-D vs F1 main-thread ownership"

```text
F0-D:
click
-> RunMicrotasks
-> target FunctionCall
-> main-thread long task

F1:
click
-> dispatch to Worker
-> Worker compute
-> bounded main visible update
```

Table:

| Metric | F0-D Main-thread | F1 Worker B | Interpretation |
|---|---:|---:|---|
| `main max task mean` | `68.633ms` | `2.679ms` | main-thread long task removed |
| `long task count` | `1/run` | `0/run` | responsiveness improved |
| `worker compute` | `n/a` | `51.367ms` | compute moved off main |
| `worker roundtrip` | `n/a` | `55.433ms` | async worker path cost |

## Safe Claim Language

Safe wording:

"F1 shows that, in the controlled F0-D workload, equivalent derived fanout work can be moved off-main-thread, eliminating 50ms+ main-thread long tasks while preserving structural work counters. This validates worker offload as a solution lever for this workload family, not as a universal UI solution."

Unsafe claims to avoid:

- "Worker offload solves all product lag."
- "F1 proves production readiness."
- "F1 proves React/DOM is the problem."
- "F1 proves all UI work can leave the main thread."

## Final Recommendation

The next paper section should be F2 Worker-side Scheduling, because once work is off-main-thread, the next question is whether monolithic worker work can still delay urgent visible projection and whether scheduling/chunking helps.
