# A Streaming UI Runtime for Long-Lived AI Surfaces

## Abstract

Long-lived AI interfaces are increasingly append-heavy, viewport-centric, and session-scale. They are not ordinary document pages: users keep interacting with a growing transcript, trace, or review surface while the underlying session state continues to expand. Product-motivated traces show a recurring shape in ordinary actions: `click/pointerup` leading to `Run microtasks` and multi-bundle state/context coordination. This suggests that action-triggered state/fanout work can produce main-thread responsiveness problems independent of renderer throughput alone. We evaluate this mechanism through a bounded evidence chain. F0-D reproduces the bottleneck in a controlled derived-fanout workload with `f0_run_task_max_ms` mean ≈ `68.633ms`. F1 moves equivalent derived fanout off the main thread, reducing main max task mean to ≈ `2.679ms` and removing main-thread long tasks. F2 then compares monolithic Worker execution with scheduled/chunked Worker processing, reducing urgent acknowledgement latency from ≈ `20.933ms` to ≈ `0.900ms` and urgent projection-commit latency from ≈ `22.867ms` to ≈ `3.333ms`, while increasing Worker total time. These results support a runtime direction built around worker-resident state, transaction scheduling, and bounded projection. P2 pure core v0 is a frozen engineering scaffold for that direction. This is not product source replay, not a final production runtime, and not a Canvas/WebGPU claim.

## 1. Introduction

AI surfaces are not ordinary pages. A long-lived AI session can begin like a chat, grow into a transcript, become an agent trace or code review surface, accumulate tool results, and still remain interactive. The dominant operation is often append, not replace. Tokens, messages, logs, citations, intermediate results, and review artifacts keep joining an already-large session.

The visible viewport may show only a narrow slice, but the session state behind that slice can be large and long-lived. Users scroll, click, select, expand traces, issue follow-up prompts, and inspect historical context while the session keeps growing. The UI is viewport-centric, but the state model is session-scale.

**Figure 1. Workload-architecture mismatch in long-lived AI surfaces.**  
Long-lived AI surfaces are append-heavy and viewport-centric, but their session state and derived fanout can grow far beyond the visible region. In a document-oriented stack, action-triggered state/fanout work may run on the main thread before a visible update. The proposed runtime direction moves session-scale state and scheduling into a Worker and sends only bounded, validated projections to the main thread.

Rendered draft: `docs/paper/figures/figure-1-workload-architecture-mismatch-v0.svg`

Current DOM/VDOM stacks are powerful document-oriented tools, but this workload can place too much session-scale state/fanout work on the main thread. A local-looking action can trigger `Run microtasks`, state propagation, subscriber fanout, queue drains, framework coordination, and derived computation. When those paths run on the main thread, input responsiveness can degrade before layout, paint, or a renderer backend is the dominant issue.

This paper argues for a runtime direction rather than a renderer-first replacement: worker-resident session state and fanout, transaction scheduling for urgent and background work, and bounded projection back to the main thread. The main thread remains important, but its role should shift toward committing safe, current, bounded visible projections rather than owning every session-scale coordination step.

Table 1 summarizes the bounded evidence chain.

| Stage | Question | Evidence / Method | Key Result | Safe Interpretation | Boundary |
|---|---|---|---|---|---|
| Product/P0 | What mechanism family appears in product traces? | `click/pointerup` trace ownership decomposition. | `click/pointerup -> Run microtasks` / multi-bundle state-context coordination. | Product traces motivate an action-triggered app-coordination hypothesis. | Not source replay; not exact product implementation. |
| F0-D | Can controlled derived fanout reproduce a main-thread long task? | Controlled 3x derived fanout workload. | `f0_run_task_max_ms` mean ≈ `68.633ms`; `long_task_count_50ms = 1/run`. | Controlled mechanism-family reproduction. | Not quantitative product replay. |
| F1 | Can equivalent derived fanout leave the main thread? | Worker B 3x with equivalence counters. | Main max task mean ≈ `2.679ms`; long task count = `0`. | Worker offload is a credible solution lever for derived/session-scale fanout. | Not proof all UI work can move off-main-thread. |
| F2 | Does Worker-side scheduling matter after offload? | Paired monolithic vs scheduled Worker A/B. | Urgent ack ≈ `20.933ms -> 0.900ms`; urgent projection-commit ≈ `22.867ms -> 3.333ms`. | Scheduled Worker improves urgent responsiveness. | Not throughput win; not full pixel latency. |
| P2 Pure Core | What runtime direction follows? | Frozen pure core scaffold. | Protocol/state/scheduler/projection correctness kernel frozen. | Engineering scaffold for future runtime gates. | Not production runtime. |

