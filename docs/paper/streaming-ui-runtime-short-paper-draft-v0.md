# A Streaming UI Runtime for Long-Lived AI Surfaces

## Abstract

Long-lived AI interfaces are increasingly append-heavy, viewport-centric, long-lived, and tail-mutating. They are not ordinary document pages: users keep interacting with a growing transcript, trace, or review surface while the underlying session state continues to expand. The core thesis is a workload-architecture mismatch: document/tree-oriented UI stacks can cause ordinary interactions to trigger session-scale coordination/fanout pressure. Product-motivated traces show `click/pointerup` leading to `Run microtasks` and multi-bundle state/context coordination, but those traces motivate and constrain the thesis rather than serving as publishable benchmark proof. We evaluate the mechanism through a bounded evidence chain: F0-D reproduces the bottleneck in a controlled derived-fanout workload with `f0_run_task_max_ms` mean ≈ `68.633ms`; F1 moves equivalent derived fanout off the main thread, reducing main max task mean to ≈ `2.679ms`; and F2 reduces urgent acknowledgement latency from ≈ `20.933ms` to ≈ `0.900ms` and urgent projection-commit latency from ≈ `22.867ms` to ≈ `3.333ms` with scheduled Worker execution. P2 freezes the pure-core runtime scaffold; prior P3/P3.5 material should be read as constrained boundary and external-validity framing, not product-grade presentation backend completion. P5 adds synthetic scheduling-delay proxy evidence after P5-X: P5-X product-trace-shaped synthetic scheduling-delay proxy: B2x `176.1ms` vs R0x `0.1ms` under equal trace/logical invariants. This v0.2 draft is a HotOS/workshop/position-style short paper, not a full EuroSys/SOSP-style evaluation paper, not product source replay, not a final production runtime, not browser-level INP or Event Timing evidence, and not a Canvas/WebGPU or P4 authorization claim.

## 1. Introduction

AI surfaces are not ordinary pages. A long-lived AI session can begin like a chat, grow into a transcript, become an agent trace or code review surface, accumulate tool results, and still remain interactive. The dominant operation is often append, not replace. Tokens, messages, logs, citations, intermediate results, and review artifacts keep joining an already-large session.

The visible viewport may show only a narrow slice, but the session state behind that slice can be large and long-lived. Users scroll, click, select, expand traces, issue follow-up prompts, and inspect historical context while the session keeps growing. The UI is viewport-centric, but the state model is session-scale.

This paper's core claim is deliberately sharper than "DOM/VDOM is slow." Long-lived AI surfaces expose a workload-architecture mismatch because append-heavy, viewport-centric, long-lived, tail-mutating workloads are being served by document/tree-oriented UI stacks, causing ordinary interactions to trigger session-scale coordination/fanout pressure.

**Figure 1. Workload-architecture mismatch in long-lived AI surfaces.**  
Long-lived AI surfaces are append-heavy and viewport-centric, but their session state and derived fanout can grow far beyond the visible region. In a document-oriented stack, action-triggered state/fanout work may run on the main thread before a visible update. The proposed runtime direction moves session-scale state and scheduling into a Worker and sends only bounded, validated projections to the main thread.

Rendered draft: `docs/paper/figures/figure-1-workload-architecture-mismatch-v0.svg`

Current DOM/VDOM stacks are powerful document-oriented tools, but this workload can place too much session-scale state/fanout work on the main thread. A local-looking action can trigger `Run microtasks`, state propagation, subscriber fanout, queue drains, framework coordination, and derived computation. When those paths run on the main thread, input responsiveness can degrade before layout, paint, or a renderer backend is the dominant issue.

This paper argues for a runtime direction rather than a renderer-first replacement: worker-resident session state and fanout, transaction scheduling for urgent and background work, and bounded projection back to the main thread. The main thread remains important, but its role should shift toward committing safe, current, bounded visible projections rather than owning every session-scale coordination step.

P3.5 does not replace that thesis. It qualifies it: real products can express this pressure through different product strategies and tradeoffs. A surface can be responsive while sacrificing reliable early active-context access; another can show a similar microtask/app-coordination mechanism with lower subjective severity. This paper therefore separates mechanism signal, subjective UX severity, visible transcript continuity, active model-context fidelity, and app-side coordination cost.

The target paper type is a HotOS/workshop/position-style short paper. The goal is to make a bounded workload/runtime argument with explicit evidence classes, not to claim the evaluation completeness of a mature full systems paper.

