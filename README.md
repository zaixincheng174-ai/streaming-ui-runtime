# Streaming UI Runtime for Long-Lived AI Surfaces

Performance research and runtime-core scaffolding for long-lived AI interfaces: append-heavy, viewport-centric surfaces such as chat sessions, agent traces, coding assistants, logs, and review workspaces.

This is not a production UI framework. It is a measured portfolio/research project that studies why long-running AI surfaces can become interaction-sensitive, then derives a worker-resident runtime direction from controlled evidence.

## 30-Second Summary

- **What it is:** a research-backed OSS / portfolio engineering asset for long-lived AI surfaces.
- **Problem studied:** append-heavy, viewport-centric, tail-mutating AI workloads can stress document/tree-oriented DOM or VDOM ownership models.
- **Technical direction:** worker-resident ownership/offload, transaction scheduling, and bounded projection commit.
- **Evidence:** controlled P1 benchmarks plus synthetic P5 scheduling-delay proxy evidence support reducing and localizing main-thread blocking under these workloads.
- **Boundary:** not a production UI, not browser-level INP or Event Timing evidence, not real product superiority, and not P4/WebGPU or P7 productization.

## What This Project Is

Streaming UI Runtime is a research-backed OSS / portfolio engineering asset for long-lived AI surfaces. It studies the workload-architecture mismatch between append-heavy, viewport-centric, tail-mutating AI workloads and document/tree-oriented DOM or VDOM UI stacks.

The runtime direction is worker-resident logical ownership, transaction scheduling, and bounded viewport projection. The main thread still matters, but the intended role is bounded projection commit rather than ownership of all session-scale logical work.

## What This Project Is Not

- Not a production AI chat UI.
- Not a productized Agent Trace Viewer.
- Not a commercial product.
- Not a WebGPU-first renderer.
- Not browser-level INP or Event Timing evidence.
- Not real product superiority evidence.
- Not production readiness.
- Not P4/WebGPU authorization or P7 productization.

## Why This Exists

Most web UI stacks are optimized around document-oriented DOM or VDOM updates. Long-lived AI surfaces behave differently:

- sessions grow over time;
- new content streams into the tail;
- users still need low-latency input, click, and scroll paths;
- background state/fanout work can collide with urgent interactions;
- visible output is usually a bounded viewport projection, not the whole logical session.

The thesis is a workload-architecture mismatch: long-lived AI surfaces increasingly look more like terminal/editor/log surfaces than ordinary document pages.

## Current Evidence Chain

| Stage | Question | Evidence-backed result | Boundary |
|---|---|---:|---|
| P0 product-trace motivation | What mechanism appears in long sessions? | 600ms+ interaction windows in product traces, dominated by click -> microtask-heavy coordination | Motivating trace evidence, not source replay |
| F0-D controlled reproduction | Can a controlled workload reproduce long main-thread tasks? | `f0_run_task_max_ms` mean about `68.633ms`; max `70.117ms`; one 50ms+ long task per run | Controlled derived-fanout workload |
| F1 worker offload | Can equivalent work leave the main thread? | main-thread max task mean about `2.679ms`; long task count `0` | Worker-offload solution lever, not full runtime |
| F2 worker scheduling | Does worker scheduling improve controlled urgent projection timing? | controlled urgent projection timing mean about `22.867ms -> 3.333ms` | Urgent projection timing improvement, not throughput or user-perceived latency proof |
| P2 pure core | What runtime scaffold follows from the evidence? | protocol, validation, scheduler, state-store, projection policy, adapters, and harnesses frozen with `406/406` runtime tests passing | Pure core only, not real Worker/Main integration |
| P1 streaming Markdown stability demo | What does tail-mutating Markdown churn look like in a browser? | local demo compares naive full reparse against stable completed-block plus mutable-tail rendering across four simulated cases | Demonstration only; not a production Markdown library, not browser-level INP, and not a provider integration |

See [docs/portfolio/evidence-map.md](docs/portfolio/evidence-map.md) for claim-to-evidence mapping.
Use [docs/portfolio/document-status-map.md](docs/portfolio/document-status-map.md) to distinguish current public-reader documents from historical drafts and process notes.

## Current Strongest Claim

Controlled P1 and synthetic P5 evidence support worker-resident ownership/offload as a way to reduce and localize main-thread blocking under long-lived AI-surface workloads. Bounded main-thread projection commit remains the remaining blocking window.

This is a conservative mechanism claim. It is not browser-level INP, not Event Timing, not real product superiority, and not production readiness.

## For Recruiters / Engineers / Reviewers

- **Recruiters:** read this README and the [portfolio overview](docs/portfolio/README.md) for the project story and resume-safe scope.
- **Engineers:** read the [evidence map](docs/portfolio/evidence-map.md) and [related systems positioning](docs/paper/streaming-ui-runtime-related-work-v0.md) for architecture and comparison context.
- **Reviewers:** read the [short paper draft](docs/paper/streaming-ui-runtime-short-paper-draft-v0.md), [P5 appendix](docs/paper/appendix/p5-scheduling-evidence-appendix.md), [P5 final packet](docs/p5/p5y-final-reviewer-evidence-packet.md), and [P5 adversarial audit](docs/p5/p5y-reviewer-adversarial-audit.md).

## Evidence Path For Reviewers

Read in this order:

1. [Portfolio overview](docs/portfolio/README.md)
2. [Document status map](docs/portfolio/document-status-map.md)
3. [Evidence map](docs/portfolio/evidence-map.md)
4. [Related systems positioning](docs/paper/streaming-ui-runtime-related-work-v0.md)
5. [Short paper draft](docs/paper/streaming-ui-runtime-short-paper-draft-v0.md)
6. [P5 scheduling evidence appendix](docs/paper/appendix/p5-scheduling-evidence-appendix.md)
7. [P5 final reviewer evidence packet](docs/p5/p5y-final-reviewer-evidence-packet.md)
8. [P5 adversarial audit](docs/p5/p5y-reviewer-adversarial-audit.md)