Table 2 states the claim boundaries that should govern the rest of the paper.

| Claim Area | Supported Claim | Not Claimed | Future Evidence Needed |
|---|---|---|---|
| Product traces | Mechanism-family hypothesis. | Exact source replay / full product root cause. | Broader product traces / source-level validation if available. |
| F0-D | Controlled derived fanout can create main-thread long tasks. | Quantitative product replay. | Broader controlled workloads. |
| F1 | Equivalent derived work can move off-main-thread. | All UI work can move to Worker. | Real Worker boundary / more workload classes. |
| F2 | Scheduled Worker reduces urgent projection-commit latency. | Total throughput improvement / exact pixel latency. | Multi-urgent stress / display pipeline timing. |
| P2 Pure Core | Frozen correctness scaffold. | Production runtime. | Real Worker/main/projection gates. |
| Rendering backend | Renderer is not the first lever in current evidence. | Canvas/WebGPU irrelevant forever. | Presentation backend experiments after runtime boundary. |
| Production readiness | None. | Accessibility/product readiness. | Accessibility, focus/caret/input, integration tests. |
| Generalization | Current controlled workload family. | All AI surfaces. | Broader workload matrix. |

The paper contributes:

1. a workload/architecture diagnosis for long-lived AI surfaces as append-heavy, viewport-centric, session-scale workloads;
2. a controlled reproduction methodology showing that action-triggered derived fanout can produce stable main-thread long tasks;
3. a solution-lever evaluation showing that equivalent worker offload removes main-thread long tasks and that worker-side scheduling reduces urgent projection-commit latency;
4. a frozen pure-core runtime scaffold that turns the evidence chain into a fail-closed contract kernel for worker-resident state, transaction scheduling, and bounded projection, without claiming production runtime readiness.

## 2. Background and Workload Model

A long-lived AI surface is an interactive UI for a long-running session whose state keeps growing while the user continues to interact with it. It can include chat, agent trace, code review, logs, reasoning traces, tool calls, citations, and long document review.

The workload has five key properties.

First, it is append-heavy. New content is frequently appended, output can stream, and blocks may grow over time. Tail mutation matters because new writes, visible updates, derived metadata, and user interaction often meet near the same boundary.

Second, it is session-scale. The session grows beyond the current viewport, and old state cannot always be discarded. Earlier messages, citations, tool calls, logs, and review artifacts may remain relevant for navigation, provenance, search, summarization, references, and future user actions.

Third, it is viewport-centric. The user sees a bounded region at any moment. Ideally, the main thread should receive a bounded visible projection rather than needing to own the full session state for every visible update.

Fourth, it has heterogeneous block structure. AI surfaces contain messages, markdown, code, tool calls, status blocks, citations, logs, agent traces, partial outputs, and review artifacts. Each block type can have different update and rendering behavior.

Fifth, it has concurrent interaction. User input, scrolling, clicking, selection, expansion, and new output can overlap. Urgent visible actions should not wait behind background session work.

