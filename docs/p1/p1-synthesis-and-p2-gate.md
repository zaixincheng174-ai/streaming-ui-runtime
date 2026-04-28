# P1 Synthesis And P2 Gate

## Decision

P1 has produced a credible controlled problem-solution chain.

P2 design/spec work may open. P2 implementation remains blocked. Canvas/WebGPU implementation remains blocked.

The next step is P2 runtime abstraction/spec, not runtime coding.

## Evidence Chain Summary

Product evidence:

- Real product traces show `click/pointerup -> Run microtasks -> multi-bundle/state-context coordination`.
- Source-semantics hints such as `setContextProperty` support state/context propagation and subscriber/fanout interpretation.
- Product evidence is not raw product source ownership or exact trace replay.

Controlled reproduction:

- F0-D 3x reproduced stable main-thread boundary-positive derived fanout:
  - `measured_count=3`
  - `valid_count=3`
  - `boundary_positive_count=3`
  - `f0_window_ms` mean `73.764ms`
  - `f0_microtask_window_ms` mean `66.987ms`
  - `f0_run_task_max_ms` mean `68.633ms`
  - `f0_long_task_count_50ms=[1,1,1]`

Attribution:

- F0-D long task is dominated by microtask/flush target work.
- It is not dominated by React commit, layout/paint/style, or GC.

Worker solution:

- F1 Worker B 3x is solution-positive:
  - `measured_count=3`
  - `valid_count=3`
  - `worker_equivalence_pass=true`
  - `main_thread_ok=true`
  - `f1_main_run_task_max_ms` mean `2.679ms`
  - `f1_main_long_task_count_50ms=[0,0,0]`
  - `f1_worker_compute_ms` mean `51.367ms`
  - `f1_worker_roundtrip_ms` mean `55.433ms`

Scheduler/projection:

- F2 A/B paired 3x is scheduler-positive:
  - `measured_count=6`
  - valid A `3/3`
  - valid B `3/3`
  - equivalence A/B pass
  - F2-A `urgent_main_ack_latency_ms` mean `20.933ms`
  - F2-B `urgent_main_ack_latency_ms` mean `0.900ms`
  - F2-A `urgent_end_to_end_visible_ms` mean `22.867ms`
  - F2-B `urgent_end_to_end_visible_ms` mean `3.333ms`
  - F2-B `chunk_count=313`
  - F2-B `yield_count=312`
  - F2-B `preemptions=1`

## Product-Side Finding

The product-side evidence supports a mechanism-family hypothesis:

`action-triggered Run microtasks / scripting-heavy multi-bundle coordination / state-context propagation / subscriber fanout`.

Boundaries:

- Not exact product source ownership.
- Not exact `o`/`Ze` semantics.
- Not raw product trace replay.
- Not proof that all product latency is this mechanism.

## Controlled Bottleneck Finding

F0-D shows that a controlled production React workload modeling derived fanout/state traversal/queue drain can produce stable main-thread `50ms+` long tasks.

Boundaries:

- F0-D is smaller than product heavy traces.
- F0-D is mechanism-family reproduction, not product replay.
- F0-D parameters are structurally motivated, not reverse-engineered exact ChatGPT constants.

## Controlled Solution Finding

F1 Worker B shows that equivalent derived fanout work can be moved off the main thread while preserving counters/checksums and eliminating main-thread `50ms+` long tasks.

Boundaries:

- Worker offload is validated for pure/derived/session-scale fanout work.
- It is not validated for DOM commit, browser layout/paint, or unavoidable main-thread product logic.
- It is not proof of final runtime success.

## Scheduler Finding

F2 demonstrates that worker-side transaction scheduling, chunking, yielding, and priority projection can reduce urgent projection latency relative to monolithic worker execution.

Boundaries:

- F2 is a controlled scheduler/projection protocol result.
- It is not yet a full production runtime.
- It is not generalized to all workload classes.

## Main Result Table

| Stage | Result | Key Metric | Interpretation |
|---|---|---:|---|
| Product P0 | `click/pointerup -> Run microtasks` | product bursts observed | product mechanism family identified |
| F0-D | boundary-positive | `f0_run_task_max` mean `68.633ms` | controlled main-thread bottleneck reproduced |
| F1 Worker B | solution-positive | main max task mean `2.679ms` | equivalent work off-main-thread removes long task |
| F2 Scheduled | scheduler-positive | urgent ack `20.933ms -> 0.900ms` | scheduled worker projection improves urgent latency |

## What P1 Proves

P1 proves:

- Action-triggered fanout/derived work is a credible controlled bottleneck.
- Worker offload is a credible solution lever for derived fanout.
- Transaction scheduling and priority projection are justified runtime mechanisms.
- Renderer-first / Canvas/WebGPU-first is not the next justified lever.
- The project has moved from evidence gathering to runtime protocol design.

## What P1 Does Not Prove

P1 does not prove:

- Product trace replay.
- All ChatGPT latency is explained.
- React generally fails.
- Worker offload solves all UI workloads.
- Accessibility/product readiness.
- Canvas/WebGPU relevance.
- P2 implementation authorization.
- Final paper claim without broader baselines/workloads.

## P2 Gate Decision

P2 design/spec gate may open.

P2 implementation remains blocked.

P2 should begin with:

- Runtime abstraction spec.
- Transaction model.
- Worker-resident state/fanout protocol.
- Projection protocol.
- Priority lanes.
- Backpressure and stale result handling.
- Failure modes and correctness invariants.

P2 should not begin with:

- Canvas/WebGPU implementation.
- Renderer backend.
- Full runtime coding.
- `allocation_probe`.
- Product integration.

## Required P2 Design Scope

P2 design deliverables:

- Ops-stream / transaction log.
- Worker-resident state partition.
- Transaction scheduler.
- Urgent projection protocol.
- Visible projection commit model.
- Equivalence/checksum model.
- Versioning and stale-result rejection.
- Priority lanes: `urgent-input > visible-projection > stream-update > background-indexing`.
- Measurement plan for future implementation.

## Risks And Reviewer Objections

Known risks and objections:

- F0-D magnitude is smaller than product heavy bursts.
- Controlled workload is synthetic but structurally motivated.
- Worker compute is not cycle-identical to main-thread compute.
- F1/F2 validate derived fanout offload, not DOM/layout-heavy workloads.
- Stronger baselines and broader workloads remain required.
- Product source ownership remains partial.

## Blocked Steps

The following remain blocked:

- P2 implementation.
- Canvas/WebGPU.
- `allocation_probe`.
- F0/F1/F2 parameter escalation.
- More DevTools collection.
- Claiming final runtime success.
- Claiming product replay.
- Claiming general AI UI solution.

## Final Recommendation

Treat P1 as successful enough to open P2 design/spec work, but not implementation. The next document should be a P2 runtime abstraction spec that converts the F0/F1/F2 findings into reusable runtime primitives.
