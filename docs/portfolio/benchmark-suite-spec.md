# Long-Lived AI Surface Benchmark Suite — Mini Spec

## Status

This is a future-direction benchmark specification, not an implemented benchmark suite.

It does not add evidence, does not change the current P1/P5 claim boundary, and does not authorize new benchmark implementation by itself.

## Purpose

A Long-Lived AI Surface Benchmark Suite would make the workload definition explicit rather than treating this project as only one runtime direction.

It would help:

- compare DOM/VDOM, virtualized, editor-grade, terminal/log, and worker-resident approaches under shared workload shapes;
- separate workload effects from implementation-specific choices;
- give paper reviewers a clearer benchmark target for long-lived AI surfaces;
- support future product or OSS decisions without claiming production readiness.

## Workload Definition

Long-lived AI surfaces are interactive sessions that continue growing while users keep working inside them.

They are:

- append-heavy: new messages, tokens, logs, tool events, and trace blocks keep joining the session;
- viewport-centric: the user interacts with a bounded visible region over a larger logical session;
- tail-mutating: recent output can keep changing while new content appends;
- multistream / trace-like: assistant text, tool calls, status events, code chunks, and review notes can interleave;
- interactive during background work: user input, scrolling, selection, and inspection happen while streams continue;
- heterogeneous: blocks can include markdown, code, logs, tool results, citations, diffs, status, and trace metadata.

## Initial Workload Set

| workload | description | stress mechanism | expected relevance | status |
| --- | --- | --- | --- | --- |
| W1 Long Chat Session | A long chat transcript with streaming assistant output, retained history, and follow-up prompts. | Append-heavy tail growth, session-scale coordination, active context maintenance. | Baseline long-lived AI assistant surface. | Not yet implemented. |
| W2 Agent Trace / Tool Log | A trace surface with assistant steps, tool calls, tool results, status updates, and summaries. | Multistream merge, heterogeneous block updates, trace/progress fanout. | Agent and workflow surfaces are increasingly trace-like. | Not yet implemented. |
| W3 Long Review / Code Diff | A review workspace with code/diff chunks, comments, status blocks, and navigation through prior sections. | Variable-height blocks, code/diff rendering, scrollback, selection/copy correctness pressure. | Coding assistants and review tools need long-session inspection. | Not yet implemented. |
| W4 Multi-Model / Multi-Stream Compare Surface | A surface comparing multiple concurrent model outputs or agent lanes. | Multiple simultaneous append streams, merge ordering, bounded projection, background work scheduling. | Useful for evaluation, agent orchestration, and review workflows. | Not yet implemented. |

## Candidate Baselines

| baseline | what it tests | why needed | current status |
| --- | --- | --- | --- |
| B0 naive DOM | Full mounted DOM / straightforward append ownership. | Establishes the simplest document-oriented baseline. | Existing P5 family has naive DOM targets, but not this future suite. |
| B1 optimized React/DOM | Batched or optimized main-thread DOM/VDOM path. | Avoids strawman comparisons against unoptimized DOM. | Existing controlled/P5 baselines inform it; future suite version not implemented. |
| B2 virtualized DOM | Main-thread logical ownership with bounded visible DOM. | Tests whether windowing alone is sufficient. | Existing P5 virtualized targets inform it; future suite version not implemented. |
| B3 editor-grade baseline, CodeMirror/Monaco-like | Editor-style source of truth, transactions, and viewport discipline. | Necessary to compare against strong model/view systems. | Not implemented. |
| B4 terminal/log-viewer baseline | Append-heavy retained history with bounded presentation. | Tests whether the workload reduces to terminal/log scrollback. | Not implemented. |
| R0 worker-resident runtime direction | Worker-owned logical state, transaction scheduling, bounded projection commit. | Tests the project thesis under shared workloads. | Direction supported by current evidence; future suite implementation not started. |

## Metrics

Candidate metrics:

- main-thread max task;
- long task count;
- synthetic input-task scheduling delay;
- projection commit window;
- memory scaling;
- scroll latency / frame timing as a future metric;
- browser Event Timing / INP only if explicitly measured in a future browser-level interaction study;
- correctness metrics for search, copy, selection, scroll restoration, and block identity in later suite versions.

## Claim Boundaries

This spec does not prove production results.

It does not make browser-level INP or Event Timing claims.

It does not claim WebGPU is necessary.

It does not claim a worker runtime universally beats DOM, VDOM, editor-grade, or terminal/log approaches.

It does not claim the benchmark suite is implemented.

## Go / No-Go Gates

Go if:

- external feedback asks for benchmark, comparison, or workload-definition clarity;
- the project targets formal paper submission and needs a benchmark artifact;
- a strong baseline comparison is needed to answer a reviewer objection.

No-go if:

- there is no external feedback and no paper target;
- implementation would become open-ended benchmark sprawl;
- the work would reopen P4/WebGPU or P7 productization without a separate gate.

## E-mini Implementation Scope If Approved

Smallest useful implementation:

- 3 workloads;
- 3 baselines;
- 5 metrics;
- 1 generated report;
- no WebGPU;
- no product claims.

The implementation would need a separate approval step. This document is only the planning boundary.

## Relationship To F-light

F-light external feedback should decide whether a benchmark suite, trace viewer, or open-source integration is more valuable.

If external readers ask for comparability and workload definition, E-mini can become the next small benchmark planning step.

If they ask for product tangibility, a trace-viewer direction may be more useful.

If they ask for adoption or integration, open-source integration work may matter more than another benchmark axis.
