
# P0 Status and P0-E Matrix Result

Date: 2026-04-24
Project: Streaming UI Runtime for Long-Lived AI Surfaces
Stage: P0 profiling / attribution / controlled workload design

## 0. Executive Summary

P0 is no longer an empty or purely negative phase.

The current evidence now supports a more precise staged conclusion:

1. Private-product traces show a long-session send-path problem dominated by scripting / microtask / flush-like processing, not rendering.
2. Turn count alone is not a sufficient explanatory variable. The stronger private-product model is accumulated output / surface mass plus message or block boundary structure, with richness / real-work state acting as an amplifier.
3. The first repo-owned controlled target family, steady append, is boundary-sensitive but does not reproduce burst-like long tasks, even after ultra-boundary escalation.
4. A second repo-owned controlled family, click-triggered batch commit, successfully reproduces burst-like long tasks.
5. In the P0-E matrix, neither high block count alone nor high text mass alone creates a long task. The high-boundary × high-mass cell is the only condition that produces a >50ms tail burst, and this behavior was reproduced in an independent E4 repeat.

The strongest current controlled insight is:

> Click-triggered send-path burst risk emerges from the interaction of high boundary count and high text mass, not from either axis alone.

This remains a P0 controlled-workload result, not a final proof of generic DOM / VDOM architectural mismatch.

---

## 1. Evidence Boundary

P0 operates with two evidence tracks:

### Private Product Trace Attribution

Private product traces are useful for mechanism narrowing. They can show likely cost families such as:

* async flush / microtask chains
* framework commit traversal
* telemetry / replay / queue overhead
* scripting-heavy send-path processing

They must not be treated as direct proof of a generic DOM / VDOM bottleneck.

### Controlled Baseline Proof

Repo-owned controlled targets are required for architecture-level claims.

The main purpose of P0-D and P0-E is to translate private-product observations into controlled workloads and determine which workload shape produces comparable burden.

---

## 2. Private Product Trace Results

### 2.1 Send-path baseline and growth points

These runs were collected manually from private product traces in Chrome DevTools.

Primary interpretation fields:

* `click_ms`
* `microtasks_ms`
* `scripting_ms`
* `rendering_ms`
* `inp_ms`
* `processing_ms`

`long_task_total_ms` is retained for reference only because it may represent a recording-window max task rather than the send-adjacent task.

| Run          | Turns | Class                | click_ms | microtasks_ms | scripting_ms | rendering_ms | INP | input_delay | processing | presentation | long_task_total | Notes                                                 |
| ------------ | ----: | -------------------- | -------: | ------------: | -----------: | -----------: | --: | ----------: | ---------: | -----------: | --------------: | ----------------------------------------------------- |
| B0           |     0 | new / empty          |    44.43 |           n/a |           36 |            1 |  96 |          13 |         45 |           38 |          372.95 | New conversation, 0 history. Microtasks not verified. |
| B1           |    21 | light / desktop2     |   122.08 |        116.07 |           93 |           14 | 179 |          13 |        122 |           43 |          137.32 | 21 history turns.                                     |
| B2           |    40 | short                |   157.93 |        149.41 |          138 |           14 | 229 |          13 |        158 |           57 |          172.48 | 40 short history turns.                               |
| 41-rich      |    41 | rich medium, no code |   257.07 |        244.62 |          204 |           16 | 329 |          14 |        257 |           58 |          274.41 | Deep learning / preprocessing style task.             |
| 60-short     |    60 | short                |   211.27 |        199.96 |          183 |           18 | 296 |          14 |        211 |           70 |          232.89 | Daily light task.                                     |
| 58-rich-real |    58 | rich-real            |   455.47 |        427.56 |          381 |           28 | 529 |          15 |        456 |           58 |          482.68 | Real project / pricing discussion.                    |
| 80-short     |    80 | short                |   282.69 |        266.23 |          249 |           23 | 379 |          14 |        283 |           82 |          313.46 | Daily light task.                                     |
| 100-short    |   100 | short                |   428.37 |        405.97 |          354 |           27 | 512 |          14 |        429 |           70 |          458.52 | Daily light task.                                     |
| B3           |   100 | heavy-project        |   622.46 |        573.46 |          543 |           32 | 712 |          13 |        623 |           76 |          654.20 | Heavy real project window.                            |

