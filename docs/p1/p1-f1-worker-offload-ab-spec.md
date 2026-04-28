# P1-F1 Worker-Offload A/B Spec

Date: 2026-04-26  
Project: Streaming UI Runtime for Long-Lived AI Surfaces  
Stage: P1-F1 design spec

## Decision

F1 is approved as a design step because F0-D produced stable controlled main-thread boundary-positive results.

The next question is whether Worker-resident fanout and derived work can remove the main-thread long task.

This is an A/B solution test, not a full runtime implementation.

## Alignment With Current Evidence

Product evidence shows:

`click/pointerup -> Run microtasks -> multi-bundle coordination`

F0-D controlled baseline reproduces a similar mechanism shape:

`synthetic click -> microtask flush -> module/subscriber derived fanout`

F0-D attribution confirms the long task is microtask/flush target work, not React commit, layout, paint, style, or GC.

Therefore Worker offload is the next solution lever to test. The target work is derived fanout, state traversal, queue drain, and projection generation, not renderer backend replacement.

## A/B Question

Can the same F0-D derived fanout workload be moved off the main thread so that:

- main-thread max task drops below 50ms
- main-thread F0/F1 projection window becomes bounded
- worker compute may still be large
- total work is not skipped
- visible projection remains correct

## A/B Arms

### A: Main-thread baseline

Use existing F0-D configuration:

- `calibration_level=derived`
- `session_size=2500`
- `module_count=20`
- `subscribers_per_module=96`
- `fanout_width=192`
- `queued_effect_count=2048`
- `state_nodes_touched=32768`
- `flush_batch_size=2048`
- `commit_update_count=4`
- `microtask_chain_length=8`
- `payload_shape=derived-json`
- `history_mount_size=2500`
- `content_richness=derived`
- `synthetic_pressure_multiplier=1`
- `derived_work_enabled=true`
- `selector_passes_per_subscriber=8`
- `queue_drain_steps_per_module=256`
- `state_read_stride=7`
- `derived_hash_rounds=4`
- `projection_update_count=6`

The committed F0-D 3x result can serve as the initial A baseline. A fresh A run is only needed if the B implementation changes shared target or helper behavior.

### B: Worker-offloaded fanout

Use the same structural workload and counts, but:

- module flush, subscriber notify, selector passes, queue drain, and hash rounds execute in a Web Worker
- main thread only dispatches the action, receives bounded projection output, and commits a small React-visible projection
- main thread must not synchronously wait for worker completion
- worker result must include enough checksum and counter metadata to prove equivalent work was performed

## Equivalence Requirements

Worker B must prove it performed equivalent work:

- same `module_count`
- same `subscriber_notify_count`
- same `queued_effect_count_observed`
- same `state_nodes_touched_observed`
- same `derived_selector_eval_count`
- same `queue_drain_step_count`
- same `derived_hash_rounds_observed`
- same `projection_update_count_observed`
- same deterministic `workload_source_hash` or equivalent checksum
- same `action_sequence_hash`
- same config fields
- no precompute before click
- no skipped modules
- no skipped subscribers
- no reduced state traversal
- no `synthetic_pressure_multiplier > 1`

## Main-Thread Metrics

Required main-thread metrics:

- `f1_main_click_window_ms`
- `f1_main_dispatch_window_ms`
- `f1_main_projection_commit_ms`
- `f1_main_total_visible_update_ms`
- `f1_main_run_task_max_ms`
- `f1_main_long_task_count_50ms`
- `react_commit_count`
- `react_root_render_count`
- `react_component_render_count`
- `visibility_frame_parity_status`
- `p0_capture_end_observed`

## Worker Metrics

Required worker metrics:

- `f1_worker_compute_ms`
- `f1_worker_flush_ms`
- `f1_worker_module_flush_count`
- `f1_worker_subscriber_notify_count`
- `f1_worker_queue_drain_step_count`
- `f1_worker_derived_selector_eval_count`
- `f1_worker_state_nodes_touched_observed`
- `f1_worker_derived_hash_rounds_observed`
- `f1_worker_projection_update_count_observed`
- `f1_worker_result_bytes`
- `f1_worker_roundtrip_ms`
- `f1_worker_error`

If worker performance marks are not visible in Chrome trace, the worker must post timestamp and counter metadata back to the main thread, and the main thread must emit metric marks.

## Success Criteria

Worker B is successful only if:

- A reproduces F0-D-like main-thread long task behavior or uses the committed F0-D result as baseline
- B performs equivalent work by counters and checksums
- B reduces main-thread max task below 50ms
- B reduces or removes main-thread `long_task_count_50ms`
- B keeps visibility/frame parity valid
- B does not block the main thread waiting for the worker
- B does not use Canvas/WebGPU or renderer changes
- B does not cheat by moving visible work offscreen without preserving projection correctness

## Failure Criteria

Worker B fails if:

- worker work is skipped or reduced
- main thread waits synchronously
- projection correctness cannot be verified
- result depends on `synthetic_pressure_multiplier`
- only total latency moves but main-thread responsiveness does not improve
- parity fails
- A/B uses different structural workload

## Implementation Slice Proposal

Recommended narrow support slice:

- Add worker mode to `p1_send_flush_fanout_baseline.html` or add a separate `p1_worker_flush_fanout_baseline.html`
- Prefer a separate target if it reduces risk of contaminating F0
- Add one F1-B scenario JSON
- Add or extend audit script support to verify worker-mode config, counters, checksums, and invalid config behavior
- Add helper extraction only if required to parse new F1 marks

Do not implement in this task.

## Marks And Audit Fields

Proposed main-thread marks:

- `f1:start`
- `f1:trigger:start`
- `f1:trigger:end`
- `f1:dispatch-to-worker:start`
- `f1:dispatch-to-worker:end`
- `f1:worker-result:received`
- `f1:projection-commit:start`
- `f1:projection-commit:end`
- `f1:end`

Worker-reported metrics:

- `worker_received_at`
- `worker_flush_start`
- `worker_flush_end`
- `worker_projection_ready_at`
- `worker_done_at`

Audit fields:

- `baseline_id=p1-worker-offload-fanout`
- `scenario_mode=p1-f1-worker-offload-ab`
- `worker_offload_enabled=true`
- `worker_mode=dedicated-worker`
- `equivalent_work_required=true`
- `synthetic_pressure_multiplier=1`
- `no_precompute_before_click=true`
- all F0-D structural config fields
- `worker_result_checksum`
- `workload_source_hash`
- `action_sequence_hash`

## Experiment Ladder

Proposed ladder:

- F1-0 no-capture audit only
- F1-1 one smoke for Worker B
- compare to already committed F0-D baseline
- only if B is valid and promising, run A/B 3x pair
- no P2 until A/B 3x confirms main-thread benefit

## Blocked

Explicitly blocked:

- P2 implementation
- Canvas/WebGPU
- `allocation_probe`
- F0-E parameter escalation
- more DevTools collection
- Worker runtime implementation before A/B support audit
- changing F0-D baseline semantics
- `synthetic_pressure_multiplier > 1`

## Final Recommendation

Implement a minimal Worker B support slice next.

The first implementation should add Worker-offloaded fanout support and no-capture audit coverage only. It should not start P2, should not add Canvas/WebGPU, and should not broaden the workload. The goal is to prove or reject the offload lever against the already boundary-positive F0-D mechanism.