### P5 Scheduling Evidence

P5 is a synthetic scheduling-mechanism evidence chain for long-lived AI surfaces. It studies main-thread blocking under send-start, commit-window, dynamic active-context, multistream, and product-trace-shaped synthetic workloads.

The strongest current result is P5-X product-trace-shaped synthetic scheduling-delay proxy: B2x `176.1ms` vs R0x `0.1ms` under equal trace/logical invariants. Interpret this as a blocked-vs-near-unblocked internal scheduling category, not browser-level INP and not a precise user-perceived speedup.

R0 does not eliminate work. It moves logical send/update/multistream/product-trace-shaped work into Worker and localizes remaining main-thread blocking to bounded projection commit. P4 remains not authorized.

See [P5 final reviewer evidence packet](docs/p5/p5y-final-reviewer-evidence-packet.md), [P5 adversarial audit](docs/p5/p5y-reviewer-adversarial-audit.md), and [P5 scheduling evidence summary](docs/portfolio/p5-scheduling-evidence-summary.md).

## What Is Implemented

- TypeScript pure-core runtime modules under `runtime/`
- operation and transaction validation
- scheduler and backpressure policies
- projection policy and bounded commit gates
- immutable state store and op log
- message serialization and checksums
- pure worker/main adapter contracts
- in-memory roundtrip and session scenario harnesses
- runtime guard checks
- controlled benchmark targets and analysis scripts
- isolated browser streaming Markdown stability demo
- paper-style documentation and figure drafts

## What Is Not Implemented

- production Worker runtime
- production main-thread runtime
- DOM/React integration
- projection engine
- Canvas, OffscreenCanvas, or WebGPU backend
- product integration
- accessibility/focus/caret production model
- broad workload matrix
- multi-urgent stress testing

## Current Limitations

- Not browser-level INP.
- Not Event Timing.
- Not production runtime evidence.
- Not real product superiority.
- Not a complete Canvas, OffscreenCanvas, or WebGPU backend.
- Not P4 authorization.
- Not P7 productization.

## Quick Start

Install dependencies:

```bash
npm install
```

Run validation:

```bash
npm run typecheck
npm run test:runtime
npm run check:runtime-guards
npm run check:p2-tooling
```

Serve the controlled P0 target:

```bash
node scripts/p0/serve_controlled_target.mjs --host 127.0.0.1 --port 4317 --default-level L1
```

Open the default controlled surface:

```text
http://127.0.0.1:4317/controlled_append_surface.html?level=L1
```

Serve the P1 local browser demos:

```bash
node scripts/p1/serve_p1_streaming_baselines.mjs --host 127.0.0.1 --port 4319
```

Open the streaming Markdown stability demo:

```text
http://127.0.0.1:4319/p1_streaming_markdown_stability_demo.html
```

Inspect capture CLI usage:

```bash
bash scripts/p0/run_capture.sh --help
```

Print benchmark matrices:

```bash
bash scripts/p0/print_p0d_matrix.sh
bash scripts/p0/print_p0e_matrix.sh
bash scripts/p1/print_p1a_b0_b1_matrix.sh
```

## Repository Layout

```text
bench/          controlled targets, scenarios, and public benchmark summaries
docs/p0/        P0 motivation, measurement notes, and trace-derived analysis
docs/p1/        controlled baseline/offload/scheduler result notes
docs/p2/        pure-core runtime abstraction and freeze docs
docs/paper/     paper draft, review packet, and figure drafts
docs/portfolio/ public portfolio packaging and release-safety notes
runtime/        TypeScript pure-core runtime scaffold
scripts/        capture, serving, analysis, and guard scripts
tests/runtime/  runtime contract and policy tests
```

## Privacy And Data Boundary

This repository should only publish sanitized benchmark summaries and reproducible synthetic/controlled workloads. Private traces, raw captures, credentials, local logs, and private result folders must stay out of the public repo.

See [docs/portfolio/privacy-and-data.md](docs/portfolio/privacy-and-data.md).

## Public Release Status

Public-facing documentation has been added, and raw product-derived trace CSVs are excluded from tracked public evidence. Final publication should use the sanitized summaries under `docs/portfolio/results/` and should not publish local trace-derived CSVs without a separate privacy review.

<!-- PORTFOLIO_EVIDENCE_START -->
## Portfolio Evidence

- [Portfolio overview](docs/portfolio/README.md)
- [Document status map](docs/portfolio/document-status-map.md)
- [Evidence map](docs/portfolio/evidence-map.md)
- [One-pager](docs/portfolio/one-pager.md)
- [Interview pitch](docs/portfolio/interview-pitch.md)
- [Walkthrough script](docs/portfolio/walkthrough-script.md)
- [Application and outreach pack](docs/portfolio/application-outreach-pack.md)
- [Architecture diagrams](docs/portfolio/architecture-diagram.md)
- [Benchmark suite mini spec](docs/portfolio/benchmark-suite-spec.md)
- [Streaming Markdown stability demo post-audit](docs/portfolio/streaming-markdown-stability-demo-post-audit.md)
- [Results summary](docs/portfolio/results-summary.md)
- [Privacy and data boundary](docs/portfolio/privacy-and-data.md)

This public repo is a sanitized portfolio snapshot. Raw trace-derived CSVs and trace-specific research notes are excluded from public history.
<!-- PORTFOLIO_EVIDENCE_END -->
