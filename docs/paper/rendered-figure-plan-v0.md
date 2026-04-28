# Rendered Figure Plan v0

## Purpose

The assembled draft is now structurally coherent but visually underdeveloped. This plan defines how to render the highest-value figures without changing runtime code, running new experiments, or expanding claims.

## Figure Priority

1. Figure 1: Workload–architecture mismatch
2. Figure 3: F0-D vs F1 main-thread comparison
3. Figure 4: F2 monolithic vs scheduled Worker timeline
4. Figure 2: P0 product trace mechanism shape

Figure 1 comes first because it explains the thesis: long-lived AI surfaces want bounded visible projection from session-scale state, while current stacks can route session-scale state/fanout through the main thread. Figure 3 comes second because it shows the clearest problem-solution contrast: F0-D reproduces the controlled main-thread bottleneck and F1 removes that bottleneck by moving equivalent derived fanout to a Worker. Figure 4 comes third because it explains why scheduling matters after offload: chunking/yielding improves urgent projection latency while increasing total Worker time. Figure 2 comes fourth because it is useful for motivation but has the highest overclaim risk and must remain clearly framed as mechanism-family evidence.

## Global Rendering Rules

- All figures should be implementation-neutral.
- Avoid product logos or product-source claims.
- Avoid React-blame or DOM-blame framing.
- Avoid Canvas/WebGPU suggestions.
- Use consistent visual vocabulary:
  - Main thread
  - Worker
  - session state
  - op-log
  - transaction scheduler
  - bounded projection
  - urgent projection
  - background work
- Use restrained color semantics if rendered later:
  - main-thread risk / blocked path
  - worker-side work
  - urgent path
  - bounded projection path
- Keep all figures grayscale-compatible for paper review.
- Prefer diagrams that can be rendered in Mermaid, SVG, or simple vector graphics later.

## Figure 1 Rendering Plan: Workload–Architecture Mismatch

Purpose: show why long-lived AI surfaces create a workload-architecture mismatch.

Recommended visual format: two-panel architecture diagram.

Panel A: Current document-oriented stack

- User action / stream update
- main-thread app state / context propagation
- subscriber fanout / derived computation
- microtask flush / app coordination
- DOM/VDOM visible update
- mark "main-thread long-task risk"

Panel B: Proposed streaming UI runtime direction

- User action / stream op
- serialized op / transaction
- Worker-resident op-log + session state
- Worker-side transaction scheduler
- bounded visible projection
- main-thread projection commit
- mark "session-scale work moved off main thread"

Labels:

- append-heavy
- viewport-centric
- session-scale
- bounded projection
- worker-resident state

Claim boundaries:

- not a claim that DOM/React universally fails
- not a claim that rendering is irrelevant
- not a claim that Worker runtime is already implemented
- not Canvas/WebGPU

Recommended placement: Introduction or early Background.

## Figure 3 Rendering Plan: F0-D vs F1 Main-thread Comparison

Purpose: show the first solution lever: equivalent derived fanout moved off main thread.

Recommended visual format: two-panel timing/ownership diagram plus mini metric callouts.

Panel A: F0-D

- synthetic click
- RunMicrotasks
- target FunctionCall
- module/subscriber derived fanout
- main-thread long task

Panel B: F1 Worker B

- synthetic click
- dispatch to Worker
- Worker compute
- bounded main visible update
- no 50ms+ main-thread long task

Numbers to annotate:

- F0-D main max task mean ≈ 68.633ms
- F0-D microtask window mean ≈ 66.987ms
- F0-D long_task_count_50ms = 1/run
- F1 main max task mean ≈ 2.679ms
- F1 main long task count = 0/run
- F1 worker compute mean ≈ 51.367ms
- F1 worker roundtrip mean ≈ 55.433ms

Claim boundaries:

- not proof all UI work can move to Worker
- not DOM commit/layout/paint offload
- not product replay
- not production runtime readiness

Recommended placement: Section 5: Worker Offload.

## Figure 4 Rendering Plan: F2 Monolithic vs Scheduled Worker Timeline

Purpose: explain why F2-B improves urgent projection latency even though total Worker time increases.

Recommended visual format: two-lane timeline with Main and Worker lanes.

Panel A: F2-A Monolithic

- Main sends heavy transaction
- Worker runs one monolithic heavy transaction
- urgent projection request arrives while Worker busy
- urgent projection waits
- main receives urgent projection later

Panel B: F2-B Scheduled

- Main sends heavy transaction
- Worker runs chunks
- Worker yields
- urgent projection request arrives
- scheduler admits urgent projection between chunks
- heavy work continues after urgent projection

Numbers to annotate:

- F2-A urgent ack mean ≈ 20.933ms
- F2-B urgent ack mean ≈ 0.900ms
- F2-A urgent projection-commit mean ≈ 22.867ms
- F2-B urgent projection-commit mean ≈ 3.333ms
- F2-A worker total mean ≈ 26.8ms
- F2-B worker total mean ≈ 48.533ms
- F2-B chunk_count = 313
- F2-B yield_count = 312
- F2-B preemptions = 1

Claim boundaries:

- responsiveness tradeoff, not throughput win
- not exact pixel latency
- not multi-urgent proof
- not product replay
- not final runtime success

Recommended placement: Section 6: Worker-side Scheduling.

## Figure 2 Rendering Plan: P0 Product Trace Mechanism Shape

Purpose: motivate the mechanism family from product traces without overclaiming source ownership.

Recommended visual format: flow diagram with confidence boundaries.

Flow:

- user click / pointerup
- event dispatch / trigger
- Run microtasks
- multi-bundle app coordination
- state/context propagation hints
- subscriber/fanout-like coordination
- delayed responsiveness

Side notes:

- layout/paint/style/GC observed but not dominant in motivating shape
- source-semantics hints are suggestive, not definitive

Claim boundaries:

- not product source replay
- not exact source-map ownership
- not React root cause
- not proof rendering is irrelevant
- not proof Worker runtime fixes product

Recommended placement: Section 3: Product Trace Motivation.

## Rendering Options

### Mermaid

Pros:

- easy to edit
- text-based
- good for flow diagrams

Cons:

- limited paper-quality control
- timeline diagrams may be awkward

### SVG / vector drawing

Pros:

- best final paper quality
- precise layout

Cons:

- more manual

### Markdown ASCII placeholder

Pros:

- fast and reviewable in text draft

Cons:

- not final-paper quality

Recommendation: start with Mermaid or SVG-like specs for Figure 1 and Figure 4. Use a simple bar/timeline vector for Figure 3. Keep Figure 2 simple to avoid overclaiming.

## What Not To Render

- no product UI screenshots unless separately approved
- no product logos
- no fake DevTools screenshots
- no source-code ownership claims
- no React blame iconography
- no Canvas/WebGPU pipeline
- no production architecture diagram implying implementation is complete

## Next Step

The next step should be to create the actual Figure 1 rendered draft first, because it carries the paper thesis and improves reviewer comprehension earliest.