Table 1 summarizes the bounded evidence chain.

| Stage | Question | Evidence / Method | Key Result | Safe Interpretation | Boundary |
|---|---|---|---|---|---|
| Product/P0 | What mechanism family appears in product traces? | `click/pointerup` trace ownership decomposition. | `click/pointerup -> Run microtasks` / multi-bundle state-context coordination. | Product traces motivate an action-triggered app-coordination hypothesis. | Not source replay; not exact product implementation. |
| F0-D | Can controlled derived fanout reproduce a main-thread long task? | Controlled 3x derived fanout workload. | `f0_run_task_max_ms` mean ≈ `68.633ms`; `long_task_count_50ms = 1/run`. | Controlled mechanism-family reproduction. | Not quantitative product replay. |
| F1 | Can equivalent derived fanout leave the main thread? | Worker B 3x with equivalence counters. | Main max task mean ≈ `2.679ms`; long task count = `0`. | Worker offload is a credible solution lever for derived/session-scale fanout. | Not proof all UI work can move off-main-thread. |
| F2 | Does Worker-side scheduling matter after offload? | Paired monolithic vs scheduled Worker A/B. | Urgent ack ≈ `20.933ms -> 0.900ms`; urgent projection-commit ≈ `22.867ms -> 3.333ms`. | Scheduled Worker improves urgent responsiveness. | Not throughput win; not full pixel latency. |
| P2 Pure Core | What runtime direction follows? | Frozen pure core scaffold. | Protocol/state/scheduler/projection correctness kernel frozen. | Engineering scaffold for future runtime gates. | Not production runtime. |
| P3 Boundary / external-validity framing | What constrained runtime-boundary and product-strategy questions remain after P2? | P3/P3.5 notes discuss bounded Worker/projection/rendering/transaction/commit-cycle boundaries and product-strategy-dependent symptoms. | Treat as constrained architecture/external-validity framing. | Useful for scoping later gates. | Not production presentation backend completion, not product UI, not performance superiority, and not P4 eligibility. |
| P3.5 External Validity | Is the product story uniformly ChatGPT-shaped? | Privacy-bounded ChatGPT, Claude, and Gemini triage. | ChatGPT is high-severity reference; Claude is same mechanism family with lower subjective severity; Gemini is responsive/context-windowing divergence. | Product-strategy-dependent interpretation. | Not publishable benchmark evidence; not product ranking; not exact architecture. |
| P5 Scheduling Evidence | Does worker-resident ownership preserve synthetic input-task availability under long-lived AI-surface workloads? | P5-M/O/Q/S/U/X synthetic scheduling-delay proxy results. | P5-X product-trace-shaped synthetic scheduling-delay proxy: B2x `176.1ms` vs R0x `0.1ms` under equal trace/logical invariants, read as blocked-vs-near-unblocked scheduling category. | Strongest current scheduling-mechanism evidence. | Not browser-level INP, not Event Timing, not real product superiority, not production readiness. |

Table 2 states the claim boundaries that should govern the rest of the paper.

| Claim Area | Supported Claim | Not Claimed | Future Evidence Needed |
|---|---|---|---|
| Product traces | Mechanism-family hypothesis. | Exact source replay / full product root cause. | Broader product traces / source-level validation if available. |
| F0-D | Controlled derived fanout can create main-thread long tasks. | Quantitative product replay. | Broader controlled workloads. |
| F1 | Equivalent derived work can move off-main-thread. | All UI work can move to Worker. | Real Worker boundary / more workload classes. |
| F2 | Scheduled Worker reduces urgent projection-commit latency. | Total throughput improvement / exact pixel latency. | Multi-urgent stress / display pipeline timing. |
| P2 Pure Core | Frozen correctness scaffold. | Production runtime. | Real Worker/main/projection gates. |
| P3 Boundary / external-validity framing | Constrained architecture and product-strategy framing. | Production presentation backend completion, production loop, renderer correctness, viewport manager, scroll restoration, performance superiority. | Direct P3 artifact reconciliation before stronger P3 claims. |
| P3.5 External Validity | Product-strategy-dependent pressure across bounded commercial-system observations. | Universal AI-product behavior, product ranking, exact architecture, exact source ownership. | Controlled synthetic benchmark that separates visible history and active context. |
| P5 Scheduling Evidence | Worker-resident ownership can reduce and localize main-thread blocking under synthetic long-lived AI-surface workloads. | Browser-level INP, Event Timing, real product superiority, production readiness, P4 authorization, or precise user-perceived speedup ratios. | Optional browser-level interaction evidence only if the project explicitly shifts to that question. |
| Rendering backend | Renderer is not the first lever in current evidence. | Canvas/WebGPU irrelevant forever. | Presentation backend experiments after runtime boundary. |
| Production readiness | None. | Accessibility/product readiness. | Accessibility, focus/caret/input, integration tests. |
| Generalization | Current controlled workload family. | All AI surfaces. | Broader workload matrix. |

