# P1-F0-D Product-Range 3x Attribution

Date: 2026-04-26  
Project: Streaming UI Runtime for Long-Lived AI Surfaces  
Stage: P1-F0-D offline attribution note

## Decision

Offline attribution across all three F0-D traces confirms the boundary-positive cost is dominated by F0 microtask/flush target work.

It is not dominated by React commit, layout/paint/style, or GC.

Worker-offload A/B planning is justified.

P2 remains blocked.

## Data Availability

All three traces contain complete F0 marks:

- `f0:start`
- `f0:end`
- trigger marks
- `f0:microtask:start`
- `f0:flush:start`
- `f0:flush:end`
- 20 module flush start/end pairs
- 1920 subscriber notify start/end pairs
- 4 React commit start/end pairs

There is no explicit `f0:microtask:end` mark. Attribution uses `f0:microtask:start -> f0:flush:end`, consistent with the current helper definition.

## Duration Breakdown

| Metric | Slot 01 | Slot 02 | Slot 03 |
|---|---:|---:|---:|
| F0 window | 75.637ms | 72.967ms | 72.688ms |
| Flush window | 66.620ms | 67.169ms | 66.995ms |
| Microtask window | 66.676ms | 67.229ms | 67.057ms |
| Module flush total | 66.249ms | 66.796ms | 66.628ms |
| Subscriber notify total | 58.138ms | 58.651ms | 58.316ms |
| React commit total | 7.308ms | 5.560ms | 5.453ms |

## Per-Module Skew

`module-0` dominates in all runs at about 54.4-54.8ms.

Modules `1-19` are each sub-ms.

This suggests first-pass, JIT, or cache-shape effects inside the derived fanout path, not React commit dominance.

## Long-Task Owner

Each run has one long task:

- Slot 01 max `RunTask=70.117ms`
- Slot 02 max `RunTask=67.990ms`
- Slot 03 max `RunTask=67.793ms`

Each long task contains the full F0 microtask/flush window.

The dominant child is `RunMicrotasks` around 67-69ms and target-page `FunctionCall` around 67ms.

## Top Trace Events

The top inclusive events inside F0 are:

- `RunTask`
- `ThreadControllerImpl::RunTask`
- `FunctionCall`
- `RunMicrotasks`

React vendor `FunctionCall` is only around 3.7-3.9ms post-flush.

Layout/Paint/Style is around 1.38-1.45ms.

MinorGC/Scavenger is present but small.

MajorGC / MarkCompactor is not dominant.

## Mechanism Interpretation

F0-D matches the product mechanism family:

Product:

`click/pointerup -> Run microtasks -> multi-bundle coordination`

F0-D:

`synthetic click -> RunMicrotasks -> module/subscriber derived fanout`

This is controlled mechanism reproduction, not product trace replay.

## What This Supports

This supports that main-thread derived fanout can produce stable 50ms+ microtask long tasks.

It supports that the bottleneck is the target fanout/flush path, not React commit, layout, paint, style, or GC.

It supports Worker-offload A/B as the correct next solution test.

## What This Does Not Prove

This does not prove product trace replay fidelity.

This does not authorize P2.

This does not prove a runtime is necessary.

This does not prove Canvas or WebGPU is relevant.

This does not prove Worker offload will help yet.

This does not identify exact product function ownership.

## Next Step

Plan Worker-offload A/B.

Use the same F0-D workload in two modes:

- A: main-thread derived fanout baseline
- B: Worker-offloaded derived fanout with bounded main-thread projection

Do not implement until the plan/spec is approved.

## Blocked

Blocked after this attribution:

- F0-E
- more parameter escalation
- P2
- Canvas/WebGPU
- `allocation_probe`
- more DevTools collection
- Worker runtime implementation before A/B spec

