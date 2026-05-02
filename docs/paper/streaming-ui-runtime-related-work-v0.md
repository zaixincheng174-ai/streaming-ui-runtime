# Related Systems Positioning

## Scope And Claim Boundary

This document positions Streaming UI Runtime against adjacent systems. It is a related-systems audit for external readers, not a final bibliography-complete related work section.

The project is not claiming to replace React, Vue, editors, terminals, virtualized lists, Web Workers, OffscreenCanvas, or WebGPU. The narrower claim is that long-lived AI surfaces combine append-heavy output, bounded viewport presentation, tail mutation, agent/trace-like events, and action-triggered coordination/fanout pressure in a way that makes ownership and scheduling boundaries central.

The current evidence supports a conservative claim: controlled P1 results plus synthetic P5 scheduling-delay proxy results support that worker-resident ownership/offload can reduce and localize main-thread blocking under long-lived AI-surface workloads. This does not prove browser-level INP improvement, Event Timing improvement, real product superiority, production readiness, a complete production Worker/Main runtime, a complete Canvas/OffscreenCanvas/WebGPU backend, P4 authorization, P7 productization, or precise user-perceived speedup ratios.

## Comparison Matrix

| System/category | What it solves | Source of truth / core abstraction | Why it is relevant | Why it does not fully subsume this project | Citation status |
| --- | --- | --- | --- | --- | --- |
| React / DOM-VDOM frameworks | Declarative UI composition, reconciliation, batching, and transition-marked rendering work. React transitions can mark updates as non-blocking and interrupt transition work when more urgent updates arrive. | Component tree, state updates, reconciler, DOM commit. | React is the strongest practical baseline family for long-lived web UI surfaces. | React scheduling helps rendering work, but does not by itself define worker-resident session truth, cross-thread transaction protocol, active-context maintenance, or bounded projection ownership for session-scale AI workloads. React also documents limits such as transitions not controlling text inputs. | Official React `useTransition` docs: https://react.dev/reference/react/useTransition |
| Vue / generic VDOM frameworks | Declarative rendering, virtual DOM diffing/patching, compiler-informed optimizations, and reactive dependency tracking. | Template/render function output as virtual DOM, reactive dependencies, renderer patch pipeline. | Vue provides a concrete VDOM comparison point beyond React and shows that VDOM systems can apply compiler/runtime optimizations. | VDOM optimization still centers on UI tree construction/diff/patch. It does not automatically move long-session derived fanout, agent-trace merge, rolling active-context maintenance, or transaction scheduling into a worker-owned logical runtime. | Official Vue rendering mechanism docs: https://vuejs.org/guide/extras/rendering-mechanism.html |
| Virtualized lists | Keeps mounted rows/cells bounded for large lists and grids; supports visible-range callbacks, overscan, and dynamic-size tradeoffs. | Visible window over a logical list/grid; row/cell renderers and size metadata. | Long-lived AI surfaces need bounded viewport presentation, so virtualization is a required baseline. | Virtualization reduces committed DOM, but it does not decide who owns session-scale state/fanout, stream merge, tool-event processing, rolling active-context update, or scheduling between urgent and background work. Dynamic heights are also explicitly less efficient in `react-window`, which matters for heterogeneous AI blocks. | `react-window` project docs: https://github.com/bvaughn/react-window and `react-virtualized`: https://github.com/bvaughn/react-virtualized |
| CodeMirror 6 | Editor-state model, transactions, immutable document/state, extensions, viewport rendering, and measure/write discipline. | `EditorState`, immutable document/state values, transactions dispatched to an `EditorView`. | CodeMirror is the closest positive reference for source-of-truth separation, transactions, and viewport-limited rendering. | CodeMirror targets text editor workloads. Long-lived AI surfaces add heterogeneous blocks, markdown/code/tool outputs, citations, agent traces, multi-stream append, active-context policy, and product-surface routing. | Official CodeMirror system guide: https://codemirror.net/docs/guide/ |
| Monaco Editor | Text model API, edit operations, snapshots, decorations, undo/redo, ranges, and editor-model separation. | `ITextModel` as the text source of truth plus editor view APIs. | Monaco is an editor-grade baseline for durable model/view separation and large-document interaction. | Monaco's abstraction is a text model, not a heterogeneous AI session graph with messages, trace lanes, tool events, dynamic active-context windows, and bounded projection transactions. | Official Monaco `ITextModel` API: https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.ITextModel.html |
| xterm.js / terminal renderers | Terminal buffer, rows/cols viewport, scroll events, parser, input handling, and rendered-row callbacks for append-heavy terminal output. | Terminal buffer and viewport rows; terminal parser and renderer. | Terminal scrollback is a strong analogy for append-heavy retained history with bounded presentation. | Terminal data is comparatively uniform. AI surfaces have variable-height semantic blocks, markdown, code review chunks, tool cards, agent traces, multi-stream event lanes, active-context maintenance, and user-facing provenance. | Official xterm.js docs/API: https://xtermjs.org/docs/ and Terminal API: https://xtermjs.org/docs/api/terminal/classes/terminal/ |
| Alacritty / terminal-like GPU text renderers | High-performance terminal presentation, OpenGL rendering, scrollback search, and terminal-focused interaction. | Terminal emulator process, terminal grid/buffer, GPU-backed text rendering. | Shows that terminal-class workloads often treat presentation and buffer/scrollback as specialized systems problems. | GPU text rendering does not address AI-surface session ownership, stream merge, active-context policy, trace semantics, or browser main-thread scheduling. | Official Alacritty site: https://alacritty.org/ |
| Web Workers / OffscreenCanvas | Workers run scripts off the main thread; OffscreenCanvas can decouple Canvas from DOM and run rendering work in a worker context. | Worker thread plus message passing; OffscreenCanvas drawing surface. | These are enabling mechanisms for off-main-thread work and future presentation backends. | A Worker is not a runtime architecture by itself. OffscreenCanvas is a presentation mechanism; it does not define operation logs, transaction scheduling, active-context update semantics, bounded projection correctness, or fail-closed commits. | MDN Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API and OffscreenCanvas: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas |
| Prioritized Task Scheduling / `scheduler.yield()` | Browser-level primitives for posting prioritized tasks and yielding from long-running work. | `scheduler.postTask()`, `scheduler.yield()`, coarse task priorities. | Aligns with the project's scheduling theme and F2's chunk/yield/preemption direction. | Browser scheduling APIs do not define the long-lived AI session model, operation stream, worker-owned state, projection protocol, or active-context invariants. They are mechanisms a future runtime may use, not the thesis. | MDN Prioritized Task Scheduling API: https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API |
| WebGPU | Access to GPU computation and rendering pipelines for high-performance graphics/compute in the browser. | GPU adapter/device, buffers, pipelines, shaders. | Useful as a future ceiling backend if presentation throughput becomes the dominant bottleneck. | Current strongest evidence points to logical ownership, transaction scheduling, and bounded projection. WebGPU is not needed for the current claim and P4 remains not authorized. | MDN WebGPU API: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API |
| Agent trace / long-lived AI surfaces | Multi-stream outputs, tool calls, status/progress, code/diff chunks, long review surfaces, and user input while background work continues. | Heterogeneous session graph / trace stream, not just a DOM tree or text buffer. | This is the target workload category. P5-U and P5-X model multistream and product-trace-shaped synthetic scenarios. | Current evidence is synthetic scheduling-delay proxy evidence, not real product trace validation or production Agent Trace Viewer proof. | Project evidence: `docs/p5/p5y-final-reviewer-evidence-packet.md`, `docs/portfolio/p5-scheduling-evidence-summary.md`; external corpus citation-needed |

