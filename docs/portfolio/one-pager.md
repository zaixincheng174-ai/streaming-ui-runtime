# Streaming UI Runtime — One-Pager

## One-Sentence Summary

Streaming UI Runtime is a research-backed TypeScript runtime-core project studying worker-resident ownership, transaction scheduling, and bounded projection for long-lived AI surfaces.

## Problem

Long-lived AI surfaces are not ordinary document pages. A chat, coding assistant, agent trace, log, or review workspace can stay open while new output keeps appending and older session state remains relevant.

The workload is:

- append-heavy: messages, tokens, logs, tool events, and traces keep joining the session;
- viewport-centric: the user sees a bounded region, not the full logical session;
- tail-mutating: recent blocks keep changing while new blocks append;
- session-scale: actions can touch accumulated state, fanout, parsing, and projection work;
- coordination-heavy: ordinary interactions can collide with background stream/session work.

The project frames this as a workload-architecture mismatch between long-lived AI surfaces and document/tree-oriented DOM or VDOM ownership models.

## Technical Direction

The runtime direction is:

- worker-resident logical ownership for session-scale state and derived work;
- transaction scheduling for urgent versus background work;
- bounded viewport projection from the worker-owned logical session;
- main-thread responsibility narrowed toward bounded projection commit.

The main thread is not removed. The intended boundary is that it should commit bounded, current projections rather than own all session-scale logical work.

## Evidence Chain

- P0 product-motivated traces: motivated the action-triggered coordination/fanout mechanism family; not source replay.
- F0-D controlled reproduction: reproduced a controlled main-thread long-task mechanism.
- F1 worker offload: moved equivalent structural work off the main thread in a controlled workload.
- F2 worker scheduling: showed controlled urgent projection timing improvement under scheduled Worker execution.
- P2 pure-core scaffold: froze TypeScript runtime-core protocol, scheduling, state, projection, and adapter contracts.
- P5 synthetic scheduling-delay proxy: tested send-start, commit-window, dynamic context, multistream, and product-trace-shaped synthetic workloads with strict claim boundaries.

## Current Strongest Claim

Controlled P1 evidence plus synthetic P5 scheduling-delay proxy evidence supports that worker-resident ownership/offload can reduce and localize main-thread blocking under long-lived AI-surface workloads, while bounded main-thread projection commit remains the remaining blocking window.

## What It Does Not Claim

- Not browser-level INP improvement.
- Not Event Timing improvement.
- Not real product superiority.
- Not production readiness.
- Not a complete production Worker/Main runtime.
- Not a complete Canvas, OffscreenCanvas, or WebGPU backend.
- Not WebGPU/P4 authorization.
- Not P7 productization.
- Not a production Agent Trace Viewer.
- Not precise user-perceived speedup ratios.

## Why It Matters

AI chat, agent traces, coding assistants, logs, and review workspaces increasingly behave like long-lived runtime surfaces rather than short document pages. The important question is not only how fast a renderer paints. It is where growing session truth lives, how background work is scheduled, and how little work must return to the main thread for visible interaction.

## Best Use In Portfolio

- Recruiters: use this as the quick project summary.
- Engineers: pair this with [evidence-map.md](evidence-map.md) and [architecture-diagram.md](architecture-diagram.md).
- Reviewers: use this only as an entry point; the current claim boundary lives in [document-status-map.md](document-status-map.md), the paper draft, and the P5 reviewer packet.
