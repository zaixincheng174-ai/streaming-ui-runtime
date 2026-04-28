# F2 Worker-side Scheduling v0

## Purpose of This Section

F1 shows that equivalent derived fanout work can leave the main thread. F2 asks the next question: once heavy work is off-main-thread, does Worker execution still need scheduling to avoid delaying urgent visible projection?

This section should present F2 as a worker-internal scheduling result. It should not be framed as a repeat of the F1 offload finding, a total throughput improvement, product trace replay, or final runtime proof.

## Research Question

When heavy derived fanout work runs in a Worker, does scheduled/chunked transaction processing reduce urgent projection latency compared with monolithic Worker execution, while preserving equivalent structural work?

The question targets priority inversion inside the Worker. A basic Worker offload can remove main-thread long tasks, but a large Worker transaction can still delay urgent visible projection if it runs monolithically.

## Experimental Setup

F2 compares two Worker-side execution arms under equivalent structural work.

F2-A Monolithic:

- `scheduler_mode=monolithic`
- `worker_chunk_size=all`
- `worker_yield_strategy=none`
- `worker_chunk_count=1`
- `worker_yield_count=0`
- `worker_preemptions=0`

F2-B Scheduled:

- `scheduler_mode=scheduled`
- `worker_chunk_size=128`
- `worker_yield_strategy=message-channel`
- `worker_chunk_count=313`
- `worker_yield_count=312`
- `worker_preemptions=1`

Both arms preserve equivalent structural work:

- `module_flush_count=20`
- `subscriber_notify_count=1920`
- `queue_drain_step_count=5120`
- `derived_selector_eval_count=15360`
- `state_nodes_touched_observed=32768`
- `derived_hash_rounds_observed=131072`
- `projection_update_count_observed=6`
- `synthetic_pressure_multiplier=1`

## Main Result

F2 A/B paired 3x aggregate:

- `measured_count=6`
- `valid_a_count=3`
- `valid_b_count=3`
- `equivalence_a_pass=true`
- `equivalence_b_pass=true`
- `decision=F2_AB_3X_SCHEDULER_POSITIVE`

Main result table:

| Metric | F2-A Monolithic | F2-B Scheduled | Interpretation |
|---|---:|---:|---|
| `valid_count` | `3/3` | `3/3` | both valid |
| `urgent_main_ack_latency_ms` mean | `20.933ms` | `0.900ms` | scheduled admits urgent work much sooner |
| `urgent_end_to_end_visible_ms` mean | `22.867ms` | `3.333ms` | scheduled visible response much faster |
| `f2_main_max_task_ms` mean | `2.810ms` | `2.378ms` | both keep main thread bounded |
| `worker_heavy_txn_total_ms` mean | `26.8ms` | `48.533ms` | scheduled pays chunk/yield overhead |
| `worker_chunk_count` | `1` | `313` | scheduled splits work |
| `worker_yield_count` | `0` | `312` | scheduled yields |
| `worker_preemptions` | `0` | `1` | scheduled admits urgent projection |

## Paired Deltas

| Pair | F2-A ack | F2-B ack | Ack delta | F2-A visible | F2-B visible | Visible delta |
|---|---:|---:|---:|---:|---:|---:|
| 01 | `23.2ms` | `1.0ms` | `22.2ms` | `25.0ms` | `3.6ms` | `21.4ms` |
| 02 | `19.2ms` | `0.8ms` | `18.4ms` | `22.3ms` | `3.0ms` | `19.3ms` |
| 03 | `20.4ms` | `0.9ms` | `19.5ms` | `21.3ms` | `3.4ms` | `17.9ms` |

All three paired deltas favor F2-B scheduled.

## Interpretation

F2-B demonstrates that Worker-side chunking/yielding/preemption can reduce same-clock urgent projection acknowledgement and projection-commit latency relative to monolithic Worker execution.

F2 is not testing main-thread offload. F1 already tested that by moving equivalent derived fanout work off the main thread and removing the F0-D main-thread long task.

F2 tests Worker-internal transaction scheduling after work is already off-main-thread. The scheduler-positive result is about urgent responsiveness, not total throughput.

