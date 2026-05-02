# P5-J B2/R0/B2c/R0c Mechanism-Aware Comparison Summary

## 1. Purpose

This is a mechanism-aware P5-J summary across B2, R0, B2c, and R0c using existing local result JSON files only. It is not a new measurement run, not browser-level INP evidence, not frame-stability evidence, and not P4 authorization.

## 2. Source Results

| variant | source result | role |
| --- | --- | --- |
| B2 | `bench/p5/results/p5f_b2_virtualized_dom_stress_results.json` | original virtualized DOM stress baseline |
| R0 | `bench/p5/results/p5g_r0_p3_runtime_stress_results.json` | original P3-derived worker/bounded-projection path |
| B2c | `bench/p5/results/p5i_b2_compact_context_results.json` | virtualized DOM plus compact active-context index |
| R0c | `bench/p5/results/p5i_r0_compact_context_results.json` | worker/bounded projection plus compact active-context index |

## 3. Primary Claim

- Paired compact-index results show that active-context full string scan was a major shared send-path bottleneck.
- Applying the same compact active-context optimization to B2 and R0 gives large send-path improvements to both.
- After equalizing this algorithmic bottleneck, R0c retains a send-click proxy advantage over B2c: 15.1ms vs 20.8ms.
- This is a send-path-specific architectural signal, not all-interaction dominance.

## 4. Measurement Definition Check

B2c `send_click_proxy_ms` is measured end-to-end from the synchronous send-click handler start through compact active-context scan, tail mutation, append, bounded DOM update, duration recording, summary publish, and return.

R0c `send_click_proxy_ms` is measured end-to-end from the async send-click handler start through `postRuntimeOp("send_click_proxy")`, Worker completion, bounded projection response, main-thread projection commit, duration recording, summary publish, and return.

Answers:

| question | answer |
| --- | --- |
| Are both end-to-end from user click handler start to completion of relevant work? | yes |
| Does R0c wait for Worker completion before stopping the timer? | yes |
| Does R0c include main commit before stopping the timer? | yes |
| Are they comparable enough for cautious send-path comparison? | yes |

Conclusion: the R0c 15.1ms vs B2c 20.8ms send-path advantage is not obviously a measurement artifact. The claim remains limited to this send-click proxy.

## 5. Mechanism Explanation for R0c Send Advantage

B2c performs compact active-context scan, tail mutation, append, and bounded DOM update on the main thread. R0c performs compact active-context scan, tail mutation, append, and bounded projection in Worker, then commits the bounded projection on the main thread.

R0c's send path likely benefits from partial separation between worker-side logical work and main-thread commit. In the R0c summary, max send worker processing is 8.1ms, max send worker active-context traversal is 2.4ms, max send worker roundtrip-minus-processing is 0.8ms, and max send main commit is 6.3ms.

However, the current harness does not measure concurrent user input during Worker work. Therefore, the full architectural benefit, main-thread availability during worker computation, is not yet measured.

## 6. Max Metric Comparison Table

| variant | max initial render ms | max send-click proxy ms | max scroll-return proxy ms | max typing proxy ms | long-task-like 50ms | long-task-like 100ms | long-task-like 200ms | max DOM nodes | max logical blocks | max rendered DOM nodes | active context scan mode | dynamic active context update mode | max send active-context entries visited |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: |
| B2 | 3.7 | 161.8 | 13.3 | 0.4 | 2 | 2 | 0 | 5700 | 54096 | 5700 | not_recorded_in_result | not_recorded_in_result | not_recorded |
| R0 | 63.0 | 144.5 | 34.4 | 0.5 | 3 | 2 | 0 | 5700 | 54096 | 5700 | full_string_scan | static_initial_active_context | 100000 |
| B2c | 2.8 | 20.8 | 12.7 | 0.1 | 0 | 0 | 0 | 5700 | 54096 | 5700 | compact_checksum_index | static_initial_active_context | 100000 |
| R0c | 78.2 | 15.1 | 48.7 | 1.4 | 1 | 0 | 0 | 5700 | 54096 | 5700 | compact_checksum_index | static_initial_active_context | 100000 |

## 7. Ratio Summary

| ratio | value |
| --- | ---: |
| B2 send / B2c send | 7.779x |
| R0 send / R0c send | 9.57x |
| B2 send / R0 send | 1.12x |
| B2c send / R0c send | 1.377x |
| B2c initial render / R0c initial render | 0.036x |
| B2c scroll proxy / R0c scroll proxy | 0.261x |
| B2c typing proxy / R0c typing proxy | 0.071x |
| B2c rendered DOM nodes / R0c rendered DOM nodes | 1x |

