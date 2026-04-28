# Figure 3: F0-D vs F1 Main-thread Comparison v0

## Purpose

This figure should show the transition from controlled main-thread bottleneck reproduction to the first solution lever: moving equivalent derived fanout work off the main thread.

## Core Message

F0-D reproduces a stable main-thread long task from action-triggered derived fanout. F1 preserves equivalent structural work but moves heavy derived fanout compute to Worker, reducing main-thread max task and removing 50ms+ main-thread long tasks in the controlled setting.

## Data To Annotate

F0-D:

- f0_window_ms mean ≈ 73.764ms
- f0_microtask_window_ms mean ≈ 66.987ms
- f0_run_task_max_ms mean ≈ 68.633ms
- long_task_count_50ms = 1/run

F1 Worker B:

- main-thread max task mean ≈ 2.679ms
- main-thread long task count = 0/run
- worker compute mean ≈ 51.367ms
- worker roundtrip mean ≈ 55.433ms
- visible update around ≈ 2ms

## Visual Structure

Create a two-panel figure.

Panel A: F0-D Main-thread Derived Fanout

Show:

synthetic click
-> RunMicrotasks
-> target FunctionCall
-> module/subscriber derived fanout
-> main-thread long task

Annotate:

- f0_run_task_max_ms mean ≈ 68.633ms
- f0_microtask_window_ms mean ≈ 66.987ms
- long_task_count_50ms = 1/run

Panel B: F1 Worker Offload

Show:

synthetic click
-> dispatch to Worker
-> Worker compute / equivalent derived fanout
-> bounded main visible update

Annotate:

- main-thread max task mean ≈ 2.679ms
- main-thread long task count = 0/run
- worker compute mean ≈ 51.367ms
- worker roundtrip mean ≈ 55.433ms

## ASCII Draft

```text
Panel A: F0-D Main-thread Derived Fanout

time --------------------------------------------------------------->

Main Thread:
  synthetic click
       |
       v
  RunMicrotasks
       |
       v
  target FunctionCall
       |
       v
  module/subscriber derived fanout
       |
       v
  main-thread long task

Annotations:
  f0_microtask_window_ms mean ≈ 66.987ms
  f0_run_task_max_ms mean ≈ 68.633ms
  long_task_count_50ms = 1/run

Message:
  Main Thread owns fanout work.
  RunMicrotasks dominates.
  50ms+ long task appears.
```

```text
Panel B: F1 Worker Offload

time --------------------------------------------------------------->

Main Thread:
  synthetic click
       |
       v
  dispatch to Worker -----------------------------+
       |                                          |
       |                                          v
       |                              Worker:
       |                                equivalent derived fanout
       |                                worker compute ≈ 51.367ms
       |                                worker roundtrip ≈ 55.433ms
       |                                          |
       v                                          |
  bounded main visible update <-------------------+
  main-thread max task mean ≈ 2.679ms
  main-thread long task count = 0/run

Message:
  Worker owns heavy derived fanout.
  Main Thread receives bounded visible update.
  Main-thread long task disappears.
```

## Optional Mini Table

| Metric | F0-D Main-thread | F1 Worker B | Interpretation |
|---|---:|---:|---|
| main max task mean | ≈68.633ms | ≈2.679ms | main-thread bottleneck removed |
| main long task count | 1/run | 0/run | 50ms+ long task eliminated |
| worker compute mean | n/a | ≈51.367ms | heavy work moved off main |
| worker roundtrip mean | n/a | ≈55.433ms | async Worker path cost |

## Caption

Figure 3. F0-D reproduces an action-triggered, microtask-dominated main-thread long task in a controlled derived-fanout workload. F1 preserves equivalent structural work but moves the heavy derived-fanout path to a Worker, reducing main-thread max task time and eliminating 50ms+ main-thread long tasks in the controlled setting.

## Claim Boundaries

- F1 does not prove all UI work can move to Worker.
- F1 does not move DOM commit, layout, paint, focus, caret, or accessibility behavior.
- F1 is not product replay.
- F1 worker compute is not cycle-identical to main-thread work.
- F1 does not prove production runtime readiness.
- F1 does not imply Canvas/WebGPU relevance.

## Placement In Paper

Place this figure in Section 5: Worker Offload, before or immediately after the F1 main result table.

## Relation To Evidence

- F0-D provides the controlled bottleneck baseline.
- F1 shows worker offload as a solution lever for equivalent derived/session-scale fanout.
- F2 builds on F1 by asking whether Worker-internal scheduling matters after offload.

## What This Figure Should Not Show

- No product internals.
- No final runtime.
- No real Worker implementation claim beyond controlled F1.
- No DOM/React blame.
- No Canvas/WebGPU pipeline.

## Final Recommendation

After this spec, the next figure task should be Figure 2: P0 product trace mechanism shape, or the assembled draft can be patched to reference Figures 1, 3, and 4 together.