The paper contributes:

1. a workload characterization of long-lived AI surfaces as append-heavy, viewport-centric, session-scale, tail-mutating workloads with distinct visible-history and active-context dimensions;
2. a controlled mechanism / architecture evidence chain connecting product-side symptoms to fanout, scheduling, projection, bounded runtime contracts, and P5 synthetic scheduling evidence while keeping evidence classes separate;
3. a worker-resident, transaction-scheduled, bounded-projection runtime direction for controlling session-scale coordination on the interaction path;
4. a bounded external-validity interpretation across ChatGPT, Claude, and Gemini, or anonymized commercial systems in a public draft, showing that product manifestations differ and that benchmark design must account for product strategy without claiming real product superiority.

## 2. Background and Workload Model

A long-lived AI surface is an interactive UI for a long-running session whose state keeps growing while the user continues to interact with it. It can include chat, agent trace, code review, logs, reasoning traces, tool calls, citations, and long document review.

The workload has five key properties.

First, it is append-heavy. New content is frequently appended, output can stream, and blocks may grow over time. Tail mutation matters because new writes, visible updates, derived metadata, and user interaction often meet near the same boundary.

Second, it is session-scale. The session grows beyond the current viewport, and old state cannot always be discarded. Earlier messages, citations, tool calls, logs, and review artifacts may remain relevant for navigation, provenance, search, summarization, references, and future user actions.

Third, it is viewport-centric. The user sees a bounded region at any moment. Ideally, the main thread should receive a bounded visible projection rather than needing to own the full session state for every visible update.

Fourth, it has heterogeneous block structure. AI surfaces contain messages, markdown, code, tool calls, status blocks, citations, logs, agent traces, partial outputs, and review artifacts. Each block type can have different update and rendering behavior.

Fifth, it has concurrent interaction. User input, scrolling, clicking, selection, expansion, and new output can overlap. Urgent visible actions should not wait behind background session work.

P3.5 adds a sixth modeling requirement: visible transcript continuity and active model-context continuity are not the same axis. A product can preserve a long visible transcript while using active-context windowing or memory policy that makes older visible content unreliable as model context. Future benchmarks therefore need to vary visible transcript length, active-context fidelity, append-heavy output, send/click interaction paths, scroll/old-history interaction, artifact/card/separate-surface routing, background scheduling, and the main-thread interaction critical path. This is a benchmark-design implication, not a completed benchmark result in this paper.

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

CodeMirror and Monaco represent editor-grade surfaces with mature buffer, viewport, and incremental-update models. That buffer/viewport separation directly inspires this paper's worker-resident state and bounded projection direction. The difference is workload shape: long-lived AI surfaces include heterogeneous semantic blocks, tool calls, citations, agent traces, streaming outputs, artifact routing, provenance metadata, and active model-context concerns. Many AI surfaces are not simply editable text buffers.

xterm.js and terminal scrollback systems are close analogies for append-heavy retained history and bounded viewport. AI surfaces share the retained-history and bounded-view intuition, but they require richer semantic structure and interaction: messages, code/log blocks, citations, tool outputs, provenance, expansion, and scheduling between background session work and urgent visible projection.

Zed / GPUI-style app/runtime systems are relevant because they treat UI performance as an application/runtime architecture problem rather than only a DOM optimization problem. This paper's narrower contribution is not a general app framework claim; it is a workload-specific framing for long-lived AI surfaces and a bounded projection / transaction scheduling direction.

Flutter, React, and general UI frameworks remain capable systems. React concurrent features and render scheduling may help prioritize rendering and avoid blocking some UI updates, and they are relevant baselines for future evaluation. Render scheduling alone, however, does not define worker-resident session state, a cross-thread transaction protocol, or a bounded projection contract. The paper does not claim React is bad; it claims session-scale state/fanout placement can be a bottleneck that render prioritization alone may not remove.