This workload overlaps with existing systems but is not identical to them. Virtual lists reduce DOM node count, but do not by themselves remove session-scale state/fanout work from the main thread. Text editors have strong buffer and viewport models, but AI surfaces are usually heterogeneous semantic traces rather than only editable text buffers. Terminals are append-heavy and viewport-centric, but AI surfaces have richer block semantics, interaction, and derived metadata. Chat applications are superficially similar, but long-lived AI sessions include streaming, tool calls, agent traces, code/log blocks, and long review surfaces.

Related systems frame the boundary rather than replace the runtime direction. Virtual lists reduce DOM node count but do not necessarily remove session-scale state/fanout from main-thread paths. React concurrent features may help render prioritization, but they do not by themselves define worker-resident session state or cross-thread transaction scheduling. Editor and terminal architectures inspire buffer/viewport thinking, but AI surfaces add heterogeneous semantic blocks, tool calls, citations, streaming, and provenance. Workerized state libraries are relevant, but this paper focuses on a workload-specific transaction/projection runtime direction. Canvas/WebGPU are deferred because current evidence points first to state/fanout/scheduling boundaries, not renderer throughput.

The abstract model is:

- Session `S`: the long-lived session truth.
- Operation stream `O`: ordered updates and user-visible actions.
- Blocks `B`: heterogeneous content units.
- Messages `M`: conversational or action-level groupings.
- Viewport `V`: the bounded visible region.
- Visible projection `P`: the bounded result for `V`.
- Priority lanes: `urgent-input > visible-projection > stream-update > background-indexing`.

The failure mode is:

```text
User action
-> state/context propagation
-> subscriber fanout
-> microtask flush
-> derived computation / framework coordination
-> main-thread long task
-> delayed input/visible response
```

The design implication is that session truth should not be the DOM tree alone. Session-scale derived work should move off-main-thread where possible, visible projection should be bounded, urgent input and visible projection need scheduling priority, stale projection should be rejected, and equivalence/checksum/lineage are needed for correctness.

## 3. Related Work and Related Systems

This work sits near several mature system families. The goal is not to argue that those systems are ineffective; it is to identify the narrower gap addressed by a worker-resident, transaction-scheduled, bounded-projection runtime direction for long-lived AI surfaces.

Virtualized lists and viewport rendering reduce mounted DOM nodes and visible rendering work. They are highly relevant for transcripts, long lists, and scrollback-like views. They do not necessarily move session-scale state/fanout, derived metadata, subscriber updates, or action-triggered microtask work off the main thread. This paper focuses on runtime placement and bounded projection, not only DOM node count.

Editor architectures separate document buffers from viewport rendering. That buffer/viewport separation directly inspires this paper's worker-resident state and bounded projection direction. The difference is workload shape: long-lived AI surfaces include heterogeneous semantic blocks, tool calls, citations, agent traces, streaming outputs, and provenance metadata. Many AI surfaces are not simply editable text buffers.

Terminal and scrollback systems are append-heavy and viewport-centric. AI surfaces share the retained-history and bounded-view intuition, but they require richer semantic structure and interaction: messages, code/log blocks, citations, tool outputs, provenance, expansion, and scheduling between background session work and urgent visible projection.

React concurrent features and render scheduling may help prioritize rendering and avoid blocking some UI updates. They are relevant baselines for future evaluation. Render scheduling alone, however, does not define worker-resident session state, a cross-thread transaction protocol, or a bounded projection contract. The paper does not claim React is bad; it claims session-scale state/fanout placement can be a bottleneck that render prioritization alone may not remove.

Workerized state and off-main-thread architectures are also known directions. This paper's contribution is not merely "use a Worker." F1 evaluates equivalent worker offload for controlled derived fanout, and F2 evaluates Worker-side transaction scheduling after offload. P2 pure core freezes a workload-specific contract around protocol validation, op-log/state-store, transaction scheduling, bounded projection, recovery, metrics, and fail-closed correctness.

Browser scheduling APIs and cooperative scheduling are related to F2's chunk/yield/preemption idea. The paper does not depend on one browser scheduling API. Future work should compare scheduling primitives, overhead, fairness, starvation, and multi-urgent behavior; the current F2 claim is limited to same-clock urgent acknowledgement and projection-commit latency in a controlled workload.

