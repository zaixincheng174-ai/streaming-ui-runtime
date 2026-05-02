# P5-V Multistream Agent-trace Mechanism Summary

## 1. Purpose

This summarizes P5-U. It is not a new measurement, not browser INP, not Event Timing, not frame-stability evidence, not production readiness, and not P4 authorization.

## 2. Source Results

| source | file |
| --- | --- |
| P5-U B2u result JSON | `bench/p5/results/p5u_b2c_multistream_agent_trace_results.json` |
| P5-U R0u result JSON | `bench/p5/results/p5u_r0c_multistream_agent_trace_results.json` |
| Prior P5-T summary | `docs/p5/p5t-dynamic-update-concurrent-input-mechanism-summary.md` |
| Prior P5-P summary | `docs/p5/p5p-send-start-commit-window-mechanism-summary.md` |

## 3. Primary Mechanism Claim

P5-U provides the strongest workload-realism signal so far. Under a synthetic multi-stream agent-trace workload, B2u delays the synthetic input task while main-thread multistream / dynamic active-context work runs. R0u does not eliminate multistream or dynamic-context work; instead, it moves that work into Worker and keeps the main-thread synthetic input task near the timing floor while Worker-side processing is in flight. The architectural signal is input-path isolation under a more realistic long-lived AI surface workload.

This does not say R0u proves browser INP is better, eliminates all main-thread blocking, is production-ready, is a precise speedup, or authorizes P4.

## 4. Metric Table

| metric | B2u | R0u |
| --- | ---: | ---: |
| concurrent_multistream_input_delay_ms | 164.3 | 0.1 |
| concurrent_multistream_proxy_ms | 164.4 | 137.5 |
| multistream_agent_trace_proxy_ms | 140.4 | 136.6 |
| multistream_send_work_ms | 140.4 | 136.6 |
| stream_merge_ms | 0.7 | 0.9 |
| dynamic_active_context_update_ms | 131.3 | 129.4 |
| stream_events_processed | 4096 | 4096 |
| send_active_context_entries_visited | 100000 | 100000 |
| logical_block_count | 54096 | 54096 |
| expected_final_logical_block_count | 54096 | 54096 |
| rendered_dom_node_count | 4582 | 4582 |
| worker_multistream_processing_ms | n/a | 133.6 |
| worker_stream_merge_ms | n/a | 0.9 |
| worker_dynamic_active_context_update_ms | n/a | 129.4 |
| worker_roundtrip_minus_processing_ms | n/a | 0.8 |
| main_commit_ms | n/a | 3.3 |
| concurrent_worker_multistream_processing_ms | n/a | 133.6 |
| concurrent_worker_roundtrip_minus_processing_ms | n/a | 0.8 |
| concurrent_main_commit_ms | n/a | 3.3 |

## 5. Workload Semantics

P5-U uses synthetic stream lanes:

- `assistant_tokens`
- `tool_events`
- `agent_trace`
- `code_diff_chunks`

`stream_events_processed = append_batch_size * send_click_repeat_count`. In the max scenario, both B2u and R0u process `4096` stream events.

The active context uses `compact_checksum_index`. Dynamic active context uses `rolling_tail_window_after_append`. Final logical block count equals expected final logical block count: `54096` on both sides.

Rendered DOM remains bounded and equal across B2u/R0u. `rendered_dom_node_count` is `4582` in P5-U, not `5700` as in some previous targets. This is acceptable because B2u/R0u use the same P5-U DOM shape and both report `4582`. Do not compare `rendered_dom_node_count` directly against earlier target families as if DOM shape were identical.

## 6. Mechanism Interpretation

B2u:

- Stream merge, append, tail mutation, rolling active-context update, and bounded render happen on main thread.
- B2u input delay rises to `164.3ms` because synthetic input is queued behind main-thread multistream/dynamic-context work.
- B2u dynamic active-context update is the dominant part of the workload: `131.3ms`.

R0u:

- Stream merge, append, tail mutation, rolling active-context update, and bounded projection generation happen in Worker.
- R0u input delay remains near timing floor: `0.1ms`.
- R0u worker processing remains material: `133.6ms`.
- R0u dynamic active-context update remains material: `129.4ms`.
- R0u bounded main commit remains: `3.3ms`.

P5-U does not show that R0 eliminates multistream/dynamic-context work; it shows that R0 moves that work out of the main-thread input path.

## 7. Fairness / Invariants

- Same P5-D matrix.
- `stream_lane_count = 4`.
- Same stream lanes.
- `stream_events_processed = 4096` in max scenario.
- `send_active_context_entries_visited = 100000`.
- `compact_checksum_index`.
- `rolling_tail_window_after_append`.
- Final logical block count equals expected final logical block count: `54096`.
- Rendered DOM node count is `4582` on both sides.
- B2 and R0 intentionally differ in ownership of multistream / dynamic-context work.

## 8. Caveats

- `setTimeout`-based synthetic task only.
- Not keyboard or pointer event evidence.
- Not browser Event Timing.
- Not browser-level INP.
- Not input-to-pixel latency.
- P5-U schedules input immediately around multistream work; it does not measure random lifecycle arrival.
- R0u input delay does not prove commit-window input availability; commit-window was separately tested in P5-O.
- R0u does not eliminate all main-thread blocking.
- R0u does not eliminate multistream/dynamic-context CPU cost.
- Raw algorithmic optimizations must be paired if introduced later.
- This is still synthetic agent-trace workload, not product trace evidence.

## 9. Relation to Prior P5 Mechanism Chain

- P5-M: send-start input availability.
- P5-O: commit-window availability / bounded commit caveat.
- P5-S: dynamic active-context update input availability.
- P5-U: multi-stream agent-trace workload realism.

P5-U extends prior single-phase scheduling results into a more realistic multi-stream long-lived surface workload.

## 10. What This Supports

- Multi-stream / agent-trace is now a validated P5 workload axis.
- Rolling-tail dynamic context remains a material cost.
- R0u moves multistream plus dynamic-context processing into Worker.
- While Worker-side multistream processing is in flight, main-thread synthetic input stays near timing floor.
- This strengthens the long-lived AI surface runtime thesis more than raw send-click latency alone.

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
- Real product trace superiority.

## 12. Recommended Next Step

Recommend P5-W paper/evidence packet freeze or product-trace-shaped synthetic scenario before P4.

P5 now has several strong scheduling axes. More benchmark axes may have diminishing returns unless they directly address reviewer concerns. The next best step is either to freeze the evidence chain into a reviewer-ready packet or introduce one product-trace-shaped synthetic scenario to bridge toward external validity.

## 13. Final Classification

| field | value |
| --- | --- |
| p5_status | multistream_agent_trace_axis_validated |
| primary_mechanism | move_multistream_dynamic_context_work_off_main_thread_to_preserve_input_path |
| b2u_status | main_thread_multistream_dynamic_context_work_blocks_synthetic_input |
| r0u_status | worker_multistream_dynamic_context_work_keeps_main_input_near_floor_during_processing |
| workload_status | strongest_p5_workload_realism_signal_so_far |
| proxy_status | internal_setTimeout_scheduling_delay_not_INP |
| p4_status | not_authorized |
| recommended_next | evidence_packet_or_product_trace_shaped_synthetic_before_p4 |
