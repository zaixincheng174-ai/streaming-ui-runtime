# P1-F0-D Product-Range Derived Fanout 3x Result

Date: 2026-04-26  
Project: Streaming UI Runtime for Long-Lived AI Surfaces  
Stage: P1-F0-D result note

## Decision

F0-D 3x is valid and boundary-positive.

This is not P2 authorization. It is the first stable controlled positive signal for the send/flush fanout mechanism.

The result shows that a production React controlled target can produce repeatable 50ms+ main-thread long tasks when the workload models action-triggered microtask flush, module fanout, subscriber notification, and derived state traversal over accumulated session state.

## Configuration

F0-D used structural fanout variables only:

- `scenario_mode=p1-f0-send-flush-fanout`
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

The run preserved the P1-F0 constraints: stable keys, `React.memo`, no deferred rendering, no token coalescing, no input probe, no scrollback, and no synthetic pressure multiplier above 1.

## Aggregate Result

F0-D 3x aggregate:

- `measured_count=3`
- `valid_count=3`
- `parity_fail_count=0`
- `boundary_positive_count=3`
- `f0_window_ms min/mean/max = 72.688 / 73.764 / 75.637`
- `f0_microtask_window_ms min/mean/max = 66.676 / 66.987 / 67.229`
- `f0_run_task_max_ms min/mean/max = 67.793 / 68.633 / 70.117`
- `f0_long_task_count_50ms=[1,1,1]`
- `decision=F0D_3X_BOUNDARY_POSITIVE`

All three runs had:

- `config_valid=true`
- `capture_allowed=true`
- `f0_marks_complete=true`
- `visibility_frame_parity_status=pass`
- `p0_capture_end_observed=true`
- `synthetic_pressure_multiplier=1`

Trace paths:

- `/tmp/streaming-ui-runtime-p1/p1-f0d-product-range-3x-01-20260426T033442Z/p1_f0c_send_flush_fanout_derived/runs/measure-01.trace.json`
- `/tmp/streaming-ui-runtime-p1/p1-f0d-product-range-3x-02-20260426T033442Z/p1_f0c_send_flush_fanout_derived/runs/measure-01.trace.json`
- `/tmp/streaming-ui-runtime-p1/p1-f0d-product-range-3x-03-20260426T033442Z/p1_f0c_send_flush_fanout_derived/runs/measure-01.trace.json`

## Interpretation

F0-D is stable. Each valid run produced one 50ms+ long task under parity-usable visible foreground conditions.

The derived fanout model can produce consistent long tasks in a production React controlled setting. The signal is below product medium and heavy rows, but it is now within a meaningful boundary-positive range.

This result supports the state/fanout/microtask mechanism direction. It shifts the controlled evidence away from pure rendering pressure and toward action-triggered app-side flush, subscriber fanout, and derived state traversal.

## What This Does Not Prove

This result does not prove product trace replay fidelity.

This result does not authorize P2.

This result does not establish Canvas or WebGPU relevance.

This result does not prove that React fails generally.

This result does not prove that a new runtime is necessary.

This result does not prove worker offload benefit.

This result does not identify the exact product ownership of `o`, `Ze`, bundle-level regions, or any minified product function.

## Next Required Step

The next required step is offline attribution on the existing three traces.

That attribution should confirm whether the long tasks are dominated by the F0 microtask/flush path and not by React commit, layout, paint, GC, visibility/frame suppression, or capture artifact.

If attribution confirms the mechanism, the next planning step is Worker-offload A/B. The A/B plan should target the fanout/derived-state work, not a renderer backend.

Do not expand F0 parameters further before attribution.

## Blocked

Blocked after this result:

- F0-E
- more parameter escalation
- P2 runtime implementation
- Canvas/WebGPU renderer work
- `allocation_probe`
- more DevTools collection
- Worker runtime implementation before A/B plan
- claims that this is product trace replay
- claims that P2 is now eligible
- claims that runtime necessity is proven