Canvas, OffscreenCanvas, and WebGPU are relevant presentation backends for large visual surfaces. They may become useful after the runtime boundary is correct. Current evidence points first to state/fanout/scheduling and projection boundaries, not renderer throughput. Canvas/WebGPU are deferred, not dismissed.

| Area | Helps With | Does Not Necessarily Solve | This Paper's Position |
|---|---|---|---|
| Virtualized lists | Mounted DOM nodes and visible list rendering. | Session-scale state/fanout or derived metadata on main thread. | Relevant baseline; runtime placement and bounded projection remain separate. |
| Editor architectures | Buffer/viewport separation and incremental document updates. | Heterogeneous AI blocks, tool outputs, citations, provenance, and scheduling. | Inspires the state/projection split but does not cover the whole workload. |
| Terminal/scrollback systems | Append-heavy output with retained history and bounded viewport. | Rich semantic blocks, interaction, provenance, and urgent/background projection. | Close analogy for append/viewport shape; AI surfaces need richer contracts. |
| React concurrent/render scheduling | Rendering prioritization and some responsiveness improvements. | Worker-resident session state, transaction protocol, or bounded projection. | Relevant baseline; not rejected, but not the same architectural boundary. |
| Workerized state | Moving compute or state off the main thread. | Workload-specific scheduling, projection safety, lineage, and recovery. | Workers are known; the contribution is the evidence chain and runtime contract. |
| Browser scheduling APIs | Chunking, yielding, and cooperative responsiveness. | Session model, projection protocol, or correctness boundary by itself. | Related mechanism; F2 remains API-agnostic scheduler evidence. |
| Canvas/OffscreenCanvas/WebGPU | Presentation throughput for visual surfaces. | State/fanout placement, transaction scheduling, or projection correctness. | Future backend gate; current evidence points to runtime boundaries first. |

Final citations are still needed for virtualized lists, editor buffer architectures, terminal scrollback systems, React concurrent scheduling, workerized state systems, browser scheduling APIs, and Canvas/OffscreenCanvas/WebGPU rendering systems.

## 4. Product Trace Motivation

The product trace question is whether sluggish long-lived AI surfaces are dominated primarily by rendering/layout/paint or by action-triggered scripting, microtasks, and state coordination.

**Figure 2. Product trace mechanism shape.**  
Product traces motivate a mechanism-family hypothesis rather than a source-level claim. The observed action path goes from click/pointerup into Run microtasks and distributed app coordination, with hints of state/context propagation and fanout-like work. This motivates F0-D's controlled derived-fanout reproduction, but does not claim product source replay or exact root-cause attribution.

Rendered draft: `docs/paper/figures/figure-2-p0-product-trace-mechanism-shape-v0.svg`

Product-side traces show action-triggered `click/pointerup` paths. Across the preserved evidence, the observed shape is:

```text
click/pointerup -> Run microtasks
```

Ownership appears distributed across multiple bundles and unattributed regions rather than one obvious function. Source-semantics hints such as `setContextProperty` support a state/context propagation interpretation. These names do not prove exact source semantics, but they are consistent with state propagation, reactive dependency updates, subscriber notification, or fanout-like behavior.

The mechanism family supported by P0 is multi-bundle app coordination / state-context propagation / subscriber-fanout-like behavior. P0 helps distinguish broad mechanism families: rendering/layout/paint dominated, GC dominated, React commit dominated, or scripting/microtask/app coordination dominated. The preserved evidence supports the scripting/microtask/app-coordination family.

This does not prove product source replay. It does not establish exact source-map ownership, exact semantics of minified symbols, or that all product latency comes from this mechanism. It also does not prove that React is the root cause, that DOM rendering is irrelevant, or that a Worker runtime would directly solve the product without architecture changes.

