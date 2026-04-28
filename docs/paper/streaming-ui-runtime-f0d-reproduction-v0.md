# F0-D Controlled Reproduction v0

## Purpose of This Section

P0 motivates a mechanism-family hypothesis, but does not isolate the mechanism. F0-D creates a controlled production-React-style workload that models action-triggered derived fanout / queue drain / state traversal and tests whether it can produce stable main-thread long tasks.

This section should make the evidence transition explicit: product traces motivate the suspected family, while F0-D asks whether that family can be reproduced under controlled conditions without claiming product source replay.

## Research Question

Can a controlled action-triggered derived-fanout workload reproduce the same broad bottleneck family suggested by product traces: microtask/flush-heavy app coordination rather than layout/paint/GC dominance?

The answer matters because the runtime direction should be grounded in an isolated mechanism. If the controlled bottleneck were dominated by layout, paint, GC, or unrelated artifact behavior, then worker-resident state/fanout scheduling would be a weaker next lever.

## Workload Design

F0-D is a controlled derived fanout workload. It is action-triggered, runs the derived work on the main thread, and uses a session-sized state shape with multiple modules and subscribers.

The workload models queue drain and selector-like derived work over accumulated state. It is intentionally bounded synthetic structure, not product trace replay.

Confirmed F0-D configuration:

| Field | Value |
|---|---:|
| `scenario_mode` | `p1-f0-send-flush-fanout` |
| `calibration_level` | `derived` |
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

These parameters are structurally motivated. They approximate multi-module coordination, subscriber notification, queue/cascade depth, state traversal, selector passes, and derived hash work. They are not reverse-engineered product constants.

## Validity Conditions

Accepted F0-D samples require:

- `config_valid=true`
- `capture_allowed=true`
- complete F0 marks
- visibility/frame parity pass
- no major GC / mark-compactor dominance
- protected P0/P0-F scope unchanged

Accepted samples also require usable foreground capture conditions and observed capture completion. Invalid captures, incomplete mark/counter contracts, stale-server captures, and visibility/frame parity failures are excluded from interpretation.

## Main Result

F0-D 3x aggregate:

- `measured_count=3`
- `valid_count=3`
- `parity_fail_count=0`
- `boundary_positive_count=3`
- `decision=F0D_3X_BOUNDARY_POSITIVE`
- `f0_window_ms min/mean/max = 72.688 / 73.764 / 75.637`
- `f0_microtask_window_ms min/mean/max = 66.676 / 66.987 / 67.229`
- `f0_run_task_max_ms min/mean/max = 67.793 / 68.633 / 70.117`
- `f0_long_task_count_50ms = 1 per run`

All three accepted runs passed the measurement gates and produced one 50ms+ main-thread long task.

## Attribution

Offline attribution confirms that the long task is dominated by F0 microtask / flush target work.

`RunMicrotasks` and target-page `FunctionCall` dominate the long task. Each long task contains the full F0 microtask/flush window, with the dominant child around 67-69ms.

React commit is smaller and occurs after the flush. React commit total is around 5.453-7.308ms across the three slots, and vendor `FunctionCall` is around 3.7-3.9ms post-flush.

Layout/Paint/Style are small, around 1.38-1.45ms. MinorGC/Scavenger is present but small. MajorGC / MarkCompactor does not dominate.

Per-module skew exists. `module-0` dominates in all runs at about 54.4-54.8ms, while modules `1-19` are each sub-ms. The attribution note interprets this as likely first-pass, JIT, or cache-shape effects inside the derived fanout path, not React commit dominance.

## Interpretation

F0-D reproduces the mechanism family suggested by P0:

```text
synthetic click
-> RunMicrotasks
-> target FunctionCall
-> module/subscriber derived fanout
```

It supports the claim that action-triggered derived fanout can produce stable 50ms+ main-thread long tasks in a controlled setting.

The result shifts the controlled evidence away from pure rendering pressure and toward action-triggered app-side flush, subscriber fanout, and derived state traversal.

## What F0-D Proves

- Action-triggered derived fanout can generate stable main-thread long tasks.
- The bottleneck can be microtask/flush dominated.
- Layout/paint/GC are not required to explain the controlled long task.
- This creates a valid controlled baseline for F1 worker offload.

## What F0-D Does Not Prove

- Not product trace replay.
- Not exact ChatGPT implementation.
- Not exact source-map ownership.
- Not proof all product latency is derived fanout.
- Not proof React universally fails.
- Not proof final runtime design is sufficient.
- Not quantitative replay of 400-650ms product bursts.

## Magnitude Caveat

F0-D produces stable 50-70ms main-thread long tasks, while product traces can include larger bursts. F0-D is therefore a smaller controlled reproduction of the mechanism family, not quantitative product replay.

The smaller magnitude is still sufficient for the next experimental question: whether equivalent derived fanout work can be moved off-main-thread while preserving structural work.

## Link To F1

F0-D establishes the main-thread bottleneck baseline. F1 then tests whether equivalent derived fanout work can be moved off-main-thread while preserving structural work.

The F0-D/F1 comparison uses the same structural workload and interprets equivalence through counters and checksums, not cycle-identical timing. F0-D provides the problem cell; F1 tests the worker-offload solution lever.

## Figure / Table Draft

Figure: "F0-D controlled mechanism"

```text
synthetic click
-> trigger
-> RunMicrotasks
-> module/subscriber derived fanout
-> long task
```

Table:

| Metric | F0-D 3x Result | Interpretation |
|---|---:|---|
| `valid_count` | `3/3` | all accepted |
| `f0_window_ms` mean | `73.764ms` | stable action window |
| `f0_microtask_window_ms` mean | `66.987ms` | microtask/flush dominated |
| `f0_run_task_max_ms` mean | `68.633ms` | main-thread long task reproduced |
| `long_task_count_50ms` | `1/run` | boundary-positive |

## Safe Claim Language

Safe wording:

"F0-D shows that a controlled action-triggered derived-fanout workload can reproduce stable microtask-dominated main-thread long tasks. It is mechanism-family reproduction, not product replay."

Unsafe claims to avoid:

- "F0-D reproduces ChatGPT exactly."
- "F0-D proves all product latency comes from derived fanout."
- "F0-D proves React is the root cause."
- "F0-D proves the final runtime is sufficient."

## Final Recommendation

The next paper section should be F1 Worker Offload, because F0-D provides the controlled main-thread bottleneck baseline that F1 attempts to relieve.
