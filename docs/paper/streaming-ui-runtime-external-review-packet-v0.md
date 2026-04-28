# Streaming UI Runtime External Review Packet v0

## Purpose Of This Packet

This packet is for an external reviewer to evaluate the current paper direction, not to approve new implementation. It summarizes the thesis, evidence chain, current draft artifacts, frozen P2 core, figures, limitations, and requested feedback.

Do not review this as a production system. Do not assume real Worker runtime exists. Do not assume projection engine exists. Do not assume Canvas/WebGPU implementation exists. Review it as a research argument plus controlled evidence chain plus frozen pure-core design artifact.

## One-Paragraph Project Summary

Long-lived AI surfaces are append-heavy, viewport-centric, session-scale interfaces where action-triggered state/fanout/microtask work can hit the main thread. Product traces motivate this mechanism family; F0-D reproduces it in a controlled derived-fanout workload; F1 shows equivalent worker offload removes main-thread long tasks; F2 shows worker-side scheduling reduces urgent projection-commit latency; P2 pure core v0 freezes the resulting runtime-core implications as a fail-closed engineering scaffold.

## Current Thesis

Current AI long-session interfaces often use document/DOM/VDOM-oriented stacks for append-heavy, viewport-centric, long-lived workloads. This can couple session-scale state/fanout work to the main thread. A better architectural direction is a worker-resident, transaction-scheduled runtime that maintains session state off-main-thread and sends bounded, validated projections to the main thread.

## Evidence Chain Summary

| Stage | Artifact | Main Question | Key Result | Safe Claim | Boundary |
|---|---|---|---|---|---|
| P0 Product Trace Motivation | `docs/paper/streaming-ui-runtime-p0-motivation-v0.md` and `docs/p0/*` | What mechanism family appears in product traces? | `click/pointerup -> Run microtasks` / multi-bundle state-context coordination. | Motivates action-triggered microtask-heavy app coordination hypothesis. | Not source replay; not exact product root cause. |
| F0-D Controlled Reproduction | `docs/p1/p1-f0d-product-range-3x-result.md` and `docs/paper/streaming-ui-runtime-f0d-reproduction-v0.md` | Can controlled derived fanout reproduce main-thread long tasks? | `f0_run_task_max_ms` mean ≈ `68.633ms`; `long_task_count_50ms = 1/run`. | Controlled mechanism-family reproduction. | Not quantitative product replay. |
| F1 Worker Offload | `docs/p1/p1-f1-worker-offload-3x-result.md` and `docs/paper/streaming-ui-runtime-f1-worker-offload-v0.md` | Can equivalent derived fanout leave the main thread? | Main max task mean ≈ `2.679ms`; main long task count = `0`. | Worker offload is a credible solution lever for derived/session-scale fanout. | Not proof all UI work can move off-main-thread. |
| F2 Worker Scheduling | `docs/p1/p1-f2-worker-scheduler-ab-3x-result.md` and `docs/paper/streaming-ui-runtime-f2-worker-scheduling-v0.md` | Does Worker-side scheduling matter after offload? | Urgent ack ≈ `20.933ms -> 0.900ms`; urgent projection-commit ≈ `22.867ms -> 3.333ms`. | Scheduled Worker improves urgent responsiveness. | Not throughput win; not full pixel latency; single urgent request. |
| P2 Pure Core v0 | `docs/p2/p2-pure-core-v0-freeze.md` and `runtime/*` | What runtime direction follows from the evidence? | Pure core frozen as fail-closed protocol/state/scheduler/projection correctness scaffold. | Engineering scaffold for future runtime gates. | Not production runtime. |

## Key Numbers To Verify

F0-D:

- `f0_window_ms` mean ≈ `73.764ms`
- `f0_microtask_window_ms` mean ≈ `66.987ms`
- `f0_run_task_max_ms` mean ≈ `68.633ms`
- `long_task_count_50ms = 1/run`

F1:

- main max task mean ≈ `2.679ms`
- main long task count = `0`
- worker compute mean ≈ `51.367ms`
- worker roundtrip mean ≈ `55.433ms`

F2:

- F2-A `urgent_main_ack_latency_ms` mean ≈ `20.933ms`
- F2-B `urgent_main_ack_latency_ms` mean ≈ `0.900ms`
- F2-A `urgent_end_to_end_visible_ms` mean ≈ `22.867ms`
- F2-B `urgent_end_to_end_visible_ms` mean ≈ `3.333ms`
- F2-A `worker_heavy_txn_total_ms` mean ≈ `26.8ms`
- F2-B `worker_heavy_txn_total_ms` mean ≈ `48.533ms`
- F2-B `chunk_count = 313`
- F2-B `yield_count = 312`
- F2-B `preemptions = 1`

## Current Paper Artifacts

