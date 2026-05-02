# P5-H2 B0/B1/B2/R0 Technical Comparison Summary

## 1. Purpose

This document summarizes the P5-H2 technical comparison across B0, B1, B2, and corrected R0 using existing P5 result JSON files only. It is not a new measurement run, not browser-level INP evidence, not frame-stability evidence, and not P4 authorization.

## 2. Source Results

| variant | source result | role |
| --- | --- | --- |
| B0 | `bench/p5/results/p5d_b0_stress_calibration_results.json` | naive DOM stress baseline |
| B1 | `bench/p5/results/p5e_b1_optimized_dom_stress_results.json` | optimized/batched DOM stress baseline |
| B2 | `bench/p5/results/p5f_b2_virtualized_dom_stress_results.json` | virtualized DOM stress baseline |
| R0 | `bench/p5/results/p5g_r0_p3_runtime_stress_results.json` | P3-derived worker/bounded-projection runtime path |

## 3. Max Metric Table

| variant | max initial render ms | max send-click proxy ms | max scroll-return proxy ms | max typing proxy ms | long-task-like 50ms | long-task-like 100ms | long-task-like 200ms | max DOM nodes | max logical blocks | max rendered DOM nodes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B0 | 445.7 | 14932.5 | 46.0 | 0.7 | 5 | 4 | 3 | 1029324 | n/a | n/a |
| B1 | 554.3 | 1364.3 | 40.5 | 3.2 | 4 | 4 | 4 | 1029324 | n/a | n/a |
| B2 | 3.7 | 161.8 | 13.3 | 0.4 | 2 | 2 | 0 | 5700 | 54096 | 5700 |
| R0 | 59.9 | 146.9 | 49.4 | 1.2 | 3 | 2 | 0 | 5700 | 54096 | 5700 |

## 4. R0 Phase Metrics

| R0 metric | max value |
| --- | ---: |
| send end-to-end ms | 146.9 |
| send worker processing ms | 141.2 |
| send worker active-context traversal ms | 136.4 |
| send worker tail mutation ms | 3.6 |
| send worker append ms | 3.6 |
| send worker projection ms | 0.1 |
| send main commit ms | 6.3 |
| max phase worker processing ms | 141.2 |
| max phase main commit ms | 9.5 |

R0 worker-side send processing is dominated by active-context traversal in this run: `136.4 / 141.2`, approximately 96.6%.

## 5. Ratio Summary

| ratio | value |
| --- | ---: |
| B0 send / B1 send | 10.95x |
| B1 send / B2 send | 8.43x |
| B2 send / R0 send | 1.10x |
| B0 send / R0 send | 101.65x |
| B1 send / R0 send | 9.29x |
| B0 DOM nodes / B2 rendered DOM nodes | 180.58x |
| B1 DOM nodes / B2 rendered DOM nodes | 180.58x |
| B2 rendered DOM nodes / R0 rendered DOM nodes | 1.00x |

## 6. Conservative Interpretation

B0 enters severe stress under the P5-D matrix. B1 greatly improves the worst B0 send-click cost but remains in a severe greater-than-one-second stress region. B2 is a strong virtualized DOM baseline: it removes most mounted-DOM pressure while preserving full logical transcript state.

R0 slightly improves send-click proxy latency over B2 (`146.9ms` vs `161.8ms`) and keeps send main-thread commit bounded (`6.3ms` max send main commit, `9.5ms` max phase main commit). However, R0 does not dominate B2 on initial render, scroll proxy, or long-task-like count. The corrected R0 instrumentation indicates that send worker processing is mostly active-context traversal, not projection or main-thread commit.

## 7. What This Supports

- A controlled baseline gradient now exists: B0 severe stress, B1 improved but still severe, B2 strong virtualized baseline, R0 first worker/bounded-projection result.
- DOM windowing removes most mounted-DOM pressure but does not erase all send-click/logical coordination cost.
- R0 is worth continued investigation because it slightly reduces send-click proxy latency versus B2 while bounding main-thread commit.
- The next technical work should focus on R0 optimization or workload-axis refinement before any P4 discussion.

## 8. What This Does Not Prove

- Impossible-zone success is fully proven.
- R0 dominates B2 across all metrics.
- Browser-level INP or frame stability improved.
- R0 is production-ready.
- P4 is authorized.
- WebGPU or Canvas is required.

## 9. Final Classification

| field | value |
| --- | --- |
| p5_status | baseline_gradient_plus_r0_first_result |
| b0_status | severe_stress_observed |
| b1_status | improved_but_still_severe |
| b2_status | strong_virtualized_baseline |
| r0_status | modest_send_improvement_over_b2_with_bounded_main_commit |
| r0_caveat | not_full_dominance_over_b2 |
| p4_status | not_authorized |
| recommended_next | r0_optimization_or_workload_axis_refinement_before_p4 |