Workerized state and off-main-thread architectures are also known directions. This paper's contribution is not merely "use a Worker." F1 evaluates equivalent worker offload for controlled derived fanout, and F2 evaluates Worker-side transaction scheduling after offload. P2 pure core and P3 boundary work freeze a workload-specific contract around protocol validation, op-log/state-store, transaction scheduling, bounded projection, rendering transactionization, admission, commit-cycle records, and fail-closed correctness.

Browser scheduling APIs and cooperative scheduling are related to F2's chunk/yield/preemption idea. The paper does not depend on one browser scheduling API. Future work should compare scheduling primitives, overhead, fairness, starvation, and multi-urgent behavior; the current F2 claim is limited to same-clock urgent acknowledgement and projection-commit latency in a controlled workload.

Document/canvas-first systems such as Google Docs- or Figma-style surfaces are also adjacent when presentation throughput, document scale, or visual collaboration dominates. This paper does not claim those systems are the wrong direction for all workloads. It claims the current evidence points first to state/fanout/scheduling and projection boundaries for long-lived AI surfaces. Canvas, OffscreenCanvas, and WebGPU may become useful after the runtime boundary is correct; they are deferred, not dismissed, and not authorized by P3.5.

| Area | Helps With | Does Not Necessarily Solve | This Paper's Position |
|---|---|---|---|
| Virtualized lists | Mounted DOM nodes and visible list rendering. | Session-scale state/fanout or derived metadata on main thread. | Relevant baseline; runtime placement and bounded projection remain separate. |
| CodeMirror / Monaco | Buffer/viewport separation and incremental document updates. | Heterogeneous AI blocks, tool outputs, citations, active model context, artifact routing, provenance, and scheduling. | Inspires the state/projection split but does not cover the whole workload. |
| xterm.js / terminal scrollback | Append-heavy output with retained history and bounded viewport. | Rich semantic blocks, interaction, provenance, and urgent/background projection. | Close analogy for append/viewport shape; AI surfaces need richer contracts. |
| Zed / GPUI-style app/runtime systems | App/runtime-level performance architecture. | This paper's specific long-lived AI-surface workload model and evidence chain. | Relevant adjacent systems; not the same contribution. |
| Flutter / React / general UI frameworks | General UI composition, rendering, scheduling, and ecosystem integration. | Worker-resident session state, transaction protocol, or bounded projection by default. | Relevant baselines; not rejected, but not the same architectural boundary. |
| Workerized state | Moving compute or state off the main thread. | Workload-specific scheduling, projection safety, lineage, and recovery. | Workers are known; the contribution is the evidence chain and runtime contract. |
| Browser scheduling APIs | Chunking, yielding, and cooperative responsiveness. | Session model, projection protocol, or correctness boundary by itself. | Related mechanism; F2 remains API-agnostic scheduler evidence. |
| Document/canvas-first systems | Presentation throughput, document-scale interaction, or visual collaboration. | State/fanout placement, active model-context tradeoffs, or AI-specific surface routing by itself. | Future comparison area; not evidence for Canvas/WebGPU necessity. |
| Canvas/OffscreenCanvas/WebGPU | Presentation throughput for visual surfaces. | State/fanout placement, transaction scheduling, or projection correctness. | Future backend gate; current evidence points to runtime boundaries first. |

Final citations are still needed for virtualized lists, editor buffer architectures, terminal scrollback systems, React concurrent scheduling, workerized state systems, browser scheduling APIs, and Canvas/OffscreenCanvas/WebGPU rendering systems.

## 4. Product Motivation and External-Validity Framing

The product evidence question is whether sluggish long-lived AI surfaces are dominated primarily by rendering/layout/paint or by action-triggered scripting, microtasks, and state coordination. Product evidence is used here as bounded motivation and external-validity framing. It is not product source replay, not exact internal architecture evidence, not product ranking, and not publishable controlled benchmark proof.

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

P3.5 adds a bounded cross-system interpretation:

| System framing | Observed role | Safe interpretation | Boundary |
|---|---|---|---|
| ChatGPT, or System A in anonymized public wording | High-severity reference case. | Existing long sessions remain the strongest user-visible degradation symptom and primary product motivator. | Not universal AI-product behavior; not exact source ownership; not P4 authorization. |
| Claude, or System B | Same-mechanism-family, lower subjective severity. | A non-ChatGPT product can show send/click -> Run microtasks / app-coordination pressure while remaining subjectively acceptable in the sample. | Not a second ChatGPT-level UX failure; not product ranking; not exact architecture. |
| Gemini, or System C | Responsive/context-windowing divergence. | Low observed interaction cost can coexist with unreliable early-context access, suggesting product-strategy tradeoffs. | Not proof that Gemini solves long-session pressure; not proof of exact context-windowing architecture. |

This framing changes how the paper should speak. The safe claim is not "all AI products fail like ChatGPT." The safe claim is that long-session AI surfaces expose a workload whose symptoms are product-strategy dependent, and future benchmarks must model both visible transcript continuity and active model-context continuity.

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

P2 pure core v0 is frozen as an engineering/runtime-core scaffold. P3/P3.5 references in this draft should be read conservatively: they frame constrained runtime-boundary and external-validity questions, not product-grade presentation backend completion. Current project packaging still treats production Worker/Main runtime, DOM/React integration, projection engine, Canvas/OffscreenCanvas/WebGPU backend, product integration, viewport manager, scroll restoration, and P4 implementation as out of scope.

## 9. Discussion, Limitations, and Future Gates

P3.5 clarifies the main interpretation risk: mechanism-family similarity is not the same as UX severity. ChatGPT remains the high-severity reference case. Claude supports a non-ChatGPT microtask/app-coordination path, but the observed sample had lower subjective severity and should not be described as another ChatGPT-level UX failure. Gemini showed a responsive send/pointer path in the observed sample, but unreliable early-context access. Low INP therefore does not imply reliable active-context continuity.

This matters for benchmark design. Future workloads must separate visible transcript continuity from active model-context continuity. A benchmark that only grows DOM length can miss the product strategy axis exposed by P3.5: systems may trade off interaction responsiveness, active-context fidelity, visible transcript continuity, artifact/card routing, and app-side coordination cost.

The product trace evidence motivates a mechanism-family hypothesis. It is not source replay, does not prove exact product implementation, does not prove exact root cause, does not prove exact source ownership, and does not prove all product latency comes from the observed mechanism. Minified and multi-bundle traces limit precise ownership claims. Product observations are interpretation-ready, not publishable controlled benchmark proof.

F0-D is controlled mechanism-family reproduction. It is smaller than some product bursts and does not quantitatively replay 400-650ms product traces. It validates a controlled main-thread fanout bottleneck, not all possible AI UI workloads.

F1 validates Worker offload for equivalent derived fanout work. It does not prove all UI work can move off-main-thread. DOM commit, layout, paint, input/caret/focus, accessibility, and some framework behavior remain main-thread concerns. Worker compute is not cycle-identical to main-thread compute.

F2 validates scheduled/chunked Worker execution for one urgent visible projection request. It does not prove multi-urgent behavior. It improves urgent responsiveness while increasing Worker total time, so it is not a total throughput improvement. It measures projection-commit latency, not full pixel or user-perceived latency.

P2/P3 are not a production runtime. They do not implement production Worker runtime, production main runtime, DOM/React integration, product integration, viewport lifecycle ownership, scroll restoration, accessibility, selection/copy/search, or production renderer correctness. Any P3 OffscreenCanvas or rendering-boundary reference should be treated as constrained prototype evidence only; it does not establish Canvas/OffscreenCanvas backend completion, Canvas/WebGPU necessity, cross-platform rendering correctness, browser rendering performance, or performance superiority.

Measurement validity is bounded. The F0-D/F1/F2 aggregates use 3x sample sizes, so they should not be read as confidence-interval claims. Controlled workloads are structurally motivated, not product replay. Trace capture can be sensitive to foreground/visibility effects; stale-server/stale-target and warmup/JIT/cache effects were observed risks and controlled where possible. F2 same-clock urgent metrics are acknowledgement and projection-commit measures, not full display-pipeline or pixel latency, and F2-B is a responsiveness improvement rather than a total throughput improvement.

The P3.5 product observations are opportunistic and privacy-bounded. They should not be used to rank products or claim exact internal product architecture. They do not establish universal AI-product behavior. They do not authorize P4.