### 2.2 Private-product observations

The private-product track supports the following working observations:

1. The dominant send-path cost is processing / scripting / microtask-heavy.
2. Rendering grows only modestly compared with scripting.
3. Input delay remains nearly constant around 13–15ms across the observed runs.
4. Turn count is only a coarse proxy.
5. The stronger explanatory variable is accumulated rendered output / surface mass plus message or block boundary structure.
6. Richness, code, and real-work project state act as amplifiers.
7. Heavy real-work sessions enter a much heavier regime than short synthetic or daily-light sessions.

### 2.3 Private-product attribution status

Current best attribution:

* Dominant family: app-side async microtask / flush-like processing
* Secondary family: framework commit traversal
* Not primary: rendering / paint / input delay

This track remains private-product attribution and cannot be used alone as architecture-level proof.

---

## 3. Fresh Synthetic Sequence Probe

Synthetic number-sequence probes were used to test whether total text mass alone can explain processing growth.

| Run | Structure           | click_ms | microtasks_ms | scripting_ms | rendering_ms | INP | input_delay | processing | presentation | long_task_total | Notes                       |
| --- | ------------------- | -------: | ------------: | -----------: | -----------: | --: | ----------: | ---------: | -----------: | --------------: | --------------------------- |
| A1  | 1 large sequence    |    31.83 |         29.25 |           28 |            3 |  79 |          14 |         32 |           33 |           35.89 | Number sequence 1 to 500.   |
| A2  | 10 medium sequences |    51.65 |         48.52 |           42 |            6 | 112 |          14 |         52 |           46 |           57.96 | Count 1 to 100 repeated.    |
| A3  | 50 small sequences  |   167.55 |        157.34 |          149 |           15 | 229 |          14 |        168 |           47 |          182.34 | 50 turns, each count to 20. |

### Synthetic-probe interpretation

A1/A2/A3 are useful as mechanism probes, but not as real-workload substitutes.

They support a weak but important conclusion:

> Total text mass alone does not fully explain processing growth. A second factor related to turn count / message boundary / repeated prompt structure is likely present.

They do not establish precise coefficients such as ms/turn or ms/token. The token counts are estimated and the workload is highly synthetic.

---

## 4. Controlled Local First Pass

The prior controlled-local run used the older controlled append surface.

Session:

`/tmp/streaming-ui-runtime-p0/controlled-local-20260422T191230Z`

Target:

`controlled-append-surface`

Each scenario had 5 valid measured runs.

| Scenario               | p95 ms | max ms | busy % | long tasks >50ms | layout events | paint events |
| ---------------------- | -----: | -----: | -----: | ---------------: | ------------: | -----------: |
| s01_tail_append        | 29.865 | 81.001 | 33.780 |                1 |           750 |            0 |
| s02_append_scrollback  | 15.854 | 38.216 | 17.427 |                0 |           750 |            0 |
| s03_scroll_jump_resume | 15.005 | 37.324 | 16.358 |                0 |           758 |           22 |

Interpretation:

* The target was non-idle.
* It was still modest.
* Formal recommendation at that time remained: stay in P0.

---

## 5. P0-D Controlled Target v2: Steady Append Matrix

P0-D introduced controlled target v2 with mass and boundary knobs:

* `seed_blocks`
* `chars_per_block`
* `append_interval_ms`
* `block_style`

### 5.1 Initial 3-run directional matrix

| Cell | Mass | Boundary | p95 ms | max ms | busy % | long tasks | layout | paint |
| ---- | ---- | -------- | -----: | -----: | -----: | ---------: | -----: | ----: |
| C1   | low  | low      | 10.354 | 25.924 | 12.041 |          0 |    750 |     0 |
| C2   | high | low      | 10.375 | 30.122 | 11.501 |          0 |    750 |     0 |
| C3   | low  | high     | 20.856 | 52.922 | 22.777 |          1 |    750 |     0 |
| C4   | high | high     | 18.956 | 54.643 | 21.559 |          3 |    750 |     0 |