P0 therefore motivates a controlled reproduction rather than replacing one overclaim with another. The next question is whether action-triggered derived fanout / queue drain / state traversal can produce stable main-thread long tasks in a controlled workload.

## 5. Controlled Reproduction: F0-D

F0-D creates a controlled production-React-style workload that models action-triggered derived fanout, queue drain, and state traversal. It runs the derived work on the main thread with session-sized state, multiple modules, subscribers, selector-like passes, and queued work. It is a bounded synthetic structure, not product trace replay.

The research question is whether this controlled mechanism can reproduce the broad bottleneck family suggested by product traces: microtask/flush-heavy app coordination rather than layout, paint, or GC dominance.

F0-D 3x aggregate:

- `measured_count=3`
- `valid_count=3`
- `parity_fail_count=0`
- `boundary_positive_count=3`
- `decision=F0D_3X_BOUNDARY_POSITIVE`
- `f0_window_ms` mean ≈ `73.764ms`
- `f0_microtask_window_ms` mean ≈ `66.987ms`
- `f0_run_task_max_ms` mean ≈ `68.633ms`
- `long_task_count_50ms = 1/run`

Offline attribution shows that the long task is dominated by F0 microtask / flush target work. `RunMicrotasks` and target-page `FunctionCall` dominate the long task. React commit is smaller and occurs after the flush. Layout/Paint/Style are small, and MajorGC / MarkCompactor does not dominate.

F0-D therefore reproduces the mechanism family suggested by P0:

```text
synthetic click
-> RunMicrotasks
-> target FunctionCall
-> module/subscriber derived fanout
```

The safe interpretation is that action-triggered derived fanout can produce stable 50ms+ main-thread long tasks in a controlled setting. F0-D does not reproduce ChatGPT exactly, does not prove all product latency comes from derived fanout, does not prove React is the root cause, and does not prove the final runtime is sufficient. It establishes a controlled main-thread bottleneck baseline for F1.

## 6. Worker Offload: F1

F1 tests whether equivalent derived fanout / queue drain / state traversal work can be moved to a Worker so that main-thread long tasks disappear without skipping or reducing structural work.

F1 Worker B is compared against the F0-D main-thread baseline. It keeps the structural workload equivalent while moving heavy derived fanout work to a Worker. The main thread receives bounded projection / visible update work. F1 does not claim a renderer backend change, does not use Canvas/WebGPU, and does not replay product internals.

Equivalent work signals include preserved module count, subscriber notify count, queue drain steps, derived selector eval count, state nodes touched, derived hash rounds, projection update count, worker checksum, and equivalence counters.

**Figure 3. F0-D vs F1 main-thread comparison.**  
F0-D reproduces an action-triggered, microtask-dominated main-thread long task in a controlled derived-fanout workload. F1 preserves equivalent structural work but moves the heavy derived-fanout path to a Worker, reducing main-thread max task time from ≈68.633ms to ≈2.679ms and eliminating 50ms+ main-thread long tasks in the controlled setting.

Rendered draft: `docs/paper/figures/figure-3-f0d-vs-f1-main-thread-comparison-v0.svg`

Main comparison:

| Metric | F0-D Main-thread | F1 Worker B | Interpretation |
|---|---:|---:|---|
| Main max task mean | ≈ `68.633ms` | ≈ `2.679ms` | Main-thread long task removed |
| Main long task count | `1/run` | `0/run` | Main-thread long tasks removed |
| Worker compute mean | `n/a` | ≈ `51.367ms` | Compute moved off main |
| Worker roundtrip mean | `n/a` | ≈ `55.433ms` | Async Worker path cost |

F1 shows that the controlled F0-D bottleneck is not inherently tied to main-thread rendering. Equivalent derived fanout work can be moved off-main-thread, removing 50ms+ main-thread long tasks in the controlled setting.