P5 has now produced a frozen synthetic scheduling-mechanism evidence packet through P5-X. The next technical step for this draft is P6 paper / OSS / portfolio reconciliation, not more benchmark-axis expansion and not P4. P5 should be cited as synthetic scheduling-delay evidence with strict boundaries: not browser-level INP, not Event Timing, not production readiness, not real product superiority, and not precise user-perceived speedup.

Future evidence needed before stronger runtime claims includes:

- multi-urgent scheduling stress;
- broader workload matrix: chat transcript, agent trace, code review, log surface, long document review;
- synthetic long-session accumulation with visible-history and active-context axes separated;
- accessibility and input/focus/caret model;
- comparison with stronger baselines such as DOM, virtualized DOM, editor-grade buffers, terminal/log-style surfaces, React concurrent features, and workerized state libraries;
- memory growth / long-session retention analysis;
- browser display pipeline, paint, and compositor timing if making user-perceived latency claims.

Future gates must remain narrow:

- P6 Paper / OSS / Portfolio Reconciliation: synchronize the paper draft, related work, appendix, README, and portfolio evidence map around P5-Y/P5-X claim boundaries.
- P4 Gate Planning: only after a separate gate with explicit acceptance criteria; P3.5, P5, and this paper patch do not authorize it.
- Presentation Backend Gate: Canvas/OffscreenCanvas/WebGPU only after the runtime boundary and benchmark evidence justify it.

This paper does not solve all web jank, does not replace React/DOM universally, does not build a production UI framework, does not claim WebGPU is required, does not claim every AI UI workload shares the same bottleneck, does not claim exact product architecture or source ownership, and does not claim accessibility or product integration readiness.

## 10. Conclusion

Long-lived AI surfaces are a distinct UI workload: append-heavy, viewport-centric, long-lived, tail-mutating, and interaction-rich. The bottleneck in this workload is not necessarily rendering alone. Product-motivated traces and controlled reproduction show that action-triggered state/fanout/microtask coordination can create main-thread responsiveness problems before a renderer backend is the first missing lever.

The evidence chain is bounded but coherent. P0 motivates the mechanism family. F0-D shows that controlled action-triggered derived fanout can reproduce stable microtask-dominated main-thread long tasks. F1 shows that equivalent derived fanout work can be moved off-main-thread, removing main-thread long tasks in the controlled setting. F2 shows that scheduled/chunked Worker execution reduces same-clock urgent projection acknowledgement and projection-commit latency relative to monolithic Worker execution. P2 pure core v0 freezes the resulting runtime-core implications as an engineering scaffold. P5 adds the current strongest scheduling-mechanism packet: worker-resident logical ownership can reduce and localize main-thread blocking under synthetic long-lived AI-surface workloads while preserving bounded projection commit as the remaining main-thread window.

P3.5 refines the thesis rather than replacing it. Long-session AI surfaces do not fail uniformly: ChatGPT is the high-severity reference case, Claude provides a lower-severity non-ChatGPT mechanism-family signal, and Gemini provides a responsive/context-windowing divergence case. The paper should therefore claim product-strategy-dependent pressure, not universal AI-product behavior.

In controlled and synthetic settings, action-triggered derived fanout can reproduce main-thread long tasks; equivalent worker offload can remove those long tasks; worker-side scheduling can reduce urgent projection-commit latency; and P5 synthetic scheduling-delay proxies show blocked-vs-near-unblocked scheduling categories under send-start, dynamic-update, multistream, and product-trace-shaped workloads. Together, these results support a worker-resident, transaction-scheduled, bounded-projection runtime direction for long-lived AI surfaces, while leaving production runtime implementation and broader validation to future work.

P4 remains not authorized. The next step after this v0.2 patch is P6 paper / OSS / portfolio reconciliation: keep the short paper, appendix, README, and portfolio evidence map aligned with P5-Y/P5-X claim boundaries, and do not proceed to P7 productization or P4/WebGPU implementation from this evidence alone.

## Figures and Tables Still To Finalize

Figures 1-4 now have placeholder/caption blocks, separate specs, and rendered draft SVGs. Final publication export/layout may still be needed before external sharing.

- Figure 1: final camera-ready layout/export for workload-architecture mismatch if needed
- Figure 2: final camera-ready layout/export for P0 trace mechanism shape if needed
- Figure 3: final camera-ready layout/export for F0-D vs F1 main-thread comparison if needed
- Figure 4: final camera-ready layout/export for F2 timeline if needed
- Table 3: P2 module classification if not already included
