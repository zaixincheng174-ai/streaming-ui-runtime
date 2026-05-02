# P5-L Post-K1 B2c/R0c Mechanism Update

## 1. Purpose

This document updates the B2c/R0c mechanism interpretation after R0c scroll projection batching and a B2c rerun. It is not a new measurement run, not browser-level INP evidence, not frame-stability evidence, not production readiness evidence, and not P4 authorization.

## 2. Source Results

| source | file | role |
| --- | --- | --- |
| B2c latest result JSON | `bench/p5/results/p5i_b2_compact_context_results.json` | latest compact virtualized DOM rerun |
| R0c K1 latest result JSON | `bench/p5/results/p5i_r0_compact_context_results.json` | R0c compact-context result after scroll projection batching |
| prior P5-J summary | `bench/p5/results/p5j_b2_r0_b2c_r0c_mechanism_summary.json` | pre-K1 mechanism-aware B2/R0/B2c/R0c summary |
| prior P5-H summary | `bench/p5/results/p5h_b0_b1_b2_r0_comparison_summary.json` | baseline gradient context |

## 3. Updated Primary Claim

- R0c K1 preserves the send-path-specific advantage over B2c: `15.8ms` vs `20.4ms`.
- R0c K1 removes the prior scroll-proxy disadvantage and reaches B2c-level scroll parity: `12.2ms` vs `11.7ms`.
- R0c K1 still does not dominate B2c overall because initial render and typing proxy remain worse.
- Current evidence supports continued workload-axis investigation, not P4 authorization.

Do not read this as R0c beating B2c overall, proving impossible-zone success, or authorizing P4. For scroll, the correct label is parity, not victory.

## 4. Updated Metric Table

| metric | B2c latest | R0c K1 |
| --- | ---: | ---: |
| max_initial_render_ms | 4.0 | 80.9 |
| max_send_click_proxy_ms | 20.4 | 15.8 |
| max_scroll_jump_return_ms | 11.7 | 12.2 |
| max_typing_proxy_ms | 0.2 | 1.4 |
| max_long_task_like_count_50ms_proxy | 0 | 1 |
| max_long_task_like_count_100ms_proxy | 0 | 0 |
| max_long_task_like_count_200ms_proxy | 0 | 0 |
| max_rendered_dom_node_count | 5700 | 5700 |
| max_logical_block_count | 54096 | 54096 |
| max_send_active_context_entries_visited | 100000 | 100000 |
| active_context_scan_modes | compact_checksum_index | compact_checksum_index |
| dynamic_active_context_update_modes | static_initial_active_context | static_initial_active_context |
| max_scroll_batched_worker_roundtrip_ms | n/a | 1.2 |
| max_scroll_batched_worker_processing_ms | n/a | 0.4 |
| max_scroll_batched_roundtrip_minus_processing_ms | n/a | 0.9 |
| max_scroll_batched_main_commit_ms | n/a | 10.7 |
| scroll_batch_modes | n/a | old_and_tail_single_worker_message |

## 5. Ratio / Delta Summary

| comparison | value | interpretation |
| --- | ---: | --- |
| B2c send / R0c K1 send | 1.291x | R0c K1 retains a modest send-path advantage |
| R0c K1 send improvement percent over B2c | 22.5% | send-specific positive signal |
| B2c scroll / R0c K1 scroll | 0.959x | parity, not R0c victory |
| R0c K1 scroll delta vs B2c | +0.5ms | parity-level difference in this proxy |
| B2c typing / R0c K1 typing | 0.143x | R0c typing remains slower, but absolute overhead is small |
| B2c initial / R0c K1 initial | 0.049x | R0c initial remains a startup/accounting caveat |
| B2c rendered nodes / R0c rendered nodes | 1.0x | both mount the same bounded DOM count |

## 6. Mechanism Interpretation

Compact active-context indexing removed the shared send-path full-string scan bottleneck. R0c's send-path advantage after shared optimization remains, but it is modest and send-specific.

K1 scroll batching removed R0c's previous serial two-roundtrip scroll disadvantage by returning old-history and tail projections in one Worker response. The main thread still commits old-history and then tail sequentially. After K1, scroll is approximately at B2c parity.

R0c still has startup/accounting overhead and small absolute typing Worker-dispatch overhead. Those caveats prevent any all-interaction dominance claim.

## 7. Overhead Classification After K1

| metric | B2c | R0c_K1 | status | interpretation | risk |
| --- | ---: | ---: | --- | --- | --- |
| send_click_proxy_ms | 20.4 | 15.8 | R0c_K1 positive signal | R0c K1 is modestly faster on the send-click proxy after shared compact-index optimization. | Send-path-specific only; does not imply all-interaction dominance. |
| scroll_jump_return_ms | 11.7 | 12.2 | parity after batching | K1 batching removes the prior R0c scroll-proxy disadvantage. | Scroll proxy is not browser frame-stability evidence. |
| typing_proxy_ms | 0.2 | 1.4 | small absolute overhead | R0c K1 remains worse on typing proxy, but the absolute value is small and single-shot. | Prevents all-interaction dominance claims. |
| initial_render_ms | 4.0 | 80.9 | startup/accounting caveat | R0c K1 remains substantially slower on initial render. | Not cleanly comparable to B2c initial render and not proven amortizable. |
| long_task_like_50ms_proxy | 0 | 1 | internal proxy only | R0c K1 has one internal 50ms-like proxy count while B2c has zero. | Not browser Long Task API evidence. |

## 8. What This Supports

- Paired compact-index design removed the R0-only algorithmic optimization confound.
- R0c has a send-path-specific positive signal after shared bottleneck removal.
- R0c K1 reaches scroll-proxy parity by batching old-history/tail projection requests.
- B2c remains a very strong baseline.
- Further progress should focus on workload-axis refinement or targeted R0c overhead diagnostics, not P4.

## 9. What This Does Not Prove

- R0c overall dominance over B2c.
- Browser-level INP.
- Frame stability.
- Production readiness.
- Dynamic active-context performance.
- Impossible-zone completion.
- P4 eligibility.
- WebGPU or Canvas necessity.

## 10. Recommended Next Step

Recommended: P5-M workload-axis refinement focused on concurrent input during worker-side work, dynamic active-context update, and multi-stream / agent trace workload.

Reason: send and scroll are now in a good range. More micro-optimizing initial render or single-shot typing is likely less valuable than testing a workload where worker-resident runtime should have clearer architectural value.

Alternative: run an R0c startup/typing overhead diagnostic only if the project wants to make all-interaction dominance a claim.

## 11. Final Classification

| field | value |
| --- | --- |
| p5_status | post_k1_mechanism_update_complete |
| b2c_status | strong_compact_virtualized_dom_baseline |
| r0c_status | send_path_advantage_and_scroll_parity_with_non_send_caveats |
| send_status | r0c_k1_modest_advantage |
| scroll_status | parity_after_batching |
| typing_status | small_absolute_worker_dispatch_overhead_single_shot |
| initial_status | startup_accounting_caveat |
| p4_status | not_authorized |
| recommended_next | workload_axis_refinement_before_p4 |
