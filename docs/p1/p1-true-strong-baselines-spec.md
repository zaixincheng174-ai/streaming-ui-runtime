# P1 True Strong Baselines Specification

Date: 2026-04-24  
Project: Streaming UI Runtime for Long-Lived AI Surfaces  
Stage: Constitutional P1 planning

## 0. Purpose

This document defines the true P1 scope after correcting the P0-F proxy study classification.

P1 is not runtime implementation.

P1 is the strong-baseline stage.

Its purpose is to answer:

> Can strong conventional UI architectures handle realistic AI streaming workloads before a new runtime is justified?

---

## 1. Workload Family

True P1 must move beyond the P0-E proxy workload.

The primary workload should be an AI streaming surface with:

- token-by-token append
- markdown parsing and rendering
- code block rendering
- syntax highlighting
- auto-scroll / tail anchoring
- scrollback and jump-resume behavior
- active input box present during long output
- long-lived history
- variable-height message blocks
- mixed text / list / code / tool-output structure

The workload should include both:

1. steady streaming append
2. interaction-triggered send-path or commit-path burst

---

## 2. Required Baselines

### B0: Naive DOM Chat

A simple chat-like DOM surface.

Required features:

- full history mounted
- token append
- markdown rendering
- syntax highlighting if workload includes code
- auto-scroll

Purpose:

> weak baseline / lower bound.

### B1: Optimized DOM / React Chat

A stronger conventional implementation.

Possible techniques:

- batching
- memoization
- stable message components
- worker markdown parsing
- syntax highlight cache
- CSS containment
- reduced reflow triggers
- debounced stream update

Purpose:

> test whether conventional DOM engineering absorbs the workload.

### B2: DOM Virtualization

A virtualized chat/log surface.

Required features:

- variable-height row cache
- scroll anchoring
- tail-follow
- jump-resume
- logical-full state retained outside the mounted viewport

Must distinguish:

- visible-only operations
- logical-full operations

Primary comparison should preserve logical-full semantics.

Purpose:

> test whether reducing mounted DOM is sufficient.

### B3: Editor-Grade Baseline

Preferred:

- CodeMirror 6 embedded in a chat-like or log-like surface

Alternative:

- Monaco-style architecture
- editor-like text buffer / viewport model with production-level assumptions

Purpose:

> test against systems designed for long text buffers and viewported presentation.

---

## 3. Metrics

Primary metrics:

- INP / interaction latency where available
- send-click processing duration
- token append task p95 / p99
- long task count >50ms
- max task duration
- microtask / scripting share
- scroll latency
- tail-follow stability
- jump-resume stability

Secondary metrics:

- busy percentage
- layout event count
- paint event count
- memory growth
- DOM node count
- mounted vs logical block count

---

## 4. Fairness Rules

1. Baselines must share the same workload generator.
2. Baselines must use equivalent content:
   - same token stream
   - same markdown/code distribution
   - same message count
   - same output mass
3. Virtualized baselines must report whether operations are visible-only or logical-full.
4. Editor-grade baselines must not be replaced by toy text-buffer proxies.
5. Runtime prototypes are not allowed in P1.
6. P1 may add dependencies only if explicitly approved and documented.

---

## 5. Expected Outputs

True P1 should produce:

1. baseline implementation inventory
2. workload spec
3. run matrix
4. result table
5. reviewer-oriented baseline fairness note
6. decision:
   - proceed to P2 runtime abstraction
   - revise workload
   - add stronger baselines

---

## 6. Gate To P2

P2 should begin only after P1 shows one of the following:

1. strong conventional baselines remain burst-positive or unstable
2. editor-grade baseline exposes a limitation under AI streaming workload
3. virtualization helps but fails logical-full semantics
4. optimized DOM only works by weakening workload semantics

Do not enter P2 only because P0-F proxy baselines showed differences.

---

## 7. Immediate Next Step

Plan true P1 implementation.

Do not implement until the plan answers:

- which AI streaming workload is first
- whether React is included
- whether CodeMirror 6 is approved as dependency
- how markdown and syntax highlighting are controlled
- how input responsiveness is measured
- how results will be compared to P0/P0-F

