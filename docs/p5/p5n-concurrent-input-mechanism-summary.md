# P5-N Concurrent Input Mechanism Summary

## 1. Purpose

This document summarizes the P5-M paired concurrent-input results. It is mechanism-aware. It is not a new benchmark run, not browser-level INP evidence, not Event Timing evidence, not frame-stability evidence, not production readiness evidence, and not P4 authorization.

## 2. Source Results

| source | file |
| --- | --- |
| B2m result JSON | `bench/p5/results/p5m_b2c_concurrent_input_results.json` |
| R0m result JSON | `bench/p5/results/p5m_r0c_concurrent_input_results.json` |
| B2m target | `bench/p5/targets/p5m_b2c_concurrent_input_stress.html` |
| R0m target | `bench/p5/targets/p5m_r0c_concurrent_input_stress.html` |
| B2m collector | `scripts/p5/collect_p5m_manual_b2c_concurrent_results.mjs` |
| R0m collector | `scripts/p5/collect_p5m_manual_r0c_concurrent_results.mjs` |
| prior P5-L summary | `docs/p5/p5l-post-k1-b2c-r0c-mechanism-update.md` |

## 3. Primary Claim

P5-M shows a categorical scheduling difference under a send-start synthetic input proxy. B2m's input task is delayed roughly by the duration of main-thread send work, while R0m's input task starts near the timing floor during worker-side send computation. This supports the worker-resident runtime direction as a way to reduce main-thread blocking during logical send work. However, the proxy is setTimeout-based, not browser Event Timing or INP, and it does not measure input arriving during R0m's later bounded main-thread commit phase.

Do not read this as R0m proving better INP, eliminating main-thread blocking, dominating B2m overall, or providing a precise user-perceived speedup.

## 4. Timer Definition / setTimeout Proxy Semantics

P5-M uses `setTimeout(..., 0)` to schedule a synthetic input task. `concurrent_input_delay_ms` is:

```text
concurrent_input_started_at_ms - concurrent_input_scheduled_at_ms
```

`scheduled_at` is recorded when the synthetic input task is scheduled. `started_at` is recorded as the first statement inside the `setTimeout` callback. This measures schedule-to-callback-start delay for a synthetic timer task.

It is not keyboard event delay, pointer event delay, browser Event Timing, INP, or input-to-pixel latency.

A zero-delay timer can fire near the timing floor when the main thread is available. Therefore R0m's `0.1ms` should be interpreted as near-immediate timer-task availability in this harness. B2m's `16.0ms` delay should be interpreted as main-thread blocking by synchronous send work, not as timer clamp.

## 5. Trigger Timing

The synthetic input task is scheduled immediately after send work is initiated. For B2m, the task is queued before synchronous main-thread send work runs. For R0m, the task is queued immediately after Worker send dispatch and before awaiting Worker completion.

This is a send-start concurrent-input proxy. For B2m, this is a blocking phase because the main thread immediately enters send work. For R0m, this is a favorable phase because Worker-side send has started while the main thread is still available.

This does not represent random arrival across the whole send lifecycle. Average-case input availability across the full send lifecycle is not measured.

## 6. Main Commit Scope Gap

R0m's `0.1ms` concurrent input delay measures input-task availability during Worker-side send computation. After Worker computation completes, the main thread performs a bounded projection commit. In the current results, `max_concurrent_main_commit_ms = 4.7ms`.

If input arrives during that commit window, P5-M does not measure that case. Therefore R0m reduces the main-thread blocking window during send; it does not eliminate all main-thread blocking. The blocking window shifts from B2m's full main-thread send work duration to R0m's bounded commit phase.

Future work could test commit-window input availability or make commits yieldable/incremental, but P5-M does not evaluate that.

## 7. Metric Table

