# P5-T Dynamic-update Concurrent-input Mechanism Summary

## 1. Purpose

This summarizes P5-Q and P5-S. It is not a new measurement, not browser INP, not Event Timing, not frame-stability evidence, not production readiness, and not P4 authorization.

## 2. Source Results

| source | file |
| --- | --- |
| P5-Q B2q result JSON | `bench/p5/results/p5q_b2c_dynamic_context_results.json` |
| P5-Q R0q result JSON | `bench/p5/results/p5q_r0c_dynamic_context_results.json` |
| P5-S B2s result JSON | `bench/p5/results/p5s_b2c_concurrent_dynamic_context_results.json` |
| P5-S R0s result JSON | `bench/p5/results/p5s_r0c_concurrent_dynamic_context_results.json` |
| Prior P5-R summary | `docs/p5/p5r-dynamic-active-context-mechanism-summary.md` |
| Prior P5-P summary | `docs/p5/p5p-send-start-commit-window-mechanism-summary.md` |

## 3. Primary Mechanism Claim

P5-Q shows that rolling-tail dynamic active-context maintenance is a material workload cost in both B2 and R0. R0 does not eliminate this cost; it moves it into Worker. P5-S then shows that, when dynamic-update work is in flight, B2s delays the synthetic input task because the update runs on the main thread, while R0s lets the synthetic input task start near the timing floor because the dynamic update runs in Worker. The architectural signal is input-path isolation during dynamic update, not raw update-cost elimination.

This does not say R0s proves browser INP is better, eliminates all main-thread blocking, is a precise speedup, authorizes P4, or clearly dominates B2q on raw dynamic update cost.

## 4. P5-Q Cost-localization Summary

| metric | B2q | R0q | interpretation |
| --- | ---: | ---: | --- |
| dynamic_context_send_proxy_ms | 57.3 | 54.0 | R0q total proxy is only slightly lower. |
| dynamic_active_context_update_ms | 28.5 | 30.8 | Dynamic update is material in both systems. |
| dynamic_active_context_rebuild_ms | 28.5 | 30.8 | Rolling-tail rebuild remains the central dynamic-context cost. |
| entries visited | 100000 | 100000 | Entry-count semantics are preserved. |
| update count | 3 | 3 | Same repeat/update count. |
| generation count | 4 | 4 | Same initial plus repeat generation shape. |
| final logical block count | 54096 | 54096 | Full logical transcript growth is preserved. |
| rendered DOM node count | 5700 | 5700 | Mounted DOM remains bounded. |
| R0q worker dynamic update | n/a | 30.8 | R0q moves dynamic update into Worker. |
| R0q main commit | n/a | 4.6 | Bounded main commit remains after Worker work. |

Dynamic update is material in both systems. R0q's total proxy advantage is small. R0q moves dynamic update into Worker, but P5-Q alone does not prove input responsiveness advantage.

## 5. P5-S Input-availability Summary

| metric | B2s | R0s | interpretation |
| --- | ---: | ---: | --- |
| dynamic_update_input_delay_ms | 35.2 | 0.1 | B2s blocks the synthetic input task during main-thread update; R0s starts near timing floor during Worker update. |
| concurrent_dynamic_context_send_proxy_ms | 99.9 | 54.9 | R0s remains close to the P5-Q dynamic send proxy while B2s pays added scheduling-proxy cost. |
| dynamic_update_send_work_ms | 58.3 | 54.1 | Work remains material in both variants. |
| dynamic_active_context_update_ms | 45.7 | 31.1 | Dynamic update remains real work; R0s does not eliminate it. |
| dynamic_active_context_rebuild_ms | 45.7 | 31.1 | Rolling-tail rebuild remains the measured update mechanism. |
| dynamic_update_typing_proxy_ms | 0.2 | 0.2 | The small synthetic typing action itself is not the bottleneck. |
| entries visited | 100000 | 100000 | Same active-context visit count. |
| final logical block count | 54096 | 54096 | Same final transcript size. |
| rendered DOM node count | 5700 | 5700 | Same bounded rendered DOM. |
| R0s worker dynamic processing | n/a | 49.6 | R0s Worker owns the dynamic send/update path. |
| R0s main commit | n/a | 4.5 | R0s still has bounded main-thread commit after Worker completion. |