The B2c/R0c send ratio is 1.377x, equivalent to an R0c send-path advantage of about 27.4% versus B2c.

## 8. R0c Overhead Classification

| metric | B2c | R0c | classification | risk | safe wording |
| --- | ---: | ---: | --- | --- | --- |
| initial_render_ms | 2.8 | 78.2 | likely startup_worker_init_initial_projection_overhead | not_proven_amortizable | R0c pays substantially higher initial setup cost in this harness. |
| scroll_jump_return_ms | 12.7 | 48.7 | per_interaction_scroll_projection_overhead_not_yet_diagnosed | scroll_proxy_not_browser_frame_stability | R0c is slower on the scroll-return proxy; the cause needs separate diagnosis. |
| typing_proxy_ms | 0.1 | 1.4 | small_absolute_worker_dispatch_roundtrip_overhead_single_shot | large_ratio_due_to_b2c_timing_floor | R0c typing has small absolute overhead but cannot support all-interaction dominance claims. |
| long_task_like_count_50ms_proxy | 0.0 | 1.0 | r0c_has_one_50ms_like_proxy_event | internal_proxy_not_long_task_api | R0c has one internal 50ms-like proxy count while B2c has zero; this is not browser Long Task evidence. |

## 9. Typing Proxy Caveat

B2c typing is near the measurement floor. R0c typing max is 1.4ms, so the absolute value is small. The 14x ratio should not be called a severe regression without this context. Current typing data is single-shot per scenario, not distributional. R0c typing likely includes Worker dispatch/roundtrip overhead. This does not block send-path analysis, but prevents all-interaction dominance claims. If future work wants to make typing responsiveness a primary claim, repeated typing measurement is required.

| scenario | logical_block_count | B2c typing_proxy_ms | R0c typing_proxy_ms |
| --- | ---: | ---: | ---: |
| p5d_v10000_rich_ctx_full_repeat3 | 11536 | 0.1 | 0.3 |
| p5d_v25000_rich_ctx_medium_repeat3 | 28072 | 0.1 | 0.3 |
| p5d_v25000_rich_ctx_full_repeat3 | 28072 | 0.1 | 0.5 |
| p5d_v50000_rich_ctx_medium_repeat2 | 54096 | 0.1 | 0.5 |
| p5d_v50000_rich_ctx_full_repeat2 | 54096 | 0.1 | 1.4 |

## 10. Active-Context Limitation

Both B2c and R0c use `dynamic_active_context_update_mode = static_initial_active_context`. Current paired comparison assumes a static active-context corpus. Dynamic active-context maintenance is not measured. Under dynamic active-context workloads, R0 worker-resident architecture could either gain or lose. This must be a future P5 axis.

## 11. Conservative Interpretation

Paired compact-index results show that:

1. Active-context full string scan was the dominant shared send-path bottleneck for B2 and R0.
2. The same compact-index optimization yields large send-path improvements for both B2c and R0c.
3. After equalizing the shared algorithmic bottleneck, R0c retains a modest send-click proxy advantage over B2c.
4. R0c also shows substantial non-send overhead on initial render, scroll-return proxy, and typing proxy.
5. Therefore, current evidence supports a send-path-specific architectural signal, not overall runtime dominance.
6. P4 remains not authorized.

## 12. What This Supports

- Paired design removes the R0-only algorithmic optimization confound.
- Compact-index optimization attacks the shared active-context scan bottleneck.
- R0c has a send-path-specific positive signal.
- B2c remains a very strong baseline.
- The next decision should be mechanism-driven, not victory-driven.

## 13. What This Does Not Prove

- R0c overall dominance over B2c.
- Browser-level INP.
- Frame stability.
- Production runtime readiness.
- Dynamic active-context performance.
- P4 eligibility.
- Broader workload claims.

## 14. Final Classification

| field | value |
| --- | --- |
| p5_status | paired_compact_context_results_collected |
| shared_bottleneck | active_context_full_string_scan |
| b2c_status | strong_compact_virtualized_dom_baseline |
| r0c_status | send_path_specific_advantage_with_non_send_overheads |
| r0c_caveat | not_overall_dominance_over_b2c |
| typing_status | small_absolute_worker_dispatch_overhead_single_shot |
| active_context_status | static_initial_only_dynamic_not_measured |
| p4_status | not_authorized |
| recommended_next | diagnose_non_send_overheads_or_design_concurrent_input_axis_before_p4 |
