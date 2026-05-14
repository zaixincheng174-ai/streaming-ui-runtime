# Portfolio Evidence Map

This file maps resume and portfolio claims to repository evidence. It is intentionally strict: do not use a claim publicly unless the evidence and boundary are clear.

For document status and superseded-draft guidance, see [document-status-map.md](document-status-map.md).

## Navigation

- Start with the [repository README](../../README.md) and [portfolio overview](README.md).
- Use the [document status map](document-status-map.md) before quoting older drafts.
- Use this evidence map for claim-to-artifact checks.
- Use the tangibility pack for quick explanation: [one-pager](one-pager.md), [interview pitch](interview-pitch.md), [walkthrough script](walkthrough-script.md), and [architecture diagrams](architecture-diagram.md).
- Use the [application and outreach pack](application-outreach-pack.md) for resume bullets, public profile blurbs, recruiter notes, engineering-review notes, and demo commands.
- Use the [benchmark suite mini spec](benchmark-suite-spec.md) only as future-direction planning; it is not an implemented benchmark suite.
- Use the [streaming Markdown stability demo post-audit](streaming-markdown-stability-demo-post-audit.md) before treating the local browser demo as evidence.
- Use the [related systems positioning](../paper/streaming-ui-runtime-related-work-v0.md), [short paper draft](../paper/streaming-ui-runtime-short-paper-draft-v0.md), [P5 appendix](../paper/appendix/p5-scheduling-evidence-appendix.md), [P5 final reviewer packet](../p5/p5y-final-reviewer-evidence-packet.md), and [P5 adversarial audit](../p5/p5y-reviewer-adversarial-audit.md) for reviewer-facing evidence.

## Summary Table

| Resume claim | Evidence location | Safe public wording | Boundary |
|---|---|---|---|
| External reader entry path | `README.md`; `docs/portfolio/README.md`; `docs/portfolio/document-status-map.md`; `docs/paper/streaming-ui-runtime-related-work-v0.md`; `docs/paper/streaming-ui-runtime-short-paper-draft-v0.md`; `docs/paper/appendix/p5-scheduling-evidence-appendix.md`; `docs/p5/p5y-final-reviewer-evidence-packet.md`; `docs/p5/p5y-reviewer-adversarial-audit.md` | The repository has a reviewer path from README to portfolio overview, document status map, evidence map, related systems positioning, short paper, P5 appendix, final P5 packet, and adversarial audit | Navigation only; does not add evidence or expand claims |
| Portfolio tangibility pack | `docs/portfolio/one-pager.md`; `docs/portfolio/interview-pitch.md`; `docs/portfolio/walkthrough-script.md`; `docs/portfolio/architecture-diagram.md` | The repository includes short recruiter/interviewer explanation docs that translate the existing evidence and claim boundary | Explanation only; does not add evidence or expand claims |
| Application and outreach pack | `docs/portfolio/application-outreach-pack.md`; `README.md`; `docs/portfolio/README.md`; this evidence map | The repository includes reusable resume bullets, profile blurbs, outreach notes, and demo commands tied to existing evidence | Reusable application material only; does not add evidence, production readiness, or customer-pilot proof |
| Future benchmark suite planning | `docs/portfolio/benchmark-suite-spec.md` | The repository includes a planning spec for what a future Long-Lived AI Surface Benchmark Suite would measure | Future-direction planning only; benchmark suite is not implemented |
| 600ms+ interaction bottleneck | `docs/portfolio/results/trace-derived-csv-summary.md`; `docs/p0/p0-product-n-sweep-analysis.md`; `docs/paper/streaming-ui-runtime-external-review-packet-v0.md` | Sanitized product-trace summaries showed 600ms+ interaction windows in long-session AI surfaces | Raw trace-derived CSVs are excluded from public evidence; not source replay |
| 70ms F0-D benchmark long task | `docs/p1/p1-f0d-product-range-3x-result.md` | Controlled F0-D benchmark produced repeatable 50ms+ long tasks, with max `70.117ms` and mean `68.633ms` | Controlled derived-fanout workload, not product replay |
| 68ms to 2.7ms worker offload result | `docs/p1/p1-f1-worker-offload-3x-result.md` | Worker offload reduced main-thread max task mean from `68.633ms` to `2.679ms` | Equivalent controlled workload; not proof all UI work can move off-main-thread |
| zero long tasks | `docs/p1/p1-f1-worker-offload-3x-result.md` | Worker offload reduced 50ms+ main-thread long tasks from one per F0-D run to zero in F1 runs | Applies to F1 controlled offload experiment |
| 22.9ms to 3.3ms controlled urgent projection timing | `docs/p1/p1-f2-worker-scheduler-ab-3x-result.md` | Worker scheduling reduced controlled urgent projection timing mean from `22.867ms` to `3.333ms` | Single urgent request per run; not total throughput improvement or full user-perceived latency |
| streaming Markdown stability demo | `bench/p1/targets/p1_streaming_markdown_stability_demo.html`; `bench/p1/lib/streaming_markdown_stability_core.mjs`; `tests/p1/streaming-markdown-stability-demo-contract.test.mjs`; `docs/portfolio/streaming-markdown-stability-demo-post-audit.md` | Local browser demo shows deterministic simulated Markdown-like streams where stable tail-block rendering reduces completed-block churn versus naive full reparse | Demonstration only; not a production Markdown library, not a provider integration, not browser-level INP, and does not compare against external Markdown libraries |
| 17-module TypeScript runtime | `docs/p2/p2-pure-core-v0-freeze.md`; `runtime/` | Implemented a TypeScript pure-core runtime across protocol, validation, scheduler, state, projection, adapter, metrics, and harness modules | Current tracked runtime source inventory contains 25 TypeScript files; if using "17-module", define it as capability modules, not source files |
| 406 passing tests | `docs/p2/p2-pure-core-v0-freeze.md` | Runtime freeze validation recorded `406/406` runtime tests passing | Historical freeze snapshot; rerun current tests before each release |
| P5 synthetic scheduling-mechanism evidence | `docs/p5/p5y-final-reviewer-evidence-packet.md`; `docs/p5/p5y-reviewer-adversarial-audit.md`; `docs/portfolio/p5-scheduling-evidence-summary.md`; `docs/paper/appendix/p5-scheduling-evidence-appendix.md` | P5 supports that worker-resident logical ownership can reduce and localize main-thread blocking under synthetic long-lived AI-surface workloads | Synthetic scheduling-delay proxy, not browser-level INP, not Event Timing, not production readiness, not real product superiority; P4 remains not authorized |

