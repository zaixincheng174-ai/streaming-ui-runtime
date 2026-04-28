# Background and Workload Model v0

## Purpose of This Section

This section defines the workload class targeted by the paper: long-lived AI surfaces. It should make clear why this is not the same as ordinary web pages, simple chat UIs, virtual lists, terminals, or editors, although it shares traits with each.

The goal is to define the architectural pressure before presenting the evidence chain. The section should help a reviewer understand why append-heavy AI sessions can stress main-thread state/fanout paths even when the visible viewport is bounded.

## Long-Lived AI Surfaces

A long-lived AI surface is an interactive UI for a long-running session whose state keeps growing while the user continues to interact with it.

Typical properties include:

- long-running session;
- continuously appended assistant, user, tool, or agent output;
- heterogeneous content blocks;
- viewport-centric interaction;
- retained historical context;
- user actions while the session keeps growing;
- surfaces that may include chat, agent trace, code review, logs, reasoning traces, tool calls, and long document review.

The important distinction is that the surface is not just a message list. It is a growing session workspace: new output arrives, older context remains relevant, visible content is a bounded subset, and user actions can target both current and historical state.

## Key Workload Properties

### Append-heavy

New content is frequently appended. Assistant messages, user messages, tool outputs, status updates, citations, logs, and intermediate traces can all join the session over time.

Output can stream. A block may start incomplete, grow incrementally, and then settle into a final form. This means the tail of the session is not only appended but also mutated as streaming output arrives.

Tail mutation matters because it combines new writes, visible updates, derived metadata, and user interaction near the same boundary. The runtime cannot treat every update as a full page replacement, and it cannot assume that the session tail is trivial just because the viewport is small.

### Session-scale

The session grows beyond the current viewport. The user may see only a small visible region, but the logical session can include much more content, metadata, history, and derived state.

Old state cannot always be discarded. Earlier messages, citations, tool calls, logs, and review artifacts can remain relevant for navigation, provenance, search, summarization, references, and future user actions.

Derived metadata may depend on more than the visible DOM. Counts, indices, block identities, lineage, checksums, projections, and tool traces can involve session-scale data even when the immediate visual update is local.

### Viewport-centric

The user only sees a bounded region at any moment. The UI should ideally commit only a bounded visible projection to the main thread rather than requiring the main thread to own and process the full session for each visible update.

This does not mean invisible state is unimportant. It means session truth and visible presentation should be separated. The runtime can maintain session-scale state outside the main-thread presentation path and send a bounded projection for the current viewport.

The architectural target is that session-scale state work should not be required for every visible update. The main thread should receive enough data to commit the visible result, not every intermediate state/fanout step needed to maintain the long-lived session.

### Heterogeneous block structure

AI surfaces contain messages, markdown, code, tool calls, citations, status blocks, agent traces, partial outputs, logs, and long review artifacts. These blocks can differ in identity, update frequency, size, metadata, and rendering behavior.

Each block may have different update semantics. A markdown block may stream text, a code block may require syntax work, a tool call may change status, a citation block may preserve provenance, and an agent trace may expand or collapse.

This heterogeneity makes the workload more complex than a uniform append-only text buffer. It also makes session-scale derived metadata more important because block identities, lineage, and references must survive incremental updates.

### Concurrent interaction

User input, scrolling, clicking, selection, expansion, and new output may overlap. A user can issue an urgent visible action while background session work is still processing.

Urgent visible actions should not wait behind background session work. If a long background update blocks urgent projection, the UI can feel slow even if the total amount of work is reasonable.

The workload therefore needs priority-aware scheduling. The relevant question is not only how to finish all work, but how to admit urgent visible work while preserving session correctness.

## Why Ordinary DOM/VDOM Stacks Struggle

DOM/VDOM stacks are not bad generally. They are effective for many document, application, and component workloads. The problem described here is narrower: a workload-architecture mismatch that appears when session-scale state/fanout/derived work is coupled to main-thread rendering and update paths.

Append-heavy long sessions can trigger state propagation, subscriber fanout, microtask flushes, queue drains, framework coordination, and derived computation. If those paths run on the main thread, a local-looking action can produce a session-scale scripting burst.

Main-thread long tasks hurt input responsiveness because input dispatch, event handling, rendering coordination, and visible commits share the same constrained thread. Even if the renderer is efficient, state/fanout work can delay the next visible response.

