# Related Work / Related Systems v0

## Purpose

This section positions the paper against adjacent systems: virtualized lists, editors, terminals, React concurrent/render scheduling, workerized state architectures, browser scheduling APIs, and Canvas/OffscreenCanvas/WebGPU renderers.

This is a positioning draft, not a bibliography-complete related work section. It uses category-level comparisons and leaves precise citations as `citation-needed` items. Until those citations are added, this section should be read as claim-boundary positioning, not settled scholarship.

## Virtualized Lists and Viewport Rendering

Virtualized lists reduce mounted DOM nodes and visible rendering work. They are highly relevant for long lists, transcripts, scrollback views, and any interface where the visible region is much smaller than the total logical list.

Virtualization solves an important presentation problem: it can keep the committed DOM bounded even when the logical list is large. For long-lived AI surfaces, this is a necessary baseline to consider.

However, virtualization alone does not necessarily move session-scale state/fanout, derived metadata, subscriber updates, or action-triggered microtask work off the main thread. If the application still performs full-session derived computation, context propagation, or subscriber notification on the main thread, reducing DOM node count does not remove that state/fanout pressure.

This paper focuses on runtime placement of session state/fanout and bounded projection, not only DOM node count. The safe comparison is that virtualized lists solve a different part of the problem; they are not ineffective, and they remain a relevant baseline.

## Editor Buffer and Viewport Architectures

Editors separate document buffers from viewport rendering. They use mature buffer models, incremental update strategies, viewport projection, and text/layout techniques to keep large documents interactive.

This paper is inspired by the buffer/viewport separation. Long-lived AI surfaces also need a durable session model that is larger than the visible viewport, and they also benefit from bounded presentation work.

The difference is workload shape. Long-lived AI surfaces have heterogeneous semantic blocks: messages, markdown, code, tool calls, citations, agent traces, partial outputs, and provenance metadata. Many AI surfaces are not simply editable text buffers. They combine streaming append, structured tool state, interactive expansion, lineage, citations, and review actions.

Editors are an important reference model, not something this paper replaces. The paper borrows the buffer/viewport intuition while targeting heterogeneous AI interaction surfaces and the placement of session-scale state/fanout work.

## Terminal and Scrollback Systems

Terminals are append-heavy and viewport-centric. Scrollback provides a close analogy for long session surfaces: the visible region is bounded, but historical output remains available.

This paper shares the terminal intuition that presentation should be a bounded view of longer-lived session state. The append-heavy nature of terminals also makes them a useful conceptual baseline for AI sessions that grow over time.

The difference is that AI surfaces require richer block semantics, interactive tool outputs, message provenance, citations, code/log blocks, and scheduling between background session work and urgent visible projection. A terminal scrollback buffer is usually more uniform than a long-lived AI trace with heterogeneous blocks and derived metadata.

This paper can be seen as borrowing the terminal/buffer intuition but applying it to heterogeneous AI interaction surfaces.

## React Concurrent Features and Render Scheduling

React concurrent features and render scheduling help prioritize rendering and avoid blocking some UI updates. They are relevant baselines and should be considered in future evaluation.

However, render scheduling alone does not define a worker-resident session state model, transaction protocol, or bounded projection contract. If action-triggered session-scale state/fanout work remains coupled to the main-thread update path, render prioritization may reduce some visible blocking while leaving the placement problem unresolved.

This paper's claim is not that React is bad. The claim is that session-scale state/fanout placement can be a bottleneck that render prioritization alone may not remove. React concurrent features address overlapping but not identical problems, and future work should compare against strong React-based baselines rather than strawman DOM implementations.

## Workerized State and Off-Main-Thread Architectures

Moving state and compute off the main thread is a known design direction. The idea of using a Worker is not novel by itself.

This paper's specific contribution is not merely "use a Worker." F1 evaluates equivalent worker offload for controlled derived fanout, preserving structural work counters and removing the reproduced main-thread long task in the controlled setting. F2 evaluates Worker-side transaction scheduling after offload, showing that monolithic Worker execution can still delay urgent projection and that chunking/yielding/preemption can reduce urgent projection-commit latency.

P2 pure core defines a workload-specific contract around that evidence chain: protocol validation, op-log/state-store, transaction scheduling, bounded projection, recovery, metrics, and fail-closed correctness. The contribution is the workload-specific evidence chain and runtime contract, not the broad existence of Workers.

