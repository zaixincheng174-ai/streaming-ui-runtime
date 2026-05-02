# Streaming UI Runtime for Long-Lived AI Surfaces

Performance research and runtime-core scaffolding for long-lived AI interfaces: append-heavy, viewport-centric surfaces such as chat sessions, agent traces, coding assistants, logs, and review workspaces.

This is not a production UI framework. It is a measured portfolio/research project that studies why long-running AI surfaces can become interaction-sensitive, then derives a worker-resident runtime direction from controlled evidence.

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
| F2 worker scheduling | Does worker scheduling improve urgent visibility? | urgent visible latency mean about `22.867ms -> 3.333ms` | Urgent latency win, not throughput win |
| P2 pure core | What runtime scaffold follows from the evidence? | protocol, validation, scheduler, state-store, projection policy, adapters, and harnesses frozen with `406/406` runtime tests passing | Pure core only, not real Worker/Main integration |

See [docs/portfolio/evidence-map.md](docs/portfolio/evidence-map.md) for claim-to-evidence mapping.

### P5 Scheduling Evidence

P5 is a synthetic scheduling-mechanism evidence chain for long-lived AI surfaces. It studies main-thread blocking under send-start, commit-window, dynamic active-context, multistream, and product-trace-shaped synthetic workloads.

The strongest current result is P5-X product-trace-shaped synthetic: B2x input delay `176.1ms` vs R0x `0.1ms` under equal trace/logical invariants. Interpret this as a blocked-vs-near-unblocked internal scheduling category, not browser INP and not a precise user-perceived speedup.

R0 does not eliminate work. It moves logical send/update/multistream/product-trace-shaped work into Worker and localizes remaining main-thread blocking to bounded commit. P4 remains not authorized.

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

Public-facing documentation has been added, but final publication still requires human review of tracked trace-derived CSV files under `bench/p0/`. Do not publish raw product-derived trace data without confirming it contains no private session context.

<!-- PORTFOLIO_EVIDENCE_START -->
## Portfolio Evidence

- [Portfolio overview](docs/portfolio/README.md)
- [Evidence map](docs/portfolio/evidence-map.md)
- [Results summary](docs/portfolio/results-summary.md)
- [Privacy and data boundary](docs/portfolio/privacy-and-data.md)

This public repo is a sanitized portfolio snapshot. Raw trace-derived CSVs and trace-specific research notes are excluded from public history.
<!-- PORTFOLIO_EVIDENCE_END -->