B2s input task is blocked during main-thread dynamic active-context update. R0s input task starts near timing floor while Worker-side dynamic send/update work runs. R0s still has bounded main commit after Worker completion. This remains a `setTimeout`-based internal scheduling-delay proxy, not INP.

## 6. Two-step Mechanism

| step | finding | mechanism | implication |
| --- | --- | --- | --- |
| P5-Q cost localization | Dynamic active-context rebuild/update is material in both systems. | B2q performs update on main thread; R0q performs update in Worker. | P5-Q identifies the dynamic-update cost but does not by itself prove input responsiveness advantage. |
| P5-S input availability during update | B2s input delay rises during main-thread update; R0s input delay stays near the timing floor during Worker update. | Ownership of dynamic-update work changes the main-thread scheduling path. | P5-S shows the scheduling effect of where the dynamic-update cost lives. |

P5-Q identifies the dynamic-update cost; P5-S shows the scheduling effect of where that cost lives.

## 7. Fairness / Invariants

- Same P5-D matrix.
- Same `compact_checksum_index`.
- Same `rolling_tail_window_after_append`.
- Max active-context entries visited: `100000`.
- Active-context update count: `3`.
- Active-context generation count: `4`.
- Final logical block count: `54096`.
- Expected final logical block count: `54096`.
- Rendered DOM node count: `5700`.
- B2 and R0 intentionally differ in ownership of dynamic active-context work.

## 8. Caveats

- `setTimeout`-based synthetic task only.
- Not keyboard or pointer event evidence.
- Not browser Event Timing.
- Not browser-level INP.
- Not input-to-pixel latency.
- P5-S schedules input immediately around the dynamic-update phase; it does not represent random lifecycle arrival.
- R0s input delay does not prove commit-window input availability; commit window was separately addressed by P5-O.
- R0s does not eliminate all main-thread blocking.
- R0q/R0s do not eliminate dynamic-update CPU cost.
- Raw algorithmic optimizations must be paired if introduced later.

## 9. Optimization Implications

Shared algorithmic optimizations:

- ring-buffer rolling context
- incremental compact-index update
- dirty-range update
- segmented active-context index
- chunk aggregate summaries

Architecture-specific R0 directions:

- worker-side dynamic context maintenance
- transaction scheduling
- chunked/yieldable Worker update
- double-buffer active-context snapshots
- bounded / incremental main-thread commit

P5-S supports R0's architectural direction because it isolates dynamic-update cost from the main-thread input path. It does not prove the update algorithm itself is optimal.

## 10. What This Supports

- Dynamic active-context is a realistic long-lived workload axis.
- Rolling-tail rebuild/update is a material cost.
- R0 can move that cost into Worker.
- When dynamic update is in flight, R0 keeps main-thread synthetic input near timing floor.
- This strengthens the long-lived AI surface runtime thesis.

## 11. What This Does Not Prove

- Browser-level INP.
- Event Timing.
- Frame stability.
- Production readiness.
- Impossible-zone completion.
- P4 eligibility.
- All-interaction dominance.
- Average-case input availability.
- Optimal active-context update algorithm.
- WebGPU or Canvas necessity.

## 12. Recommended Next Step

Recommend P5-U multi-stream / agent trace workload before P4.

P5-M, P5-O, and P5-S have characterized scheduling for send-start, commit-window, and dynamic-update phases. Next value should come from multi-stream long-lived workload realism unless the project wants to further quantify randomized input-arrival phase coverage first.

## 13. Final Classification

| field | value |
| --- | --- |
| p5_status | dynamic_update_input_scheduling_story_complete |
| primary_mechanism | move_dynamic_update_off_main_thread_to_preserve_input_path |
| b2_status | main_thread_dynamic_update_blocks_synthetic_input |
| r0_status | worker_dynamic_update_keeps_main_input_near_floor_during_update |
| dynamic_update_cost_status | material_but_not_eliminated |
| proxy_status | internal_setTimeout_scheduling_delay_not_INP |
| p4_status | not_authorized |
| recommended_next | multistream_agent_trace_workload_before_p4 |