## Browser Scheduling APIs and Cooperative Scheduling

Browser scheduling primitives and cooperative scheduling are relevant to chunking and yielding work. They provide ways to split heavy work, yield control, and prioritize responsiveness.

F2's scheduled Worker path is conceptually aligned with cooperative scheduling: chunk heavy work, yield, and admit urgent work. The result supports the paper's claim that Worker-side scheduling matters after offload.

The paper does not depend on one browser scheduling API. Future work can compare scheduling primitives, fairness, starvation behavior, overhead, and multi-urgent stress. The current claim is narrower: in the controlled F2 workload, scheduled Worker processing lowers urgent acknowledgement and projection-commit latency relative to monolithic Worker execution.

## Canvas, OffscreenCanvas, and WebGPU Renderers

Canvas, OffscreenCanvas, and WebGPU are relevant presentation backends for large visual surfaces. They may become useful after the runtime boundary is correct, especially if a future workload shows that rendering throughput is the dominant bottleneck.

Current evidence points first to state/fanout/scheduling and projection boundaries, not renderer throughput. Product motivation and controlled reproduction focus on action-triggered microtask/state/fanout work. F1 and F2 test worker offload and Worker-side scheduling rather than presentation backend replacement.

This paper intentionally defers presentation backend claims. P2 pure core keeps Canvas/WebGPU paused, and current packaging should not imply that a production Canvas, OffscreenCanvas, or WebGPU backend is complete. The safe claim is not that Canvas/WebGPU are irrelevant; the safe claim is that they are not the first evidence-supported lever in this work.

## Positioning Summary

| Area | What It Solves | What It Does Not Necessarily Solve | This Paper's Position |
|---|---|---|---|
| Virtualized lists | Reduces mounted DOM nodes and visible list rendering work. | Session-scale state/fanout, derived metadata, subscriber updates, or microtask-heavy app coordination. | Important baseline; this paper targets runtime state/fanout placement and bounded projection beyond DOM node count. |
| Editor architectures | Separates buffer state from viewport presentation and supports incremental document updates. | Heterogeneous AI blocks, tool outputs, citations, provenance, streaming partials, and transaction scheduling by default. | Strong reference model; this paper adapts buffer/viewport thinking to AI interaction surfaces. |
| Terminal/scrollback systems | Handles append-heavy output with retained history and bounded viewport. | Rich semantic blocks, interactive tool states, citations, and urgent/background projection scheduling. | Close analogy for append/viewport shape; AI surfaces require richer state and projection contracts. |
| React concurrent/render scheduling | Prioritizes rendering and can reduce some UI blocking. | Worker-resident session state, cross-thread transaction protocol, bounded projection contract, or off-main-thread fanout by itself. | Relevant baseline; this paper focuses on state/fanout placement and Worker-side scheduling, not React rejection. |
| Workerized state | Moves compute or state off the main thread. | Workload-specific transaction scheduling, projection safety, lineage, recovery, and fail-closed contracts by itself. | Workers are known; the contribution is the evidence chain and AI-surface runtime contract. |
| Browser scheduling APIs | Supports chunking, yielding, and cooperative responsiveness. | A full session model, projection protocol, or correctness boundary by itself. | Relevant mechanism family; F2 is API-agnostic scheduler-positive evidence. |
| Canvas/OffscreenCanvas/WebGPU | Provides alternative presentation backends for visual throughput. | Session-scale state/fanout placement, transaction scheduling, or projection correctness. | Future backend gate; current evidence supports fixing runtime boundaries first. |

## Citation TODOs

- virtualized list / windowing systems: citation-needed
- editor architecture / piece table / rope / viewport rendering: citation-needed
- terminal scrollback systems: citation-needed
- React concurrent features / scheduler: citation-needed
- workerized state / off-main-thread UI architectures: citation-needed
- browser scheduling APIs: citation-needed
- Canvas/OffscreenCanvas/WebGPU UI rendering systems: citation-needed

## Final Recommendation

This section should be integrated after Background or before/after Limitations depending on final paper structure. The next step should be either:

A. patch the assembled short-paper draft with a compact Related Work section;

or

B. create a citation plan before integration.

Recommend A for now, with citation placeholders and an explicit note that the section is not bibliography-complete.