Initial interpretation:

* Boundary appeared stronger than mass.
* C3/C4 showed directional pressure.
* The result required 5-run confirmation.

### 5.2 Final 5-run P0-D gate

| Cell | Mass | Boundary | p95 ms | max ms | busy % | long tasks | layout | paint |
| ---- | ---- | -------- | -----: | -----: | -----: | ---------: | -----: | ----: |
| C1   | low  | low      |  6.583 |  8.948 | 14.722 |          0 |   1000 |   500 |
| C2   | high | low      |  8.712 | 26.293 |  9.494 |          0 |    750 |     0 |
| C3   | low  | high     | 17.014 | 41.100 | 22.741 |          0 |    750 |     2 |
| C4   | high | high     | 12.126 | 13.566 | 23.638 |          0 |   1250 |   500 |

5-run interpretation:

* Boundary still increased p95 and busy percentage.
* Mass alone was weak.
* No cell produced stable >50ms long tasks.
* P0-D showed boundary sensitivity but not burst reproduction.

### 5.3 C5 ultra-boundary smoke

C5:

* `seed_blocks = 5000`
* `chars_per_block = 40`
* `measured_runs = 5`

| Cell                       | p95 ms | max ms | busy % | long tasks | layout | paint |
| -------------------------- | -----: | -----: | -----: | ---------: | -----: | ----: |
| C5_ultra_boundary_low_mass | 12.029 | 15.790 | 23.427 |          0 |   1250 |   500 |

C5 interpretation:

> Even 5000 plain seed blocks did not create burst-like long tasks under steady append.

Conclusion:

> Steady append is not the right workload shape to reproduce the private-product send-path burst.

---

## 6. P0-E Click-Triggered Batch Commit

P0-E introduced a separate controlled target:

`bench/p0/targets/controlled_batch_commit_surface.html`

P0-E workload shape:

* pre-generate blocks
* listen for capture start
* programmatically click a visible button once per capture
* run deterministic batch traversal / mutation
* emit marks:

  * `p0e:click:capture-N`
  * `p0e:batch:start:capture-N`
  * `p0e:batch:end:capture-N`

This target better matches the private-product pattern:

`send/click -> microtask / batch / flush -> processing burst`

### 6.1 High-high smoke, after re-arm fix

High-high smoke:

* `block_count = 10000`
* `chars_per_block = 800`
* `operation_type = dom-text-scan`
* `microtask_mode = true`
* `mutation_mode = data-attribute-update`

| Run                  | valid runs | p95 ms | max ms | busy % | long tasks | layout | paint | mark check |
| -------------------- | ---------: | -----: | -----: | -----: | ---------: | -----: | ----: | ---------- |
| P0-E high-high smoke |          5 | 74.706 | 85.848 |  1.257 |          1 |      1 |     2 | PASS       |

Interpretation:

> P0-E high-high smoke passed the burst gate.

### 6.2 P0-E E1–E4 matrix

| Cell                       | block_count | chars/block | p95 ms | max ms | busy % | long tasks | layout | paint | mark check |
| -------------------------- | ----------: | ----------: | -----: | -----: | -----: | ---------: | -----: | ----: | ---------- |
| E1 low/low                 |        1000 |          80 |  3.870 |  3.870 |  0.050 |          0 |      0 |     0 | PASS       |
| E2 high-blocks / low-chars |       10000 |          80 | 28.168 | 29.546 |  0.394 |          0 |      0 |     0 | PASS       |
| E3 low-blocks / high-chars |        1000 |         800 | 18.137 | 18.137 |  0.238 |          0 |      0 |     0 | PASS       |
| E4 high/high               |       10000 |         800 | 24.684 | 97.724 |  1.238 |          1 |      1 |     2 | PASS       |

Matrix interpretation:

* E1 is a clean low baseline.
* E2 shows boundary alone increases cost but does not produce a long task.
* E3 shows mass alone increases cost but does not produce a long task.
* E4 is the only cell that produces a >50ms long task.
* The burst signal emerges from the interaction of high boundary and high mass.

### 6.3 E4 repeat