## Key Distinction

The project novelty should be stated as a narrow combination, not as a broad replacement claim.

It is not:

- "DOM bad."
- "WebGPU faster."
- "Editors are irrelevant."
- "Virtualization does not work."
- "React concurrent rendering is useless."

The intended distinction is:

- workload characterization for long-lived AI surfaces: append-heavy, viewport-centric, tail-mutating, heterogeneous, and increasingly agent/trace-like;
- action-triggered coordination/fanout pressure that can happen before renderer throughput is the first bottleneck;
- worker-resident logical ownership of session-scale work;
- transaction scheduling for urgent versus background work;
- bounded projection commit on the main thread;
- fail-closed correctness boundaries for stale, malformed, or oversized work.

This aligns with the current evidence boundary: P1 supports the controlled fanout/offload/scheduling chain, while P5 supports synthetic scheduling-delay proxy evidence across send-start, commit-window, dynamic context, multistream, and product-trace-shaped synthetic workloads. It does not claim browser-level INP, Event Timing, production readiness, real product superiority, or P4/WebGPU authorization.

## Reviewer Objections And Responses

| objection | conservative response | current evidence | future work |
| --- | --- | --- | --- |
| "Isn't this just virtualization?" | Virtualization is necessary but not sufficient. It bounds mounted DOM, while this project studies ownership and scheduling of session-scale logical work. | P5 paired targets preserve bounded rendered windows while varying main-thread versus worker ownership. | Stronger editor/virtualized-list baselines remain useful for future comparison. |
| "Isn't this just an editor?" | Editors are the best positive analogy, especially CodeMirror's state/transaction/viewport design. The AI workload adds heterogeneous blocks, tool events, agent traces, active-context maintenance, and multistream append. | P2 adopts transaction/projection ideas; P5-Q/S/U/X add dynamic context and multistream trace-shaped axes. | Compare against editor-grade buffers when implementing a later runtime prototype. |
| "Isn't this just a terminal?" | Terminal scrollback is another strong analogy for append-heavy retained history and bounded viewport. AI surfaces are harder because they are variable-height, semantic, interactive, and trace-like rather than mostly uniform terminal cells. | P5-U/P5-X model multistream and trace-shaped event streams rather than plain appended rows. | Add terminal/log-style baseline only if a reviewer asks whether the workload is reducible to scrollback. |
| "Isn't React concurrent rendering enough?" | React transitions and batching are relevant baselines, but render scheduling is not the same as worker-owned session state, operation logs, active-context update, and bounded projection protocol. | P0/P1 evidence points at action-triggered microtask/state/fanout pressure; P5 measures worker ownership versus main-thread ownership in synthetic targets. | Future work should compare against strong React concurrent and workerized-state baselines, not strawmen. |
| "Why not just optimize markdown parsing?" | Markdown parsing may be one cost in real AI surfaces, but current evidence does not isolate it as the main bottleneck. The current claim concerns logical ownership, fanout, scheduling, and projection boundaries. | P0/P1 focus on action-triggered coordination/fanout; P5 focuses on dynamic context and multistream scheduling proxies. | If markdown/syntax parsing becomes a measured bottleneck, paired algorithmic optimizations must be applied to both B2/R0-style baselines. |
| "Why not WebGPU-first?" | WebGPU is a future ceiling backend, not the thesis. Current evidence points first to logical ownership, transaction scheduling, and bounded projection. | README and P5-Y state P4 remains not authorized; P5 does not require Canvas/WebGPU. | WebGPU/P4 should require a separate gate showing presentation throughput is the limiting factor. |
| "Where is the product proof?" | Current product traces motivate the mechanism family, while P5-X is product-trace-shaped synthetic evidence. The project does not claim real product superiority. | P0 motivates the mechanism; P5-X tests a product-trace-shaped synthetic workload under strict boundaries. | Real product trace validation would require a separate sanitized trace design and privacy review. |

## Remaining Citation Gaps

- Academic or peer-reviewed citations for virtualized/windowed rendering remain citation-needed.
- Academic references for editor data structures such as ropes, piece tables, and incremental parsing remain citation-needed.
- Academic references for terminal scrollback / terminal renderer architectures remain citation-needed.
- External references for AI agent trace / long-lived AI-surface workload taxonomies remain citation-needed; current evidence is project-local.
- Future paper packaging should decide whether official documentation links are enough for a workshop paper, or whether a formal bibliography is required.

## Final Recommendation

Use this document as the related-systems positioning source for the P6 paper/portfolio packet. It is ready to be linked or referenced from the short paper draft as a positioning source, but it is not yet a final bibliography.