## Claim Details

### 600ms+ Interaction Bottleneck

Evidence:

- `docs/portfolio/results/trace-derived-csv-summary.md`
- `docs/portfolio/results/trace-derived-csv-summary.json`
- `docs/p0/p0-product-n-sweep-analysis.md`
- `docs/paper/streaming-ui-runtime-external-review-packet-v0.md`

Safe wording:

> Identified 600ms+ interaction windows in product-trace summaries for long-session AI surfaces, with evidence pointing toward click-triggered microtask-heavy coordination.

Do not claim:

- exact source-level root cause;
- product source replay;
- universal React failure;
- that raw product trace data is public-safe;
- that local trace-derived CSV source files are part of the public evidence package.

### 70ms F0-D Benchmark Long Task

Evidence:

- `docs/p1/p1-f0d-product-range-3x-result.md`

Key numbers:

- `f0_run_task_max_ms min/mean/max = 67.793 / 68.633 / 70.117`
- `f0_long_task_count_50ms=[1,1,1]`

Safe wording:

> Built a controlled F0-D derived-fanout benchmark that produced repeatable 50ms+ main-thread long tasks, with max task near 70ms.

### 68ms To 2.7ms Worker Offload Result

Evidence:

- `docs/p1/p1-f1-worker-offload-3x-result.md`

Key numbers:

- F0-D main-thread max task mean: `68.633ms`
- F1 worker-offload main-thread max task mean: `2.679ms`

Safe wording:

> Validated a worker-offload path that reduced main-thread max task mean from about 68.6ms to about 2.7ms on the controlled derived-fanout workload.

### Zero Long Tasks

Evidence:

- `docs/p1/p1-f1-worker-offload-3x-result.md`

Key numbers:

- F0-D long task count per run: `1`
- F1 worker-offload main-thread long task count: `0 / 0 / 0`

Safe wording:

> Worker offload removed 50ms+ main-thread long tasks in the controlled F1 runs while preserving equivalent structural work.

### 22.9ms To 3.3ms Controlled Urgent Projection Timing

Evidence:

- `docs/p1/p1-f2-worker-scheduler-ab-3x-result.md`

Key numbers:

- F2-A urgent end-to-end visible mean: `22.867ms`
- F2-B urgent end-to-end visible mean: `3.333ms`
- F2-B chunk count: `313`
- F2-B yield count: `312`
- F2-B preemptions: `1`

Safe wording:

> Designed worker-side transaction scheduling with priority preemption, reducing controlled urgent projection timing from about 22.9ms to about 3.3ms in a controlled A/B scheduler experiment.

Boundary:

- This is urgent latency, not throughput.
- F2-B worker total time was higher than F2-A because scheduling pays chunk/yield overhead.
- Each run injects one urgent request.

### Streaming Markdown Stability Demo

Evidence:

- `bench/p1/targets/p1_streaming_markdown_stability_demo.html`
- `bench/p1/lib/streaming_markdown_stability_core.mjs`
- `tests/p1/streaming-markdown-stability-demo-contract.test.mjs`
- `scripts/p1/audit_streaming_markdown_stability_demo.mjs`
- `docs/portfolio/streaming-markdown-stability-demo-post-audit.md`

Safe wording:

> Built a local browser streaming Markdown stability demo that compares naive full accumulated-source reparse against stable completed-block reuse plus mutable-tail rendering across deterministic simulated chunks.

Boundary:

- It covers incomplete fenced code, a streamed GFM table, LaTeX/math-like partial input, and a mixed long assistant answer.
- It reports render count, completed-block re-render count, approximate node churn, and average/max update time.
- It is not a production Markdown library.
- It is not a provider integration.
- It is not browser-level INP or Event Timing evidence.
- It does not compare against external Markdown libraries.

### 17-Module TypeScript Runtime

Evidence:

- `docs/p2/p2-pure-core-v0-freeze.md`
- `runtime/`
- `tests/runtime/`

The freeze note lists the implemented pure-core areas:

- protocol / envelope validation
- message serialization and bounded payload validation
- operation validation
- transaction validation and lifecycle
- priority / scheduler policy
- backpressure policy
- projection policy
- checksum / equivalence counter validation
- error and recovery policy
- op-log
- immutable session state-store
- core-decision and core-engine
- decision trace
- metrics snapshot
- pure worker-side adapter
- pure main-side projection adapter
- worker/main adapter contract tests
- in-memory roundtrip harness
- in-memory session scenario harness
- runtime guard checks

Current source inventory:

- 25 tracked TypeScript files under `runtime/`
- 22 tracked runtime test files under `tests/runtime/`

Safe wording:

> Implemented a TypeScript pure-core runtime scaffold across protocol, validation, scheduling, state, projection, adapter, metrics, and harness modules.

If using "17-module" publicly, define "module" as a capability area, not an exact source-file count.

### 406 Passing Tests

Evidence:

- `docs/p2/p2-pure-core-v0-freeze.md`

Safe wording:

> The P2 pure-core freeze recorded `406/406` runtime tests passing.

Boundary:

- This is the freeze snapshot. Current release validation should rerun `npm run test:runtime`.

### P5 Synthetic Scheduling-Mechanism Evidence

Evidence:

- `docs/p5/p5y-final-reviewer-evidence-packet.md`
- `docs/p5/p5y-reviewer-adversarial-audit.md`
- `docs/portfolio/p5-scheduling-evidence-summary.md`
- `docs/paper/appendix/p5-scheduling-evidence-appendix.md`
- `bench/p5/results/p5x_b2c_product_trace_shaped_results.json`
- `bench/p5/results/p5x_r0c_product_trace_shaped_results.json`
- `docs/p5/p5v-multistream-agent-trace-mechanism-summary.md`
- `docs/p5/p5t-dynamic-update-concurrent-input-mechanism-summary.md`
- `docs/p5/p5w-evidence-packet-freeze.md`

Key numbers:

- P5-X product-trace-shaped synthetic scheduling-delay proxy: B2x `176.1ms` vs R0x `0.1ms` under equal trace/logical invariants
- P5-U multistream agent-trace: B2u synthetic input-task scheduling delay `164.3ms`, R0u synthetic input-task scheduling delay `0.1ms`
- P5-S dynamic update: B2s synthetic input-task scheduling delay `35.2ms`, R0s synthetic input-task scheduling delay `0.1ms`
- P5-O commit-window: R0o commit-window delay `4.7ms`

Safe wording:

> P5 provides synthetic scheduling-mechanism evidence that worker-resident ownership of long-lived AI-surface logical work can reduce and localize main-thread blocking while preserving synthetic input-task availability during Worker-side processing.

Do not claim:

- browser-level INP improvement;
- Event Timing evidence;
- production readiness;
- real product superiority;
- R0 removes every main-thread blocking window;
- precise user-perceived speedup ratios;
- P4/WebGPU authorization.

Boundary:

- P5 uses a `setTimeout` synthetic scheduling-delay proxy.
- P5-X is product-trace-shaped synthetic evidence, not real product trace evidence.
- R0 does not eliminate work; it moves logical work into Worker and leaves bounded projection commit on main.
- P4 remains not authorized.

## P5 Evidence Packet Artifacts

| artifact | purpose | status |
| --- | --- | --- |
| P5-Y final reviewer evidence packet | Reviewer-facing claim-boundary packet for P5 | frozen |
| P5-Y adversarial audit | Strict overclaim and risk register | frozen |
| P5 scheduling portfolio summary | Concise portfolio-facing P5 summary | current |
| P5 paper appendix | Paper appendix packaging for P5 evidence | current |
| Related systems positioning (`docs/paper/streaming-ui-runtime-related-work-v0.md`) | External-reader positioning against DOM/VDOM, virtualization, editors, terminals, Workers, OffscreenCanvas, WebGPU, and agent-trace workloads | current |
| P5-X result JSONs | Product-trace-shaped synthetic source results | collected |
| P5-W / P5-V / P5-T summaries | Prior evidence freeze and mechanism summaries | collected |

## P6 / P7 Boundary

P6 should package the research-backed OSS / portfolio engineering asset: short paper draft, appendix, README, portfolio summary, evidence map, and claim-boundary packet. P6 should not claim production readiness, real product superiority, browser-level INP, Event Timing, P4/WebGPU authorization, or a production Agent Trace Viewer.

P7 is the later product-grade expansion phase. Product validation, production integration, accessibility/focus/caret behavior, and any Agent Trace Viewer or long-lived AI workspace productization belong there, not in the current P6 packaging pass.