The timing should not be overread as cycle-identical execution. Worker compute differs from main-thread execution because of execution environment, main-thread-specific overhead, JIT/cache effects, or path details despite equivalent counters. The equivalence claim is structural and counter/checksum-based.

F1 validates Worker offload as a solution lever for derived/session-scale fanout work. It does not prove all UI work can move to a Worker, does not move DOM/React commit, does not prove production runtime success, does not generalize to every workload, and does not imply Canvas/WebGPU relevance.

## 7. Worker-side Scheduling: F2

F1 moves heavy work off the main thread. F2 asks whether Worker execution itself still needs scheduling to avoid delaying urgent projection work.

F2 compares two Worker-side execution arms under equivalent structural work:

- F2-A Monolithic: `scheduler_mode=monolithic`, `worker_chunk_size=all`, `worker_chunk_count=1`, `worker_yield_count=0`, `worker_preemptions=0`.
- F2-B Scheduled: `scheduler_mode=scheduled`, `worker_chunk_size=128`, `worker_yield_strategy=message-channel`, `worker_chunk_count=313`, `worker_yield_count=312`, `worker_preemptions=1`.

Both arms preserve equivalent structural work: `module_flush_count=20`, `subscriber_notify_count=1920`, `queue_drain_step_count=5120`, `derived_selector_eval_count=15360`, `state_nodes_touched_observed=32768`, `derived_hash_rounds_observed=131072`, `projection_update_count_observed=6`, and `synthetic_pressure_multiplier=1`.

Figure 4 illustrates the scheduling difference. F2-A runs Worker work monolithically, so urgent projection waits behind heavy work. F2-B chunks/yields Worker work, allowing urgent projection to be admitted between chunks. This explains why F2-B has lower urgent projection-commit latency despite higher total Worker heavy transaction time.

**Figure 4. F2 monolithic vs scheduled Worker timeline.**  
F2 compares monolithic Worker execution with scheduled/chunked Worker execution. F2-B increases total Worker heavy transaction time due to chunk/yield overhead, but it admits urgent projection work between chunks, reducing same-clock urgent acknowledgement from ≈20.933ms to ≈0.900ms and urgent projection-commit latency from ≈22.867ms to ≈3.333ms. The result is a responsiveness tradeoff, not a throughput improvement.

Rendered draft: `docs/paper/figures/figure-4-f2-worker-scheduling-timeline-v0.svg`

F2 A/B paired 3x aggregate:

- `measured_count=6`
- `valid_a_count=3`
- `valid_b_count=3`
- `equivalence_a_pass=true`
- `equivalence_b_pass=true`
- `decision=F2_AB_3X_SCHEDULER_POSITIVE`

Main result:

| Metric | F2-A Monolithic | F2-B Scheduled | Interpretation |
|---|---:|---:|---|
| Urgent main ack latency mean | ≈ `20.933ms` | ≈ `0.900ms` | Scheduled admits urgent work sooner |
| Urgent projection-commit latency mean | ≈ `22.867ms` | ≈ `3.333ms` | Scheduled projection-commit response is lower |
| Main max task mean | ≈ `2.810ms` | ≈ `2.378ms` | Both keep main thread bounded |
| Worker heavy txn total mean | ≈ `26.8ms` | ≈ `48.533ms` | Scheduled pays chunk/yield overhead |
| Worker chunk count | `1` | `313` | Scheduled splits work |
| Worker yield count | `0` | `312` | Scheduled yields |
| Worker preemptions | `0` | `1` | Scheduled admits urgent projection |

All three paired deltas favor F2-B scheduled. The result is not a throughput win. F2-B is slower in total Worker compute, but admits urgent projection work much sooner. The positive result is a responsiveness tradeoff: scheduled Worker transaction processing reduces same-clock urgent acknowledgement and projection-commit latency relative to monolithic Worker execution.

F2 uses same-clock urgent metrics as the final A/B basis: `urgent_main_ack_latency_ms` and `urgent_end_to_end_visible_ms`. It does not claim full display pipeline latency, paint, compositor, monitor scanout, or exact human-perceived pixel latency. It also tests one urgent projection request per run; multi-urgent behavior remains future work.

