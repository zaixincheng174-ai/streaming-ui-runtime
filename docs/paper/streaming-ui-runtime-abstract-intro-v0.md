> **Status:** Historical / superseded draft.
> This document is retained for project history and should not be read as the current claim boundary. For current public-facing claims, start with `README.md` and `docs/portfolio/document-status-map.md`.

# Streaming UI Runtime Abstract + Introduction v0

## Abstract

Long-lived AI interfaces are increasingly append-heavy, viewport-centric, and session-scale. They are not ordinary document pages: users keep interacting with a growing transcript, trace, or review surface while the underlying session state keeps expanding. In product-motivated traces, ordinary actions showed a recurring shape: `click/pointerup` leading to `Run microtasks` and multi-bundle state/context coordination, suggesting that action-triggered state/fanout work can produce main-thread long tasks. We evaluate this mechanism through a bounded evidence chain. F0-D reproduces the bottleneck in a controlled derived-fanout workload with `f0_run_task_max_ms` mean ≈ `68.633ms`. F1 worker offload moves equivalent derived fanout off the main thread, reducing main max task mean to ≈ `2.679ms` and removing main-thread long tasks. F2 then compares monolithic worker execution with scheduled/chunked worker processing, reducing urgent acknowledgement latency from ≈ `20.933ms` to ≈ `0.900ms` and urgent projection-commit latency from ≈ `22.867ms` to ≈ `3.333ms`, while paying worker-side total-time overhead. These results support a runtime direction built around worker-resident state, transaction scheduling, and bounded projection. P2 pure core v0 is treated as a frozen engineering scaffold for that direction. The claim is deliberately limited: this is not product source replay, not a final production runtime, and not a Canvas/WebGPU claim.

## Introduction

### 1. The UI workload is changing

AI surfaces are not ordinary pages. A long-lived AI session can begin like a chat, grow into a transcript, become a review surface, accumulate tool traces, and still remain interactive for the user.

The dominant operation in these surfaces is often append, not replace. Tokens, messages, events, citations, intermediate results, and review artifacts keep joining an already-large session. The visible viewport may show only a narrow slice, but the interactive state behind that slice can be session-scale.

This creates a mismatch with page-oriented assumptions. Users interact with a growing transcript, trace, or review surface rather than a short-lived route. The UI is viewport-centric, but the state model is large, long-lived, and repeatedly touched by actions that appear local.

The research question is therefore not only how fast a renderer can paint. It is where session-scale state, fanout, and derived work should live, how it should be scheduled, and how much work should be projected back to the main thread.

### 2. Current stacks put too much session-scale work on the main thread

DOM/VDOM stacks are powerful document-oriented tools, but long-lived AI surfaces behave more like terminal/editor hybrids: append-heavy, continuously interactive, and stateful across a long session.

In this workload, a single action can trigger `Run microtasks`, state propagation, subscriber fanout, queue drains, and derived computation. If those paths stay on the main thread, the input boundary can turn into a scripting-heavy burst before the renderer itself is the dominant issue.

That hurts input responsiveness because the main thread must remain available for user input, event dispatch, visible updates, and commit work. When session-scale coordination happens there, the user can feel latency even if the eventual visual update is small.

This is not simply a renderer problem, and it is not simply a backend problem. The relevant mechanism is the placement and scheduling of action-triggered state/fanout work in long-lived, append-heavy UI sessions.

### 3. Evidence from product traces and controlled reproduction

Product/P0 evidence motivates the mechanism family. Real product traces show `click/pointerup -> Run microtasks -> multi-bundle/state-context coordination`, with source-semantics hints consistent with state/context propagation and subscriber-fanout-like behavior.

This evidence must be handled carefully. It is not product source replay, not exact product implementation ownership, and not proof that all observed product latency comes from one mechanism. It is mechanism-family evidence that motivates a controlled reproduction.

F0-D provides that controlled reproduction. In a production-React-like derived fanout workload, F0-D reproduced stable main-thread long-task behavior across three valid runs. The key metric, `f0_run_task_max_ms`, had mean ≈ `68.633ms`, with `50ms+` main-thread long tasks in all measured runs.

The safe interpretation is that action-triggered derived fanout/state traversal can be a credible controlled bottleneck for this class of UI workload. It does not claim source replay or broad workload generalization.

### 4. Worker offload as a solution lever

F1 evaluates worker offload as a solution lever for the controlled derived fanout mechanism. It moves equivalent derived fanout work off the main thread while preserving structural work through counters and checksums.

The result is solution-positive for this slice. F1 reduced the main-thread max task mean to ≈ `2.679ms`, and the main-thread long task count became `0`.

The safe claim is not that all UI work can move to a worker. DOM commit, browser layout, paint, input dispatch, and unavoidable main-thread product logic remain outside this evidence. The claim is narrower: equivalent derived/session-scale fanout work can move off-main-thread and remove the reproduced main-thread long task in a controlled setting.

