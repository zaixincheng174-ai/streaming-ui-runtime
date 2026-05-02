> **Status:** Historical / superseded draft.
> This document is retained for project history and should not be read as the current claim boundary. For current public-facing claims, start with `README.md` and `docs/portfolio/document-status-map.md`.

# Streaming UI Runtime Short Paper Outline

## Working Title

1. A Streaming UI Runtime for Long-Lived AI Surfaces
2. Worker-Resident Scheduling for Append-Heavy AI Interfaces
3. Bounded Projection for Long-Lived Streaming UI Sessions

## One-Sentence Thesis

Current AI long-session interfaces often use document/DOM/VDOM-oriented stacks for append-heavy, viewport-centric, long-lived workloads, causing action-triggered session-scale state/fanout work to hit the main thread; a worker-resident transaction-scheduled runtime with bounded projection is a better architectural direction.

## Core Problem

Long-lived AI surfaces are append-heavy, viewport-centric, and session-scale rather than page-like or document-complete.

Current UI stacks often keep too much session state, subscriber fanout, derived work, and coordination on the main thread.

That architecture can turn ordinary user actions into `Run microtasks` / scripting-heavy bursts, hurting input responsiveness and making latency appear at action boundaries rather than only during rendering.

This is not just a renderer problem. The core issue is the placement and scheduling of state/fanout work for long-lived streaming sessions.

## Evidence Chain

| Stage | Evidence | Key Result | Safe Interpretation |
|---|---|---|---|
| Product/P0 | Product trace ownership/decomposition | `click/pointerup -> Run microtasks` / multi-bundle coordination and subscriber-fanout-like behavior | Mechanism-family evidence, not source replay |
| F0-D | Controlled derived fanout 3x | `f0_run_task_max_ms` mean approx. `68.633ms`; stable `50ms+` main-thread long task in `3/3` runs | Controlled bottleneck reproduction |
| F1 | Worker offload 3x | Main max task mean approx. `2.679ms`; main long task count `0`; equivalent work preserved | Worker offload is a credible solution lever |
| F2 | Worker scheduler A/B 3x | Urgent ack approx. `20.933ms -> 0.900ms`; urgent visible approx. `22.867ms -> 3.333ms`; scheduled worker total time higher than monolithic worker | Scheduler-positive evidence and responsiveness tradeoff, not throughput win |
| P2 | Frozen pure core | Fail-closed protocol/state/scheduler/projection scaffold; runtime tests passed at freeze | Engineering scaffold for future runtime, not final implementation |

F2-B worker total time is higher than F2-A, so the safe interpretation is lower urgent responsiveness latency under scheduling, not improved total throughput.

## Contributions

1. A workload/architecture diagnosis for long-lived AI surfaces: append-heavy, viewport-centric, session-scale UI workloads create main-thread state/fanout pressure.
2. A controlled reproduction methodology: the F0-D derived fanout benchmark reproduces main-thread long-task behavior without claiming product replay.
3. A solution-lever evaluation: F1 shows equivalent worker offload removes main-thread long tasks; F2 shows worker-side transaction scheduling improves urgent projection latency.
4. A runtime architecture direction: worker-resident state/op-log, transaction scheduler, fail-closed bounded projection, and main-thread projection commit boundary.

## Non-Contributions / Boundaries

- Not product source replay.
- Not proof all ChatGPT latency is explained.
- Not proof React universally fails.
- Not final runtime implementation.
- Not Canvas/WebGPU relevance.
- Not production accessibility readiness.
- Not proof scheduled worker improves total throughput.
- Not full user-perceived pixel latency measurement.
- Not broad workload generalization yet.

## Proposed Paper Structure

1. Introduction
   - Define long-lived AI surfaces as a distinct UI workload.
   - State the main-thread state/fanout pressure problem.
   - Preview the evidence chain from product traces to controlled experiments.
   - Summarize the runtime direction: worker-resident state, scheduling, bounded projection.

2. Background: Long-lived AI surfaces as a distinct UI workload
   - Contrast append-heavy sessions with document/page-style workloads.
   - Explain viewport-centric interaction and partial visibility.
   - Describe session-scale state, derived data, and subscriber fanout.
   - Separate rendering cost from state/fanout scheduling cost.

3. Product trace motivation / P0 evidence
   - Present the product trace mechanism shape.
   - Show action-triggered `Run microtasks` and multi-bundle coordination.
   - Explain why this motivates a mechanism-family hypothesis.
   - State clearly that P0 is not source replay or causal proof by itself.

4. Controlled reproduction: F0-D
   - Describe the derived fanout benchmark and why it isolates the suspected bottleneck.
   - Report the 3x result with `f0_run_task_max_ms` mean approx. `68.633ms`.
   - Explain why stable `50ms+` main-thread long tasks matter for responsiveness.
   - Bound the claim to controlled bottleneck reproduction.