E4 repeat:

| Run       | valid runs | p95 ms | max ms | busy % | long tasks | layout | paint | mark check |
| --------- | ---------: | -----: | -----: | -----: | ---------: | -----: | ----: | ---------- |
| E4 repeat |          5 | 65.095 | 97.526 |  1.501 |          1 |      1 |     2 | PASS       |

Repeat interpretation:

> E4 tail burst reproduced in an independent 5-run session. This makes the E4 signal more than a one-off spike.

### 6.4 E4 internal breakdown

After the E4 matrix result and E4 repeat, both sessions were analyzed at the trace-event level to determine whether the burst was rendering-dominant or microtask/scripting-dominant.

| Session | max p0eWindow ms | max RunTask ms | max RunMicrotasks ms | avg microtask share | rendering approx |
|---|---:|---:|---:|---:|---:|
| E4 matrix | 98.328 | 98.587 | 98.284 | 0.999 | 0 |
| E4 repeat | 100.666 | 100.915 | 100.635 | 1.000 | 0 |

Representative heavy windows:

- E4 matrix `measure-01`: `RunTask = 97.724ms`, `RunMicrotasks = 97.350ms`, `microtaskShareOfWindow = 0.999`, `renderingNamedSumMs ≈ 0`.
- E4 matrix `measure-05`: `RunTask = 98.587ms`, `RunMicrotasks = 98.284ms`, `microtaskShareOfWindow = 1.000`, `renderingNamedSumMs ≈ 0`.
- E4 repeat `measure-03`: `RunTask = 100.915ms`, `RunMicrotasks = 100.635ms`, `microtaskShareOfWindow = 1.000`, `renderingNamedSumMs ≈ 0`.
- E4 repeat `measure-04`: `RunTask = 97.526ms`, `RunMicrotasks = 97.210ms`, `microtaskShareOfWindow = 1.000`, `renderingNamedSumMs ≈ 0`.
- E4 repeat `measure-05`: `RunTask = 96.854ms`, `RunMicrotasks = 96.553ms`, `microtaskShareOfWindow = 1.000`, `renderingNamedSumMs ≈ 0`.

Interpretation:

> The E4 burst is not rendering-dominant. It is a click-triggered, microtask-dominant scripting burst.

This materially strengthens the P0-E result. The high-boundary × high-mass controlled cell does not merely cross the long-task threshold; it does so through a workload shape that is structurally aligned with the private-product send-path traces, where the dominant long task also occurs under a microtask / flush-like processing chain.

Caveat:

> P0-E reproduces the workload shape, not the exact private-product implementation.

Therefore, the safe upgraded claim is:

> P0-E provides a repo-owned controlled reproduction of click-triggered, microtask-dominant burst behavior over a large segmented text surface.


### 6.5 E4 read-only sensitivity and breakdown

After the data-attribute-update E4 result and E4 repeat, a final operation-sensitivity check was run with the same high-boundary × high-mass parameters but with `mutation_mode=read-only`.

Parameters:

- `block_count = 10000`
- `chars_per_block = 800`
- `operation_type = dom-text-scan`
- `microtask_mode = true`
- `mutation_mode = read-only`
- `measured_runs = 5`

Summary:

| Run | mutation_mode | p95 ms | max ms | busy % | long tasks | layout | paint | mark check |
|---|---|---:|---:|---:|---:|---:|---:|---|
| E4 read-only | read-only | 64.385 | 71.930 | 1.220 | 1 | 1 | 2 | PASS |

Trace-level breakdown:

| Session | max p0eWindow ms | max RunTask ms | max RunMicrotasks ms | avg microtask share | rendering approx |
|---|---:|---:|---:|---:|---:|
| E4 read-only | 95.795 | 96.227 | 95.743 | 0.999 | 0 |

Representative read-only windows:

- `measure-03`: `RunTask = 79.301ms`, `RunMicrotasks = 79.101ms`, `microtaskShareOfWindow = 1.000`, `renderingNamedSumMs ≈ 0`.
- `measure-04`: `RunTask = 71.930ms`, `RunMicrotasks = 70.874ms`, `microtaskShareOfWindow = 0.999`, `renderingNamedSumMs ≈ 0`.
- `measure-05`: `RunTask = 96.227ms`, `RunMicrotasks = 95.743ms`, `microtaskShareOfWindow = 0.999`, `renderingNamedSumMs ≈ 0`.

