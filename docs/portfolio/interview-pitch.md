# Interview Pitch — Streaming UI Runtime

## 30-Second Version

Streaming UI Runtime studies long-lived AI surfaces: chat sessions, agent traces, coding assistants, logs, and review workspaces that keep growing while the user keeps interacting. The project argues that the bottleneck is often a workload-architecture mismatch, not just slow rendering. The direction is worker-resident logical ownership, transaction scheduling, and bounded projection back to the main thread. The evidence is controlled P1 benchmarking plus synthetic P5 scheduling-delay proxy evidence, with strict boundaries around what is not proven.

## 60-Second Version

Long-lived AI surfaces are append-heavy, viewport-centric, and tail-mutating. Users see a bounded viewport, but the underlying session can contain a large transcript, tool events, code blocks, trace state, and background work. In a document/tree-owned UI stack, ordinary interactions can trigger session-scale coordination or fanout on the main thread.

Streaming UI Runtime explores a different runtime direction: keep session-scale logical work worker-resident, schedule operations as transactions, and send only bounded visible projections back to the main thread. The current repo includes a TypeScript pure-core scaffold, controlled benchmark evidence, synthetic P5 scheduling-delay proxy evidence, and public claim-boundary docs. It is not a production UI framework and does not claim browser-level INP or real product superiority.

## 3-Minute Version

The project started from a specific question: why do long AI sessions become interaction-sensitive even when the visible update is small? The working diagnosis is that long-lived AI surfaces are closer to terminal/editor/log workloads than ordinary document pages. They append continuously, retain history, mutate the tail, mix stream events with user input, and display a bounded viewport over a larger logical session.

The architecture direction is worker-resident logical ownership. Instead of making the main thread own all session-scale state, fanout, active-context maintenance, and projection decisions, the worker owns the logical runtime and produces bounded projections. The main thread still matters, but its role is narrowed toward bounded projection commit.

The evidence is staged. P0 provides product-motivated traces as motivation only. F0-D reproduces a controlled main-thread long-task mechanism. F1 moves equivalent work off the main thread. F2 tests worker-side scheduling for urgent projection timing. P2 freezes a TypeScript pure-core scaffold. P5 adds synthetic scheduling-delay proxy evidence across send-start, commit-window, dynamic context, multistream, and product-trace-shaped synthetic workloads.

The safest claim is narrow: controlled P1 plus synthetic P5 evidence supports worker-resident ownership/offload as a way to reduce and localize main-thread blocking under long-lived AI-surface workloads. It does not prove browser-level INP, Event Timing, production readiness, real product superiority, or P4/WebGPU authorization.

## Common Questions And Answers

### Is this just virtualization?

No. Virtualization bounds mounted DOM. This project studies who owns session-scale logical work, how that work is scheduled, and how bounded projections reach the main thread.

### Is this just an editor?

No, but editors are an important reference point. Code editors have strong model/view and transaction ideas. AI surfaces add heterogeneous blocks, tool events, agent traces, active-context policy, and multistream append.

### Is this just a terminal?

No, but terminals are another useful analogy. AI surfaces add variable-height semantic blocks, markdown/code/tool output, provenance, review state, and active context beyond uniform terminal rows.

### Why not WebGPU-first?

Because the current evidence points first to ownership, scheduling, and bounded projection. WebGPU is a possible future ceiling backend, not the thesis and not currently authorized.

### Did you prove real ChatGPT performance improvement?

No. Product traces motivated the problem family, but the evidence claims are controlled and synthetic. The project does not claim real product superiority or browser-level INP improvement.

### What is implemented vs not implemented?

Implemented: TypeScript pure-core runtime scaffolding, validation, scheduler/policy modules, state/projection contracts, harnesses, controlled benchmarks, and evidence docs. Not implemented: production Worker/Main runtime, DOM/React integration, projection engine, Canvas/OffscreenCanvas/WebGPU backend, product integration, or production accessibility/focus/caret behavior.

### What would P7 be?

P7 would be later product-grade validation or productization, possibly around an agent trace or long-lived AI workspace. It is not part of the current project status.

### What was the hardest technical decision?

Keeping the project centered on workload ownership and scheduling rather than jumping to a renderer or product demo. That kept the evidence narrow enough to defend.

### What did you learn?

The strongest portfolio value is not a claim that one UI stack is universally faster. It is the disciplined evidence chain: identify the workload, reproduce a controlled mechanism, test worker ownership/scheduling, and preserve claim boundaries.