| metric | B2m | R0m |
| --- | ---: | ---: |
| max_concurrent_input_delay_ms | 16.0 | 0.1 |
| max_concurrent_input_during_send_proxy_ms | 16.2 | 11.3 |
| max_concurrent_typing_proxy_ms | 0.2 | 0.2 |
| max_concurrent_send_work_ms | 15.9 | 11.2 |
| max_send_click_proxy_ms | 15.9 | 11.2 |
| max_send_active_context_entries_visited | 100000 | 100000 |
| max_rendered_dom_node_count | 5700 | 5700 |
| max_logical_block_count | 54096 | 54096 |
| max_concurrent_worker_send_processing_ms | n/a | 5.5 |
| max_concurrent_worker_roundtrip_minus_processing_ms | n/a | 1.4 |
| max_concurrent_main_commit_ms | n/a | 4.7 |

## 8. Mechanism Interpretation

B2m:

- Schedules synthetic input task.
- Runs send work synchronously on main thread.
- Input task cannot start until main-thread send work completes.
- This explains why B2m `concurrent_input_delay_ms` roughly tracks `concurrent_send_work_ms`.

R0m:

- Dispatches send work to Worker.
- Schedules synthetic input task on main thread before awaiting Worker completion.
- Input task can start while Worker-side send work is still running.
- Later bounded projection commit still happens on main thread and can block input if input arrives during that phase.

P5-M measures main-thread availability during worker-side send computation, not during the later commit window.

## 9. Ratio / Delta Summary

| comparison | value | interpretation |
| --- | ---: | --- |
| B2m input delay / R0m input delay | 160.0x | Internal proxy ratio only; blocked vs near-unblocked scheduling category, not user-perceived speedup. |
| B2m send work / R0m send work | 1.42x | R0m send work is lower in this paired proxy run. |
| B2m input delay minus B2m send work | +0.1ms | B2m input delay tracks main-thread send work closely. |
| R0m input delay minus R0m worker send processing | -5.4ms | R0m input task starts while Worker send processing is still in flight. |
| R0m concurrent main commit | 4.7ms | Commit-window input availability is not measured. |

For `16.0ms` vs `0.1ms`, the safe interpretation is blocked vs near-unblocked scheduling category.

## 10. Fairness / Invariant Check

- Both use the same P5-D matrix.
- Both use `compact_checksum_index`.
- Both use `static_initial_active_context`.
- Both visit `100000` max active-context entries.
- Both have rendered DOM node count `5700`.
- Both have logical block count `54096`.
- B2m and R0m are not identical implementations; they intentionally differ in ownership of logical send work.

## 11. What This Supports

- Strong internal scheduling-delay signal for the worker-resident runtime direction.
- B2m input task is blocked by main-thread send work.
- R0m input task starts near the timing floor while Worker performs send work.
- Worker-resident runtime can reduce main-thread blocking during logical send work.
- This is the clearest P5 signal so far for the runtime thesis.

## 12. What This Does Not Prove

- Browser-level INP.
- Event Timing.
- Frame stability.
- Hardware input latency.
- Input-to-pixel latency.
- Commit-window input availability.
- Average-case input availability across the full send lifecycle.
- R0m eliminates all main-thread blocking.
- Production readiness.
- Impossible-zone completion.
- P4 eligibility.

## 13. Recommended Next Step

Preferred: P5-O, focused on commit-window input availability or dynamic active-context workload design.

If the project wants to strengthen the scheduling claim, next test commit-window input availability or repeated/randomized input arrival across the send lifecycle. If the project wants to strengthen long-lived AI surface realism, next test dynamic active-context update or multi-stream agent trace workload. P4 remains not authorized.

## 14. Final Classification

| field | value |
| --- | --- |
| p5_status | concurrent_input_proxy_results_collected |
| primary_signal | blocked_vs_near_unblocked_synthetic_input_task_during_send_start |
| b2m_status | main_thread_send_blocks_synthetic_input_task |
| r0m_status | worker_send_allows_near_floor_input_task_start_during_worker_compute |
| proxy_status | setTimeout_based_internal_scheduling_delay_not_INP |
| commit_window_status | not_measured |
| p4_status | not_authorized |
| recommended_next | commit_window_input_or_dynamic_active_context_axis_before_p4 |