Interpretation:

> The P0-E burst does not require DOM mutation.

The read-only run still produced a >50ms long task and remained microtask-dominant. Therefore, the current best interpretation is:

> Traversal / text scan over a high-boundary × high-mass surface is sufficient to create a click-triggered, microtask-dominant burst. Mutation or write bookkeeping may increase tail magnitude, but it is not required for crossing the long-task threshold.

Caveat:

> This narrows away from data-attribute mutation as the sole cause, but it still does not prove that the private product uses the exact same implementation. P0-E reproduces the workload shape.


---

## 7. Cross-Phase Synthesis

### Finding 1: Private-product send-path is processing-heavy

Across private-product traces, input delay is stable while processing / scripting / microtask time grows sharply.

### Finding 2: Turn count alone is insufficient

Short, rich, and heavy-real sessions show that turn count is only a rough proxy. Accumulated output / surface mass and boundary structure are better explanatory variables.

### Finding 3: Steady append is not sufficient

P0-D steady append is boundary-sensitive, but it cannot reproduce the burst-like long tasks seen in private-product send-path traces.

### Finding 4: Click-triggered batch commit is the correct controlled workload family

P0-E high-high and E4 repeat both generate >50ms burst-like long tasks.

### Finding 5: Boundary and mass interact

The P0-E matrix shows that high boundary alone and high mass alone are subcritical. Only high boundary × high mass produces long-task tail risk.

Current best controlled model:

> Burst risk arises when click-triggered batch processing operates over a large and highly segmented text surface.

---

## 8. What We Can Say Now

Safe claims:

1. P0 has produced a clear private-product attribution boundary.
2. Private-product send-path lag is scripting / microtask / processing heavy.
3. Controlled steady append does not reproduce the burst phenomenon.
4. Controlled click-triggered batch commit does reproduce burst-like long tasks.
5. In the P0-E matrix, only high boundary × high mass produces >50ms tail bursts.
6. The P0-E high/high effect was reproduced in a second independent E4 run.

---

## 9. What We Cannot Say Yet

Do not claim:

1. P0 is fully closed.
2. DOM / VDOM mismatch is conclusively proven.
3. The product’s internal mechanism is exactly the P0-E DOM batch implementation.
4. The measured coefficients are universal.
5. P0-E explains all forms of long-session UI degradation.
6. Native pointer input dispatch was measured. P0-E uses programmatic click to measure post-click batch processing.

---

## 10. Current Stage Assessment

P0 status:

> P0 has moved from negative / unclear to controlled positive on a narrower workload shape.

P0-D result:

> Boundary-sensitive but not burst-positive.

P0-E result:

> Burst-positive under high-boundary × high-mass click-triggered batch.

Current recommendation:

> Stay in P0 for result consolidation and one more sensitivity check, but P0 now has enough controlled signal to justify moving toward P1 strong baselines after documentation and verification.

---

## 11. Recommended Next Steps

### Step 1: Commit current P0 docs and target changes

The current state should be committed before further experimentation.

### Step 2: Add operation sensitivity for E4

Run E4 with one alternative mutation / operation mode.

Candidates:

* `mutation_mode=class-toggle`
* `operation_type=layout-read-write` if implemented later

Goal:

> Determine whether the burst is specific to data-attribute-update or general to batch traversal / mutation.

### Step 3: Record a final P0 gate note

Add a short `docs/p0/p0-current-gate-note.md` after operation sensitivity.

### Step 4: Prepare P1 scope

P1 should not begin with runtime implementation. It should begin with strong baselines.

Recommended P1 baselines:

* naive DOM
* optimized DOM
* virtualization
* editor-grade baseline if feasible

---

## 12. One-Sentence Current Conclusion

P0 now shows that the relevant controlled workload is not steady append, but click-triggered batch processing over a large segmented text surface; burst-like long tasks appear only when boundary count and text mass are both high.