## 8. Runtime Design Implications

The evidence chain points toward a runtime architecture with worker-resident state/fanout, an operation log, transaction scheduling, bounded projection, and fail-closed correctness.

The session truth should not be only the DOM or VDOM tree. Long-lived AI surfaces retain session-scale state, append heterogeneous blocks, and require derived work that can exceed the current viewport. P2 pure core v0 therefore freezes a pure state-store and op-log scaffold: accepted operations are logged, blocks/messages/session version are tracked, rejected operations do not mutate state, and duplicate message/operation/chunk protections support replay safety.

F2 motivates priority lanes and transaction scheduling. The priority order is:

```text
urgent-input > visible-projection > stream-update > background-indexing
```

P2 includes scheduler policy and transaction validation so a future Worker gate has a narrow policy surface to test. This is not a full scheduler queue implementation; it is a pure policy layer for future Worker scheduling.

The main thread should receive only bounded visible projection, not full session state. P2 includes projection policy and a pure main projection adapter. Projection validation checks session and result versions, stale/future status, checksum, visible range shape, block references, block shape, unique block IDs, estimated bytes, optional equivalent-work counters, and explicit projection bounds.

Future Worker runtime will require message passing, so P2 includes deterministic JSON-like serialization validation and UTF-8 byte measurement for payload limits. It rejects non-serializable or unsafe values such as functions, symbols, bigint, `undefined`, `NaN`, `Infinity`, cycles, class instances, `Date`, `Map`, `Set`, `RegExp`, `Error`, and excessive depth or size.

Fail-closed correctness is a core implication. Malformed envelopes, operations, transactions, checksums, ranges, stale operations, duplicate identities, non-integer versions/counts, malformed projections, and invalid backpressure state reject before they can corrupt state or create ambiguous commits.

Trace, metrics, and recovery are engineering scaffolds for testability and future integration. Decision trace records where a decision passed or failed, metrics snapshot provides machine-readable state summaries, and recovery policy maps errors to safe recommendations while preserving lineage such as `message_id`, `parent_action_id`, `txn_id`, and `trace_context` where available.

P2 pure core v0 is frozen as an engineering/runtime-core scaffold. It is not a final runtime implementation. It does not open real Worker runtime, real main runtime, projection engine, DOM/React integration, Canvas/WebGPU, benchmark expansion, or product integration.

## 9. Limitations and Future Work

The product trace evidence motivates a mechanism-family hypothesis. It is not source replay, does not prove exact product implementation, and does not prove all product latency comes from the observed mechanism. Minified and multi-bundle traces limit precise ownership claims.

F0-D is controlled mechanism-family reproduction. It is smaller than some product bursts and does not quantitatively replay 400-650ms product traces. It validates a controlled main-thread fanout bottleneck, not all possible AI UI workloads.

F1 validates Worker offload for equivalent derived fanout work. It does not prove all UI work can move off-main-thread. DOM commit, layout, paint, input/caret/focus, accessibility, and some framework behavior remain main-thread concerns. Worker compute is not cycle-identical to main-thread compute.

F2 validates scheduled/chunked Worker execution for one urgent visible projection request. It does not prove multi-urgent behavior. It improves urgent responsiveness while increasing Worker total time, so it is not a total throughput improvement. It measures projection-commit latency, not full pixel or user-perceived latency.

P2 pure core v0 is not a production runtime. It does not implement real Worker runtime, real main runtime, projection engine, DOM/React integration, Canvas/WebGPU, or product integration. P2 modules are not all experimentally proven; many are engineering scaffolds for correctness and future integration.

