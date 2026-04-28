# Figure 4: F2 Monolithic vs Scheduled Worker Timeline v0

## Purpose

This figure explains why F2-B scheduled Worker execution reduces urgent projection-commit latency even though total Worker heavy transaction time is higher.

## Core Message

F2-B is not a throughput win. It is a responsiveness win:

- F2-A runs heavy Worker work monolithically, so urgent projection waits.
- F2-B splits heavy work into chunks/yields, so urgent projection can be admitted between chunks.
- Scheduled execution trades Worker-side total time for lower urgent projection latency.

## Data To Annotate

F2-A Monolithic:

- urgent_main_ack_latency_ms mean ≈ 20.933ms
- urgent_end_to_end_visible_ms mean ≈ 22.867ms
- worker_heavy_txn_total_ms mean ≈ 26.8ms
- worker_chunk_count = 1
- worker_yield_count = 0
- worker_preemptions = 0

F2-B Scheduled:

- urgent_main_ack_latency_ms mean ≈ 0.900ms
- urgent_end_to_end_visible_ms mean ≈ 3.333ms
- worker_heavy_txn_total_ms mean ≈ 48.533ms
- worker_chunk_count = 313
- worker_yield_count = 312
- worker_preemptions = 1

## ASCII Draft

```text
Panel A: F2-A Monolithic Worker

time --------------------------------------------------------------->

Main thread:
  send heavy txn
       |
       |---------------------- send urgent projection -------------|
       |                                                           |
       |                                                           v
       |                                             receive urgent projection
       |                                             projection-commit ≈ 22.867ms
       |                                             urgent ack ≈ 20.933ms

Worker:
       |===========================================================|
       |           one monolithic heavy transaction                |
       |              heavy worker total ≈ 26.8ms                  |
       |===========================================================|
                                ^
                                |
                     urgent projection waits
                     behind heavy work

Annotations:
  worker_chunk_count = 1
  worker_yield_count = 0
  worker_preemptions = 0
```

```text
Panel B: F2-B Scheduled Worker

time ------------------------------------------------------------------------------->

Main thread:
  send heavy txn
       |
       |------------- send urgent projection ----|
       |                                         v
       |                          receive urgent projection
       |                          projection-commit ≈ 3.333ms
       |                          urgent ack ≈ 0.900ms

Worker:
       |====|  |====|  |====|  |====|  |====|  ...  |====|  |====|
       chunk  yield  chunk  yield  chunk  yield     chunk  yield
          1            2            3                  313
                         ^
                         |
              urgent projection admitted
              between chunks
              1 preemption

       heavy work continues after urgent projection
       heavy worker total ≈ 48.533ms

Annotations:
  worker_chunk_count = 313
  worker_yield_count = 312
  worker_preemptions = 1
```

## Caption

Figure 4. F2 compares monolithic Worker execution with scheduled/chunked Worker execution. F2-B increases total Worker heavy transaction time due to chunk/yield overhead, but it admits urgent projection work between chunks, reducing same-clock urgent acknowledgement and projection-commit latency. The result is a responsiveness tradeoff, not a throughput improvement.

## Placement In Paper

Place this figure in Section 6: Worker-side Scheduling, before or immediately after the main F2 result table.

## Claim Boundaries

- Not proof scheduled Worker is always faster.
- Not full display-pipeline latency.
- Not product trace replay.
- Not multi-urgent stress.
- Not final runtime success.

## What This Figure Should Not Show

- No DOM/React claims.
- No Canvas/WebGPU claims.
- No product source internals.
- No user-perceived pixel latency.
- No claim that Worker total time improves.

## Final Recommendation

After this figure spec, the next paper task should be to patch the assembled short-paper draft with a reference to Figure 4, or create an actual rendered diagram later.