## Throughput vs Responsiveness Tradeoff

F2-B is not faster in total Worker compute:

- F2-A `worker_heavy_txn_total_ms` mean is about `26.8ms`.
- F2-B `worker_heavy_txn_total_ms` mean is about `48.533ms`.

Scheduled execution pays chunk/yield overhead. The positive result is that urgent visible work is admitted much sooner, not that all Worker work completes faster.

This is a responsiveness tradeoff. Scheduled mode is preferable when urgent visible responsiveness matters. Scheduled mode is not universally better for pure throughput-only background work.

## Same-Clock Metrics

Final F2 A/B interpretation uses:

- `urgent_main_ack_latency_ms`
- `urgent_end_to_end_visible_ms`

Worker-clock or mixed-clock diagnostic fields must not be used for the final scheduler-positive claim, including:

- `urgent_main_to_worker_delay_ms`
- `urgent_end_to_end_latency_ms`
- `urgent_request_received_at_worker`
- `urgent_worker_start_at`
- `urgent_worker_done_at`

The paper should keep the final claim on same-clock urgent acknowledgement and visible commit latency.

## Commit Latency Boundary

`urgent_end_to_end_visible_ms` measures urgent request to main-thread projection commit completion.

It does not include:

- full display pipeline;
- paint;
- compositor;
- monitor scanout;
- exact human-perceived pixel latency.

Safe wording: F2-B reduces projection-commit latency / visible update commit latency.

## Single-Urgent Boundary

Each F2 run injects one urgent visible projection request during heavy Worker work. Therefore `worker_preemptions=1` per scheduled run is expected.

This result does not prove behavior under multiple simultaneous urgent requests. Multi-urgent stress remains future work.

## What F2 Proves

- Worker-side scheduling matters beyond basic offload.
- Urgent visible projection can be admitted during heavy Worker work.
- Priority lanes / chunking / yielding / preemption are justified runtime mechanisms.
- Equivalent structural work can be preserved while improving urgent responsiveness.

## What F2 Does Not Prove

- Not product trace replay.
- Not final runtime success.
- Not total throughput improvement.
- Not exact user-perceived pixel latency.
- Not multi-urgent behavior.
- Not broad workload generalization.
- Not Canvas/WebGPU relevance.
- Not production readiness.

## Relationship To P2 Pure Core

F2 motivates these P2 pure core concepts:

- priority lanes;
- scheduler-policy;
- worker-side transaction model;
- bounded projection;
- same-clock metrics / decision trace;
- fail-closed projection safety.

P2 pure core v0 is an engineering scaffold derived from F1/F2 evidence. It is not itself a final runtime implementation.

The correct claim is that F2 justifies the shape of the frozen scaffold: priority-aware transaction scheduling and bounded visible projection. It does not prove that the scaffold is production-ready or that every P2 module is experimentally proven.

## Figure / Table Draft

Figure: "Monolithic Worker vs Scheduled Worker"

```text
F2-A:
heavy transaction runs as one Worker unit
-> urgent projection waits

F2-B:
heavy transaction chunks/yields
-> urgent projection admitted between chunks
-> lower urgent latency
```

Tables:

- Main result table from "Main Result".
- Paired delta table from "Paired Deltas".

## Safe Claim Language

Safe wording:

"In the controlled F2 workload, scheduled Worker transaction processing reduces same-clock urgent projection acknowledgement and projection-commit latency relative to monolithic Worker execution, while preserving equivalent structural work. This is scheduler-positive evidence, not product trace replay, not total throughput improvement, and not final runtime success."

Unsafe claims to avoid:

- "F2 proves the final runtime works."
- "F2 proves scheduled Workers are always faster."
- "F2 proves user-visible pixel latency is 3ms."
- "F2 proves ChatGPT can be fixed by Worker scheduling alone."
- "F2 proves Canvas/WebGPU is needed."

## Final Recommendation

The next paper section should be Runtime Design Implications / Frozen P2 Pure Core, because F0-D/F1/F2 now motivate why the runtime direction uses worker-resident state, transaction scheduling, and bounded projection.
