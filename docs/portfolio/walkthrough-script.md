# 90-Second Walkthrough Script

## 0-15s Problem

Long-lived AI surfaces are not ordinary pages. A chat, coding assistant, agent trace, log, or review workspace can keep growing while the user continues typing, scrolling, clicking, and reviewing older context.

## 15-35s Thesis

The thesis is a workload-architecture mismatch. These surfaces are append-heavy, viewport-centric, tail-mutating, and session-scale, but many web UI stacks still keep too much logical coordination on the main thread. The project explores a worker-resident runtime direction with transaction scheduling and bounded projection.

## 35-60s Evidence

The evidence is staged. P0 product-motivated traces identify the mechanism family. F0-D reproduces controlled main-thread long tasks. F1 moves equivalent work to a Worker. F2 tests scheduled Worker execution for controlled urgent projection timing. P2 freezes the TypeScript pure-core scaffold. P5 adds synthetic scheduling-delay proxy evidence for send-start, commit-window, dynamic context, multistream, and product-trace-shaped synthetic workloads.

## 60-75s Boundary

The claim is intentionally narrow. This is not browser-level INP, not Event Timing, not production readiness, not real product superiority, not WebGPU/P4 authorization, and not a production Agent Trace Viewer.

## 75-90s Why It Matters

For long-lived AI interfaces, raw rendering speed is only part of the problem. The larger systems question is where session truth lives, how background work is scheduled, and how much work must return to the main thread for visible interaction.

## 3-Minute Extended Walkthrough

Streaming UI Runtime is a research-backed TypeScript runtime-core project for long-lived AI surfaces. The project targets interfaces that remain open for a long time while content keeps appending: chat sessions, agent traces, coding assistants, logs, and review workspaces.

The main idea is that these surfaces stress document/tree-oriented UI ownership models. The user sees a bounded viewport, but the logical session can be much larger. If the main thread owns all session-scale state, fanout, tail mutation, active-context work, and projection coordination, ordinary interactions can get queued behind logical work.

The proposed direction is worker-resident logical ownership. The Worker owns the session-scale runtime and schedules operations as transactions. It produces bounded projections, and the main thread commits those projections. The main thread is still part of the path, but its blocking window should be localized.

The evidence chain is conservative. P1 provides controlled evidence for reproduction, worker offload, and worker scheduling. P5 provides synthetic scheduling-delay proxy evidence across increasingly realistic long-lived workload axes, including product-trace-shaped synthetic workloads. The evidence supports the architecture direction but does not claim production readiness or real product superiority.

The project is best read as a systems/portfolio artifact: it shows how to turn a messy UI performance symptom into a workload model, controlled benchmarks, a runtime-core direction, and reviewer-safe claim boundaries.

## Closing Line

The project is not trying to replace the DOM or prove a product benchmark. It is a disciplined systems argument that long-lived AI surfaces need different ownership and scheduling boundaries than ordinary document pages.
