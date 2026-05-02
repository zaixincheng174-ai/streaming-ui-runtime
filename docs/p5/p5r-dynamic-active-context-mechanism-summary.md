# P5-R Dynamic Active-Context Mechanism Summary

## 1. Purpose

This summarizes P5-Q dynamic active-context results. It is not a new benchmark, not browser-level INP, not frame-stability evidence, not production readiness, and not P4 authorization.

## 2. Source Results

| source | file |
| --- | --- |
| B2q dynamic active-context result | `bench/p5/results/p5q_b2c_dynamic_context_results.json` |
| R0q dynamic active-context result | `bench/p5/results/p5q_r0c_dynamic_context_results.json` |
| Prior scheduling mechanism context | `docs/p5/p5p-send-start-commit-window-mechanism-summary.md` |

## 3. Primary Claim

P5-Q validates the dynamic active-context workload axis. Both B2q and R0q preserve rolling-tail active-context semantics, final logical block count, and bounded rendered DOM. R0q shows only a small end-to-end proxy advantage over B2q, while moving dynamic active-context update work into Worker. The main finding is bottleneck localization, not R0q dominance.

## 4. Metric Table

| metric | B2q | R0q |
| --- | ---: | ---: |
| max_dynamic_context_send_proxy_ms | 57.3 | 54.0 |
| max_send_click_proxy_ms | 57.3 | 54.0 |
| max_dynamic_active_context_update_ms | 28.5 | 30.8 |
| max_dynamic_active_context_rebuild_ms | 28.5 | 30.8 |
| max_send_active_context_entries_visited | 100000 | 100000 |
| max_active_context_update_count | 3 | 3 |
| max_active_context_generation_count | 4 | 4 |
| max_active_context_entries_added | 4096 | 4096 |
| max_active_context_entries_removed | 4096 | 4096 |
| max_logical_block_count | 54096 | 54096 |
| max_expected_final_logical_block_count | 54096 | 54096 |
| max_rendered_dom_node_count | 5700 | 5700 |
| max_send_worker_processing_ms | n/a | 48.9 |
| max_send_worker_active_context_traversal_ms | n/a | 1.7 |
| max_send_worker_dynamic_active_context_update_ms | n/a | 30.8 |
| max_send_worker_roundtrip_minus_processing_ms | n/a | 0.8 |
| max_send_main_commit_ms | n/a | 4.6 |

## 5. Dynamic Context Semantics

Active context starts as the initial tail window. Each repeat scans the current active context, then tail mutation and append happen, then the active context is rebuilt to the latest rolling tail window.

The expected final logical block count equals `visible_block_count + append_batch_size * send_click_repeat_count`. Both B2q and R0q satisfy this invariant: the max final logical block count and max expected final logical block count are both `54096`.

## 6. Mechanism Interpretation

B2q performs dynamic active-context update on the main thread. R0q performs dynamic active-context update in Worker.

Dynamic update is now a major cost in both systems. B2q records `28.5ms` max dynamic active-context update time, while R0q records `30.8ms`. R0q does not make update cost disappear. R0q's value is potential main-thread isolation, not raw update elimination.

Current P5-Q does not measure input availability during dynamic update. That means the mechanism signal is about cost location and workload realism, not input responsiveness under this dynamic-update phase.

## 7. Fairness / Invariants

- Same P5-D matrix.
- Same `active_context_window`.
- Same `send_click_repeat_count`.
- Same entries visited: `100000`.
- Same final logical block count: `54096`.
- Same rendered DOM node count: `5700`.
- Same entries added / removed: `4096` in the max scenario.
- Same update count: `3`.
- Same generation count: `4`.
- Same active-context scan mode: `compact_checksum_index`.
- Same dynamic update mode: `rolling_tail_window_after_append`.

## 8. Optimization Implications

Shared algorithmic optimizations available to both B2q and R0q:

- rolling ring-buffer active context
- incremental compact-index update
- dirty-range update
- segmented active-context index
- aggregate checksum / chunk summaries

Architecture-specific R0 direction:

- worker-side dynamic context maintenance
- transaction scheduling
- double-buffer active-context snapshots
- chunked/yieldable worker update
- bounded main-thread commit

Algorithmic optimizations must be paired if used for comparison. Architecture-specific value should be tested through input availability during dynamic update.

## 9. What This Supports

- Dynamic active-context is a real new workload axis.
- Rolling context update is a material cost.
- R0q moves this cost into Worker.
- Next test should examine input availability while dynamic update runs.

## 10. What This Does Not Prove

- R0q dominance.
- Browser-level INP.
- Frame stability.
- Production readiness.
- Dynamic update advantage in input responsiveness.
- Impossible-zone completion.
- P4 eligibility.

## 11. Recommended Next Step

Recommend P5-S: concurrent input during dynamic active-context update.

P5-Q shows dynamic update cost exists. The next question is whether R0q's Worker ownership keeps the main thread responsive while that dynamic update work runs.

## 12. Final Classification

| field | value |
| --- | --- |
| p5_status | dynamic_active_context_axis_validated |
| primary_bottleneck | rolling_tail_active_context_rebuild |
| b2q_status | dynamic_context_update_on_main_thread |
| r0q_status | dynamic_context_update_in_worker_with_small_total_proxy_advantage |
| r0q_caveat | not_raw_dominance_over_b2q |
| p4_status | not_authorized |
| recommended_next | concurrent_input_during_dynamic_context_update |