That result turns worker offload from a plausible idea into an evidence-supported architectural lever for long-lived AI surfaces.

### 5. Worker-side scheduling matters beyond offload

Once work moves off the main thread, the next question is whether worker execution itself should be monolithic or scheduled. F2 compares a monolithic worker execution model against scheduled/chunked worker processing with urgent projection admission.

F2-B improves urgent projection latency relative to F2-A. The mean `urgent_main_ack_latency_ms` drops from ≈ `20.933ms` to ≈ `0.900ms`. The mean `urgent_end_to_end_visible_ms` drops from ≈ `22.867ms` to ≈ `3.333ms`.

This result is not a throughput win. F2-B pays worker-side total-time overhead because chunking, yielding, and preemption add cost. The safe claim is a responsiveness tradeoff: scheduled worker execution admits urgent visible work sooner than monolithic worker execution under equivalent structural work.

This matters because worker offload alone can move pressure away from the main thread, but it can still leave urgent work stuck behind large worker tasks. Worker-side transaction scheduling is therefore part of the runtime direction, not an optional optimization detail.

### 6. Runtime direction

The evidence chain points toward a runtime architecture built around worker-resident state and an operation log. Session-scale state and derived work should live behind a worker boundary when possible, with the main thread receiving bounded projections rather than owning all session-scale fanout.

The runtime direction includes a transaction model, priority lanes, scheduled admission, and bounded projection. Urgent input and visible projection should be able to preempt or interleave with heavier background/session work without claiming that all work becomes faster.

The main thread remains important, but its role changes. It becomes a projection commit boundary for bounded, validated results rather than the default home for growing session-scale coordination.

Fail-closed correctness is part of the design direction. P2 pure core v0 freezes protocol validation, serialization checks, operation and transaction validation, scheduler and backpressure policy, projection policy, checksums, recovery decisions, decision traces, metrics, immutable state-store behavior, and pure adapters as an engineering scaffold.

P2 pure core v0 is not a production runtime. It does not open the real Worker runtime, real main runtime, projection engine, DOM/React integration, Canvas/WebGPU, benchmark expansion, or product integration. It supports the next gated implementation step by making the proposed runtime direction testable and auditable.

### 7. Contributions

1. Workload/architecture diagnosis: long-lived AI surfaces are append-heavy, viewport-centric, and session-scale, creating main-thread state/fanout pressure under document-oriented UI assumptions.
2. Controlled reproduction methodology: F0-D reproduces action-triggered derived fanout long-task behavior without claiming product replay.
3. Worker offload and scheduler evaluation: F1 shows equivalent worker offload removes the reproduced main-thread long task; F2 shows scheduled worker processing improves urgent projection latency relative to monolithic worker execution.
4. Runtime architecture direction: the work motivates worker-resident state/op-log, transaction scheduling, priority lanes, fail-closed bounded projection, and a main-thread projection commit boundary, with P2 pure core v0 frozen as scaffold rather than final runtime.

## Claim Boundaries

- Not product trace replay.
- Not proof all ChatGPT latency is explained.
- Not proof React universally fails.
- Not final runtime implementation.
- Not Canvas/WebGPU relevance.
- Not production accessibility readiness.
- Not exact user-perceived pixel latency.
- Not broad workload generalization.

## Reviewer Risk Notes

- "This is just worker offload." Response: F1 establishes offload as a lever, while F2 shows worker-side scheduling matters after work has already moved off-main-thread.
- "The benchmark is synthetic." Response: Correct; the safe claim is controlled reproduction of a product-motivated mechanism, not direct product replay.
- "F2 worker total time is worse." Response: Correct; the positive result is lower urgent acknowledgement and projection-commit timing, not total throughput improvement.
- "Why not React concurrent features?" Response: The evidence targets action-triggered state/fanout placement and worker-side scheduling, not only render prioritization.
- "Why not Canvas/WebGPU?" Response: The observed mechanism is state/fanout scheduling, so renderer backends remain outside the current evidence boundary.
- "Where is accessibility?" Response: Accessibility is required for production runtime work, but this paper slice is not claiming production UI readiness.
- "Does this prove production readiness?" Response: No; P2 pure core v0 is a frozen scaffold, and real Worker, main runtime, projection engine, and product integration remain future gates.

## Open Questions Before Full Draft

- Which venue and paper length should shape the draft?
- Should a real Worker boundary smoke test be added, or would it distract from the current claim boundary?
- Should a broader workload matrix be added before submission, or reserved for follow-up work?
- Should P2 pure core appear as a design artifact in the main text or as an appendix?
- How much product-trace evidence can be shown without overclaiming or exposing implementation-specific details?

## Final Recommendation

The next step after this document should be Section 2: Background and Workload Model. That path strengthens the paper without reopening implementation.

A carefully gated real Worker boundary smoke test should be considered only if the Introduction exposes a specific evidence gap that the smoke test directly closes. It should not open projection engine work, DOM/React integration, Canvas/WebGPU, product integration, or broader benchmark expansion.