5. Solution lever 1: Worker offload / F1
   - Move equivalent derived fanout work off the main thread.
   - Report main max task mean approx. `2.679ms` and main long task count `0`.
   - Emphasize equivalence-preserving work rather than skipped work.
   - Interpret worker offload as a credible architectural lever.

6. Solution lever 2: Worker-side scheduling / F2
   - Compare monolithic worker execution with scheduled/chunked worker execution.
   - Report urgent ack improvement from approx. `20.933ms` to `0.900ms`.
   - Report urgent visible improvement from approx. `22.867ms` to `3.333ms`.
   - State that scheduled worker total time is higher, making this a responsiveness tradeoff.

7. Runtime design implications / P2 pure core
   - Introduce worker-resident state/op-log and transaction scheduling as design implications.
   - Explain bounded projection as the main-thread commit boundary.
   - Describe fail-closed validation, traces, metrics, and recovery as scaffold requirements.
   - State that P2 pure core is frozen engineering scaffold, not the real runtime.

8. Limitations
   - No product source replay and no production migration yet.
   - No full user-perceived pixel latency measurement yet.
   - No broad workload matrix or multi-urgent stress testing yet.
   - No claim that React, DOM, Canvas, or WebGPU is universally right or wrong.

9. Future work
   - Build a separately approved real Worker boundary smoke test only if it supports the paper claim.
   - Validate projection behavior without opening a full projection engine prematurely.
   - Expand workload matrix after the current claim boundary is stable.
   - Add accessibility and production integration work only under a later gate.

10. Conclusion
   - Restate the workload-architecture mismatch.
   - Summarize F0-D, F1, and F2 as a bounded evidence chain.
   - Present worker-resident transaction scheduling with bounded projection as the direction.
   - Keep the final claim scoped to controlled evidence and frozen scaffold status.

## Key Figures And Tables Needed

- Figure 1: workload-architecture mismatch diagram.
- Figure 2: product trace mechanism shape.
- Figure 3: F0-D vs F1 main-thread task comparison.
- Figure 4: F2 monolithic vs scheduled worker timeline.
- Table 1: evidence chain.
- Table 2: claim boundaries.
- Table 3: frozen P2 module classification.

## Reviewer Risks And Responses

1. "This is just worker offload."
   - Response: F1 evaluates worker offload, but F2 shows why worker-side scheduling matters once work is off-main-thread.

2. "This is not product replay."
   - Response: Correct. The paper should claim mechanism-family motivation from product traces and controlled reproduction from F0-D, not source replay.

3. "F2 worker total time is worse."
   - Response: Correct. The result is a responsiveness tradeoff: lower urgent acknowledgement and projection-commit timing, not higher throughput.

4. "Why not just use React concurrent features?"
   - Response: The evidence points to action-triggered state/fanout work placement, not only render scheduling. React concurrency may help some rendering cases but does not move equivalent session-scale work off the main thread by itself.

5. "Why not Canvas/WebGPU?"
   - Response: The observed bottleneck is state/fanout and scheduling. Canvas/WebGPU are renderer choices and remain outside the current evidence boundary.

6. "Synthetic benchmark may not generalize."
   - Response: The paper should not claim broad generalization yet. It should claim a controlled reproduction of a product-motivated mechanism and identify the next validation gates.

7. "Where is accessibility?"
   - Response: Accessibility is a production-runtime requirement and future gate. P2 pure core does not claim production UI readiness.

8. "Does this prove production readiness?"
   - Response: No. P2 pure core is a frozen engineering scaffold. Real Worker runtime, main runtime, projection engine, and product integration remain paused.

9. "Could the same-clock acknowledgement metric hide actual pixel latency?"
   - Response: Yes. F2 should be framed as urgent acknowledgement and projection-commit latency evidence, not full user-perceived pixel latency.

## Claim Language

Strong but safe claim:

"We show that action-triggered derived fanout can create main-thread long tasks in a controlled production-React-like workload, and that moving equivalent derived work into a worker plus scheduling urgent projections can remove main-thread long tasks and reduce urgent projection commit latency in controlled settings."

Unsafe claims to avoid:

- "We solve ChatGPT lag."
- "WebGPU fixes AI UI."
- "React is unsuitable."
- "Our runtime is production-ready."
- "The frozen P2 pure core is a final runtime."
- "The product has been migrated to the new runtime."
- "Scheduled workers improve total throughput."

## Immediate Next Research Step

The next research step should be paper draft skeleton expansion, not implementation by default. The draft should turn the evidence chain, claim boundaries, figures, and reviewer responses into a short paper structure before any new runtime work is approved.

A carefully gated real Worker boundary smoke test is valid only if it directly supports the paper claim and is separately approved. It should not open DOM/React integration, projection engine work, Canvas/WebGPU, product integration, or broader benchmark expansion.

## Final Recommendation

The current best next move is to convert the evidence chain into a short paper draft, while keeping P2 pure core frozen and avoiding further implementation expansion until the paper claim structure is clear.
