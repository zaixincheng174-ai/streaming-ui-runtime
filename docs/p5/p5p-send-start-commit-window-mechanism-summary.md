# P5-P Send-start + Commit-window Scheduling Mechanism Summary

## 1. Purpose

This document summarizes P5-M and P5-O. It is not a new measurement, not browser INP, not Event Timing, not frame-stability evidence, not production readiness, and not P4 authorization.

## 2. Source Results

| source | file |
| --- | --- |
| P5-M B2m send-start result | `bench/p5/results/p5m_b2c_concurrent_input_results.json` |
| P5-M R0m send-start result | `bench/p5/results/p5m_r0c_concurrent_input_results.json` |
| P5-O B2o commit-window result | `bench/p5/results/p5o_b2c_commit_window_input_results.json` |
| P5-O R0o commit-window result | `bench/p5/results/p5o_r0c_commit_window_input_results.json` |
| Prior P5-N mechanism summary | `docs/p5/p5n-concurrent-input-mechanism-summary.md` |

## 3. Primary Mechanism Claim

P5-M and P5-O together show that R0 does not eliminate main-thread blocking. Instead, R0 moves most logical send work off the main thread and bounds the remaining main-thread blocking to the projection commit window. B2 keeps send work on the main thread, so synthetic input tasks can be blocked by the full send work path. R0 allows near-floor synthetic input task start during worker-side send computation, but input arriving during the later bounded commit can still be delayed.

## 4. Two-phase Scheduling Model

| phase | B2 behavior | R0 behavior | measured proxy |
| --- | --- | --- | --- |
| send-start / worker-compute phase | B2 keeps compact active-context scan, tail mutation, append stream, and bounded DOM update on the main thread. | R0 dispatches compact active-context scan, tail mutation, append stream, and projection construction to the Worker before bounded main-thread commit. | P5-M setTimeout-based synthetic input task scheduled at send start. |
| commit-window phase | B2 schedules the synthetic task immediately before bounded `renderWindow` commit during the main-thread send path. | R0 schedules the synthetic task immediately before bounded projection commit after Worker send completion. | P5-O setTimeout-based synthetic input task scheduled immediately before the known commit/render window. |

## 5. P5-M Send-start Results

| metric | B2m | R0m |
| --- | ---: | ---: |
| max_concurrent_input_delay_ms | 16.0 | 0.1 |
| max_concurrent_send_work_ms | 15.9 | 11.2 |
| max_concurrent_worker_send_processing_ms | n/a | 5.5 |
| max_concurrent_worker_roundtrip_minus_processing_ms | n/a | 1.4 |
| max_concurrent_main_commit_ms | n/a | 4.7 |
| max_rendered_dom_node_count | 5700 | 5700 |
| max_logical_block_count | 54096 | 54096 |
| max_send_active_context_entries_visited | 100000 | 100000 |

B2m delay tracks main-thread send work. R0m input task starts near the timing floor during worker-side computation. This remains a `setTimeout`-based internal scheduling-delay proxy, not INP.

## 6. P5-O Commit-window Results

| metric | B2o | R0o |
| --- | ---: | ---: |
| max_commit_window_input_delay_ms | 28.1 | 4.7 |
| max_commit_window_main_commit_ms | 10.5 | 4.7 |
| max_commit_window_send_work_ms | 17.1 | 9.2 |
| max_commit_window_total_proxy_ms | 63.6 | 9.5 |
| max_commit_window_worker_send_processing_ms | n/a | 4.6 |
| max_commit_window_worker_roundtrip_minus_processing_ms | n/a | 0.5 |
| max_rendered_dom_node_count | 5700 | 5700 |
| max_logical_block_count | 54096 | 54096 |
| max_send_active_context_entries_visited | 100000 | 100000 |

R0o commit-window input delay tracks bounded main commit. B2o commit-window input delay is a commit-window scheduling-delay proxy, not pure commit cost. P5-O confirms R0 still blocks during commit, but the window is bounded.

## 7. Fairness / Invariants

- Same P5-D matrix.
- Same `compact_checksum_index`.
- Same `static_initial_active_context`.
- Same max active-context entries visited: `100000`.
- Same rendered DOM node count: `5700`.
- Same logical block count: `54096`.
- B2 and R0 intentionally differ in ownership of logical send work.

## 8. Caveats

- `setTimeout`-based synthetic task only.
- Not keyboard or pointer event evidence.
- Not browser Event Timing.
- Not INP.
- Not input-to-pixel.
- Send-start proxy is favorable for R0 and blocking for B2 by construction.
- Commit-window proxy tests one specific arrival phase, not random lifecycle average.
- B2o `28.1ms` is not pure commit cost.
- R0 does not eliminate all main-thread blocking.

## 9. What This Supports

- Worker-resident runtime can reduce main-thread blocking during logical send work.
- R0 localizes remaining main-thread blocking to bounded projection commit.
- P5-M + P5-O provide the clearest P5 scheduling evidence so far.
- This strengthens the runtime thesis more than raw send-click latency alone.

## 10. What This Does Not Prove

- Browser-level INP.
- Event Timing.
- Frame stability.
- Production readiness.
- Impossible-zone completion.
- P4 eligibility.
- WebGPU or Canvas necessity.
- All-interaction dominance.
- Average-case input availability across full lifecycle.

## 11. Recommended Next Step

Recommend P5-Q dynamic active-context or multi-stream agent trace workload before P4.

The scheduling mechanism is now well characterized for send-start and commit-window proxies. Next value should come from long-lived workload realism, not more micro-optimization.

## 12. Final Classification

| field | value |
| --- | --- |
| p5_status | send_start_and_commit_window_scheduling_story_complete |
| primary_mechanism | offload_logical_send_work_and_bound_main_commit_window |
| b2_status | main_thread_send_path_blocks_synthetic_input |
| r0_status | worker_send_keeps_main_available_until_bounded_commit |
| commit_window_status | bounded_but_not_eliminated |
| proxy_status | internal_setTimeout_scheduling_delay_not_INP |
| p4_status | not_authorized |
| recommended_next | dynamic_active_context_or_multistream_workload_before_p4 |
