# Streaming UI Runtime Portfolio Brief

## One-Line Pitch

Streaming UI Runtime is a measured TypeScript runtime-core project for long-lived AI surfaces, using worker offload, transaction scheduling, and bounded viewport projection to protect urgent interaction paths from background streaming/session-scale work.

## Problem

AI chat, agent trace viewers, coding assistants, notebook-like review surfaces, and log viewers can stay open for long sessions while content keeps streaming in. As the session grows, normal user actions can collide with accumulated state, fanout, parsing, and projection work.

The project investigates that failure mode and turns the evidence into a runtime direction.

## Why Long-Lived AI Surfaces Are Different

Long-lived AI surfaces are not ordinary pages:

- they append content continuously;
- they preserve large session histories;
- they need fast input, click, and scroll handling even while background output continues;
- they often show only a viewport over a much larger logical session;
- they mix urgent visible updates with non-urgent background streaming work.

That workload looks closer to terminal/editor/log systems than to document-first DOM/VDOM pages.

## Architecture Overview

The proposed architecture is:

```text
stream/input events
  -> operation stream
  -> worker-resident runtime core
  -> transaction scheduler
  -> validated bounded projection
  -> main-thread viewport commit
```

The runtime direction is worker-resident state and scheduling, with the main thread handling bounded, validated projection commits. The current codebase freezes the TypeScript pure core, not a production Worker/Main runtime.

## What Has Been Implemented

Implemented now:

- TypeScript pure-core runtime scaffold under `runtime/`
- operation and transaction validation
- priority and scheduler policy
- backpressure policy
- projection policy
- checksum and equivalence counters
- immutable state store
- op log
- core engine and decision trace
- metrics snapshot
- pure worker/main adapter contracts
- in-memory roundtrip and session scenario harnesses
- runtime guard checks
- P0/P1 controlled targets, scenarios, and analysis scripts
- paper and external review packet drafts

Not implemented yet:

- real Worker runtime
- real main runtime
- DOM/React integration
- projection engine
- Canvas/OffscreenCanvas/WebGPU backend
- production accessibility/focus/caret model
- product integration

## Benchmark Methodology

The evidence chain is intentionally staged:

1. P0 product-trace motivation:
   - inspect product trace summaries to identify mechanism families;
   - treat product traces as motivation, not source replay.
2. F0-D controlled reproduction:
   - build a controlled derived-fanout workload that models action-triggered microtask flush and subscriber fanout;
   - verify that it creates repeatable main-thread long tasks.
3. F1 worker offload:
   - move equivalent structural work to a Worker path;
   - compare main-thread max task and long-task count against F0-D.
4. F2 worker scheduling:
   - compare monolithic worker execution against chunked/yielding scheduled worker execution;
   - measure urgent projection acknowledgement and visible latency.
5. P2 pure-core freeze:
   - freeze runtime-core implications as testable protocol/state/scheduler/projection scaffolding.

## Evidence-Backed Results

| Claim | Evidence |
|---|---|
| Product traces showed 600ms+ interaction bottlenecks | `bench/p0/product-trace-n-sweep.csv` and `docs/p0/p0-product-n-sweep-analysis.md`; public release requires trace-data review |
| F0-D reproduced a controlled long-task mechanism | `docs/p1/p1-f0d-product-range-3x-result.md`: `f0_run_task_max_ms` mean about `68.633ms`, max `70.117ms` |
| Worker offload reduced main-thread max task | `docs/p1/p1-f1-worker-offload-3x-result.md`: `68.633ms -> 2.679ms` mean |
| Worker offload removed 50ms+ main-thread long tasks | `docs/p1/p1-f1-worker-offload-3x-result.md`: long task count `1/run -> 0` |
| Worker scheduling reduced urgent visible latency | `docs/p1/p1-f2-worker-scheduler-ab-3x-result.md`: `22.867ms -> 3.333ms` mean |
| Runtime core has a broad TypeScript scaffold | `docs/p2/p2-pure-core-v0-freeze.md` and `runtime/` |
| Runtime tests passed | `docs/p2/p2-pure-core-v0-freeze.md`: `406/406` runtime tests passed at freeze |

See [evidence-map.md](evidence-map.md) for a stricter resume-claim map.

## How To Run Tests

Install dependencies:

```bash
npm install
```

Run the core checks:

```bash
npm run typecheck
npm run test:runtime
npm run check:runtime-guards
npm run check:p2-tooling
```

There is no top-level `npm test` script at the time this portfolio package was written.

## How To Run Benchmark Or Demo Commands

Serve the local P0 controlled target:

```bash
node scripts/p0/serve_controlled_target.mjs --host 127.0.0.1 --port 4317 --default-level L1
```

Open:

```text
http://127.0.0.1:4317/
```

Inspect capture usage:

```bash
bash scripts/p0/run_capture.sh --help
```

Print public benchmark matrices:

```bash
bash scripts/p0/print_p0d_matrix.sh
bash scripts/p0/print_p0e_matrix.sh
bash scripts/p1/print_p1a_b0_b1_matrix.sh
```

Run P1 analysis scripts only with reviewed/sanitized trace inputs. Raw private traces should stay outside the public repository.

## Limitations

- Product traces motivate the mechanism family; they are not source replay.
- F0-D/F1/F2 use controlled workloads and small repeated runs.
- F2 improves urgent latency but pays worker-side chunk/yield overhead.
- P2 is a pure-core scaffold, not production runtime integration.
- No real Worker/Main runtime boundary is implemented yet.
- No DOM/React integration, projection engine, or Canvas/WebGPU backend is implemented.
- No multi-urgent stress matrix exists yet.
- Accessibility, focus, caret, and selection semantics remain future production concerns.

## Roadmap

Next public-safe steps:

1. Review and sanitize tracked trace-derived CSVs.
2. Add a short demo recording or screenshots of controlled targets and result tables.
3. Add a public release branch with only sanitized benchmark summaries.
4. Add license.
5. Add a real Worker boundary smoke test when separately approved.
6. Add broader workload matrices after the evidence-to-design gate allows it.