- `docs/paper/streaming-ui-runtime-short-paper-draft-v0.md` - assembled current draft.
- `docs/paper/streaming-ui-runtime-short-paper-outline.md` - outline.
- `docs/paper/streaming-ui-runtime-abstract-intro-v0.md` - abstract/introduction.
- `docs/paper/streaming-ui-runtime-background-workload-v0.md` - workload model.
- `docs/paper/streaming-ui-runtime-p0-motivation-v0.md` - P0 motivation.
- `docs/paper/streaming-ui-runtime-f0d-reproduction-v0.md` - F0-D section.
- `docs/paper/streaming-ui-runtime-f1-worker-offload-v0.md` - F1 section.
- `docs/paper/streaming-ui-runtime-f2-worker-scheduling-v0.md` - F2 section.
- `docs/paper/streaming-ui-runtime-p2-design-implications-v0.md` - P2 design implications.
- `docs/paper/streaming-ui-runtime-limitations-future-work-v0.md` - limitations/future work.
- `docs/paper/streaming-ui-runtime-related-work-v0.md` - related systems.
- `docs/paper/streaming-ui-runtime-conclusion-v0.md` - conclusion.
- `docs/paper/streaming-ui-runtime-figures-tables-spec-v0.md` - figure/table specs.
- `docs/paper/rendered-figure-plan-v0.md` - rendered figure plan.

## Current Figures

- `docs/paper/figures/figure-1-workload-architecture-mismatch-v0.svg`
  - Explains workload-architecture mismatch.
- `docs/paper/figures/figure-2-p0-product-trace-mechanism-shape-v0.svg`
  - Explains P0 mechanism-family trace shape.
- `docs/paper/figures/figure-3-f0d-vs-f1-main-thread-comparison-v0.svg`
  - Explains F0-D vs F1 solution lever.
- `docs/paper/figures/figure-4-f2-worker-scheduling-timeline-v0.svg`
  - Explains F2 responsiveness tradeoff.

These are draft SVGs for review, not camera-ready final figures.

## P2 Pure Core Freeze Status

- P2 pure core v0 is frozen.
- Freeze note: `docs/p2/p2-pure-core-v0-freeze.md`.
- Final freeze audit returned `READY_TO_FREEZE`.
- Freeze candidate commit recorded in note: `85f5106`.
- P2 pure core includes protocol, serialization, op/transaction validation, scheduler/backpressure/projection policies, checksums/equivalence counters, recovery/error lineage, op-log, immutable state-store, core-engine, pure worker/main adapters, in-memory harnesses, and guard checks.
- P2 pure core is not a production runtime.

## Explicitly Not Implemented

- real Worker runtime;
- real main runtime;
- projection engine;
- DOM/React integration;
- Canvas/OffscreenCanvas/WebGPU;
- benchmark/capture expansion;
- product integration;
- accessibility/focus/caret production model;
- broader workload matrix;
- multi-urgent stress testing.

## Reviewer Questions We Want Answered

A. Thesis:

- Is the workload/architecture mismatch clear?
- Is "long-lived AI surface" defined well enough?
- Is the paper more than generic web performance advice?

B. Evidence:

- Does P0 -> F0-D -> F1 -> F2 form a credible chain?
- Are the numbers used correctly?
- Are the limitations adequate?

C. Contribution:

- Are the contributions strong enough for a systems paper?
- Is this framed as more than "use a Worker"?
- Is P2 pure core useful as a design artifact?

D. Boundaries:

- Are any claims too strong?
- Are we underclaiming anything?
- Are product trace boundaries clear enough?
- Are F2 throughput/latency boundaries clear enough?

E. Structure:

- Are Figures 1-4 helpful?
- Are Table 1 and Table 2 helpful?
- Is Related Work positioned well?
- What should be cut or moved to appendix?

F. Next Step:

- Should we polish paper prose?
- Should we render camera-ready figures?
- Should we add citations?
- Is a real Worker boundary smoke necessary before external sharing?

## Known Weaknesses

- figures are draft SVGs, not camera-ready;
- citations are placeholders / citation plan still needed;
- related work is category-level, not bibliography-complete;
- P2 pure core is scaffold, not production runtime;
- sample sizes are small 3x controlled repeats;
- no broad workload matrix yet;
- no multi-urgent stress yet;
- no accessibility/focus/caret model yet;
- no real Worker boundary yet.

## Claim Boundaries For Reviewers

Please do not interpret the draft as claiming:

- product source replay;
- full product root cause;
- React/DOM universal failure;
- Canvas/WebGPU relevance;
- production runtime readiness;
- exact user-perceived pixel latency;
- total throughput improvement in F2;
- broad AI UI workload generalization;
- all P2 modules experimentally proven.

## Suggested Review Modes

1. Systems-paper review:
   Assess thesis, novelty, contribution strength, and evidence chain.

2. Measurement review:
   Check numbers, metric wording, validity threats, and claim boundaries.

3. Paper-architecture review:
   Check structure, figure/table placement, related work positioning, and reader flow.

## Final Recommendation

Use this packet for external/adversarial review before opening new implementation gates. The most likely next internal tasks after review are:

- figure polish / camera-ready rendering;
- citation plan;
- prose v0.2 patch;
- possibly a narrowly gated real Worker boundary smoke only if reviewers identify it as a blocking evidence gap.
