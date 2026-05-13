# Application And Outreach Pack

## Purpose

Use this pack when sharing Streaming UI Runtime in job applications, recruiter messages, engineering review, portfolio walkthroughs, or public profile links.

This file is not new evidence. It translates the current repository narrative into reusable application material. For claim boundaries, always check [document-status-map.md](document-status-map.md) and [evidence-map.md](evidence-map.md) before sending.

## Safe One-Line Blurb

Streaming UI Runtime is a research-backed TypeScript runtime-core project studying worker-resident ownership, transaction scheduling, and bounded projection for long-lived AI surfaces such as chat sessions, agent traces, coding assistants, logs, and review workspaces.

## GitHub Or Portfolio Card

**Title:** Streaming UI Runtime for Long-Lived AI Surfaces

**Short description:** Measured TypeScript runtime-core and benchmark evidence for worker-resident ownership, transaction scheduling, and bounded projection in long-lived AI surfaces.

**Best links:**

- Repository entry point: [README.md](../../README.md)
- Five-minute overview: [docs/portfolio/README.md](README.md)
- Claim-to-evidence map: [docs/portfolio/evidence-map.md](evidence-map.md)
- Results summary: [docs/portfolio/results-summary.md](results-summary.md)

## Resume Bullets

Choose one or two bullets. Do not stack all of them unless the application specifically asks for a detailed project list.

- Built a TypeScript runtime-core research prototype for long-lived AI surfaces, covering protocol validation, transaction scheduling, state/projection policy, worker/main adapter contracts, metrics, and in-memory harnesses.
- Developed a controlled benchmark evidence chain showing worker offload reduced main-thread max task mean from about `68.6ms` to about `2.7ms` on a derived-fanout workload, with boundaries documented in a public evidence map.
- Designed worker-side transaction scheduling experiments that reduced controlled urgent projection timing from about `22.9ms` to about `3.3ms` in a scheduler A/B benchmark, while preserving the limit that this is not browser-level INP or Event Timing evidence.
- Packaged a reviewer-safe portfolio artifact with README, evidence map, document status map, short paper draft, P5 scheduling evidence packet, and adversarial audit to keep claims tied to reproducible artifacts.

## Application Paragraph

I included Streaming UI Runtime as a systems portfolio sample because it shows how I approach ambiguous performance problems: define the workload, reproduce a controlled mechanism, test a narrower architecture change, and preserve evidence boundaries. The project focuses on long-lived AI surfaces where session-scale background work can collide with urgent interaction paths. The current repository includes a TypeScript pure-core runtime scaffold, controlled benchmark notes, synthetic scheduling-delay proxy evidence, and public claim-boundary docs. It is intentionally not presented as a production UI framework or a product superiority claim.

## Recruiter Outreach Note

Hi <Name>,

I am sharing one project that best represents my systems and evidence discipline: Streaming UI Runtime for long-lived AI surfaces.

It studies append-heavy AI interfaces such as chat sessions, agent traces, coding assistants, logs, and review workspaces. The repository includes a TypeScript runtime-core scaffold, controlled benchmark evidence, and a strict claim-to-evidence map. The safest summary is worker-resident ownership/offload plus transaction scheduling for reducing and localizing main-thread blocking under controlled long-lived AI-surface workloads.

Best entry point: <repo link>

## Engineering Reviewer Note

Hi <Name>,

If you have time for a technical skim, I would read this repo in this order:

1. [README.md](../../README.md)
2. [docs/portfolio/document-status-map.md](document-status-map.md)
3. [docs/portfolio/evidence-map.md](evidence-map.md)
4. [docs/paper/streaming-ui-runtime-short-paper-draft-v0.md](../paper/streaming-ui-runtime-short-paper-draft-v0.md)
5. [docs/p5/p5y-final-reviewer-evidence-packet.md](../p5/p5y-final-reviewer-evidence-packet.md)
6. [docs/p5/p5y-reviewer-adversarial-audit.md](../p5/p5y-reviewer-adversarial-audit.md)

The main thing I want reviewed is not whether this is production-ready. It is whether the workload framing, controlled evidence chain, runtime-core direction, and rejected-claim boundaries are technically coherent.

## Demo And Review Path

### Five-Minute No-Setup Review

1. Read the [repository README](../../README.md).
2. Read the [portfolio overview](README.md).
3. Check the [evidence map](evidence-map.md) before quoting any numbers.
4. Use the [results summary](results-summary.md) for the short evidence table.

### Local Validation Commands

```bash
npm install
npm run typecheck
npm run test:runtime
npm run check:runtime-guards
npm run check:p2-tooling
```

### Local Controlled Target

```bash
node scripts/p0/serve_controlled_target.mjs --host 127.0.0.1 --port 4317 --default-level L1
```

Open:

```text
http://127.0.0.1:4317/controlled_append_surface.html?level=L1
```

The root URL `http://127.0.0.1:4317/` is also supported as a browser-friendly redirect alias.

Useful command references:

```bash
bash scripts/p0/run_capture.sh --help
bash scripts/p0/print_p0d_matrix.sh
bash scripts/p0/print_p0e_matrix.sh
bash scripts/p1/print_p1a_b0_b1_matrix.sh
```

## Screenshot Policy

Do not use generic screenshots as evidence for this project. The strongest public proof is the README, code, benchmark notes, evidence map, and validation commands.

If a visual is useful for a profile or slide, use only the local controlled target or conceptual architecture diagrams. Do not show private traces, raw CSVs, product screenshots, user-specific recordings, credentials, or local private result folders.

## Claim Guardrails

Safe claims:

- research-backed TypeScript runtime-core project;
- controlled benchmark evidence for worker offload and worker scheduling;
- synthetic scheduling-delay proxy evidence for long-lived AI-surface mechanisms;
- reviewer-safe evidence map and claim-boundary docs;
- not production-ready and not a productized framework.

Do not claim:

- browser-level INP improvement;
- Event Timing improvement;
- real product superiority;
- production readiness;
- complete Worker/Main runtime integration;
- DOM/React integration;
- Canvas, OffscreenCanvas, or WebGPU backend;
- P4/WebGPU authorization;
- P7 productization;
- precise user-perceived speedup ratios.

## Customer Or Pilot Boundary

This project is primarily a technical portfolio and engineering-review asset. Do not pitch it as a customer pilot or commercial product. If a product direction is discussed, frame it as a future validation path for long-lived AI workspaces or agent-trace tooling, not as current shipped product capability.