Measurement validity is bounded. The F0-D/F1/F2 aggregates use 3x sample sizes, so they should not be read as confidence-interval claims. Controlled workloads are structurally motivated, not product replay. Trace capture can be sensitive to foreground/visibility effects; stale-server/stale-target and warmup/JIT/cache effects were observed risks and controlled where possible. F2 same-clock urgent metrics are acknowledgement and projection-commit measures, not full display-pipeline or pixel latency, and F2-B is a responsiveness improvement rather than a total throughput improvement.

Future evidence needed before stronger runtime claims includes:

- multi-urgent scheduling stress;
- broader workload matrix: chat transcript, agent trace, code review, log surface, long document review;
- real Worker boundary smoke;
- projection engine prototype;
- accessibility and input/focus/caret model;
- comparison with stronger baselines such as virtualized DOM, editor-style buffers, React concurrent features, and possibly workerized state libraries;
- memory growth / long-session retention analysis;
- browser display pipeline, paint, and compositor timing if making user-perceived latency claims.

Future gates must remain narrow:

- Real Worker Runtime Gate v0: one serializable message across a minimal Worker boundary, Worker calls pure adapter, returns machine-readable output, no DOM/React, no projection engine, no product integration.
- Projection Engine Gate: `SessionState + visible_range -> bounded ProjectionResultShape`, preserving projection-policy safety, no DOM/React, no Canvas/WebGPU initially.
- Multi-Urgent Scheduler Gate: multiple urgent projection requests during heavy Worker work, measuring fairness, starvation, and latency while preserving equivalent work counters.
- Presentation Backend Gate: Canvas/OffscreenCanvas/WebGPU only after the runtime boundary is stable.

This paper does not solve all web jank, does not replace React/DOM universally, does not build a production UI framework, does not claim WebGPU is required, does not claim every AI UI workload shares the same bottleneck, and does not claim accessibility or product integration readiness.

## 10. Conclusion

Long-lived AI surfaces are a distinct UI workload: append-heavy, viewport-centric, session-scale, and interaction-rich. The bottleneck in this workload is not necessarily rendering alone. Product-motivated traces and controlled reproduction show that action-triggered state/fanout/microtask coordination can create main-thread responsiveness problems before a renderer backend is the first missing lever.

The evidence chain is bounded but coherent. P0 motivates the mechanism family. F0-D shows that controlled action-triggered derived fanout can reproduce stable microtask-dominated main-thread long tasks. F1 shows that equivalent derived fanout work can be moved off-main-thread, removing main-thread long tasks in the controlled setting. F2 shows that scheduled/chunked Worker execution reduces same-clock urgent projection acknowledgement and projection-commit latency relative to monolithic Worker execution. P2 pure core v0 freezes the resulting runtime-core implications as an engineering scaffold.

The immediate next step should not be broad implementation. The next valid paths are to assemble and review this short-paper draft, or to run a narrowly gated real Worker boundary smoke only if the draft exposes a concrete evidence gap. The preferred next step is paper review first, because it will reveal whether more evidence is needed before opening implementation gates.

In controlled settings, action-triggered derived fanout can reproduce main-thread long tasks; equivalent worker offload can remove those long tasks; and worker-side scheduling can reduce urgent projection-commit latency. Together, these results support a worker-resident, transaction-scheduled, bounded-projection runtime direction for long-lived AI surfaces, while leaving production runtime implementation and broader validation to future work.

P2 pure core remains frozen. Projection engine, real Worker runtime, real main runtime, DOM/React integration, Canvas/WebGPU, and product integration remain paused.

## Figures and Tables Still To Finalize

Figures 1-4 now have placeholder/caption blocks, separate specs, and rendered draft SVGs. Final publication export/layout may still be needed before external sharing.

- Figure 1: final camera-ready layout/export for workload-architecture mismatch if needed
- Figure 2: final camera-ready layout/export for P0 trace mechanism shape if needed
- Figure 3: final camera-ready layout/export for F0-D vs F1 main-thread comparison if needed
- Figure 4: final camera-ready layout/export for F2 timeline if needed
- Table 3: P2 module classification if not already included