This is not a universal condemnation of React, the DOM, or VDOM approaches. The claim is that long-lived AI surfaces expose a class of pressure that document-oriented main-thread ownership does not naturally isolate.

## Relationship To Existing Systems

### Virtual lists

Virtual lists are good at reducing the number of DOM nodes committed for a large list. They can keep the visible DOM bounded and are often the right tool for scroll performance.

They do not by themselves solve session-scale state/fanout work. If the application still performs full-session derived computation, subscriber notification, or context propagation on the main thread, virtualizing DOM nodes does not remove that pressure.

### Text editors

Text editors have strong viewport and buffer models. They often separate the document buffer from the visible viewport and are built for incremental editing at scale.

Long-lived AI surfaces share the need for buffer-like state and bounded viewport presentation, but they are usually not just editable text buffers. They include heterogeneous semantic blocks, tool outputs, citations, agent traces, streaming partials, and provenance metadata.

### Terminals

Terminals are append-heavy and viewport-centric. They show that a long-running append stream can be managed with a bounded visible region and a retained scrollback buffer.

AI surfaces are richer than terminals in block semantics and interaction. They may include markdown, code, tool invocations, citations, expandable traces, derived summaries, and review actions. That richer structure creates more state/fanout and projection correctness requirements.

### Chat applications

Chat applications are superficially similar because they append messages over time. Simple chats, however, often do not capture the full target workload.

Long-lived AI sessions can include streaming output, tool calls, agent traces, code/log blocks, citations, reasoning traces, provenance, and long review surfaces. A chat UI can be one instance of the workload, but it is not the whole model.

## Workload Model

The abstract model uses:

- Session `S`: the long-lived session truth.
- Operation stream `O`: ordered updates and user-visible actions applied to the session.
- Blocks `B`: heterogeneous content units such as messages, code, tool calls, logs, citations, and traces.
- Messages `M`: conversational or action-level groupings that can reference one or more blocks.
- Viewport `V`: the bounded visible region requested by the user or presentation layer.
- Visible projection `P`: the bounded result produced for `V`.
- Priority lanes: `urgent-input > visible-projection > stream-update > background-indexing`.

The runtime maintains session-scale state outside the main-thread presentation path. This keeps the full session model, operation history, block/message graph, lineage, and derived metadata from being coupled directly to every visible commit.

The main thread receives a bounded projection `P(V)`. That projection should contain the visible blocks and metadata required to commit the current viewport, not the whole session state.

Background work can be chunked and yielded. Stream updates and background indexing may advance over time, but they should not monopolize the runtime when urgent visible work arrives.

Urgent visible projection can preempt background work. This does not mean total work becomes cheaper; it means the scheduler preserves responsiveness by admitting higher-priority visible work sooner.

## Failure Mode: Action-Triggered Main-Thread Fanout

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

P0 and F0 evidence motivate this mechanism family. Product traces show `click/pointerup -> Run microtasks -> multi-bundle/state-context coordination`, while F0-D reproduces stable main-thread long-task behavior in a controlled derived-fanout workload.

This is not a claim of exact product implementation replay. The safe interpretation is that a product-motivated mechanism can be reproduced in controlled form and should influence runtime architecture.

## Design Implications

- Session truth should not be the DOM tree alone.
- Session-scale derived work should move off-main-thread where possible.
- Visible projection should be bounded.
- Scheduling must prioritize urgent input and visible projection.
- Stale projection must be rejected.
- Equivalence, checksum, and lineage are needed for correctness.
- Renderer backend is secondary until the runtime boundary is correct.

## What This Workload Model Does Not Claim

- Not every web page has this problem.
- Not every React app fails.
- Not proof that DOM rendering itself is the dominant cost.
- Not proof Canvas/WebGPU is needed.
- Not product source replay.
- Not full production runtime model yet.

## How This Section Supports The Paper

This workload model provides the conceptual basis for:

- P0 trace interpretation;
- F0-D controlled reproduction;
- F1 worker offload test;
- F2 worker scheduling test;
- P2 pure core design.

It defines why the paper should evaluate state/fanout placement and scheduling rather than starting with renderer replacement.

## Final Recommendation

This section should precede the evidence sections. The next paper section should be Product Trace Motivation / P0 Evidence, unless this workload model exposes a missing definition that must be fixed first.
