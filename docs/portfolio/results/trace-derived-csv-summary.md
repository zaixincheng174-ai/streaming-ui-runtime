# Trace-derived CSV Public Summary

This file summarizes trace-derived CSV artifacts without publishing raw trace content.

## bench/p0/product-click-ownership-bottomup.csv
- Exists: True
- Rows: 24
- Columns: run_id, view, activity_label, url_or_function, self_ms, self_pct, total_ms, total_pct, notes

## bench/p0/product-click-ownership-decomposition-runs.csv
- Exists: True
- Rows: 3
- Columns: run_id, source_status, inp_ms, input_delay_ms, processing_ms, presentation_delay_ms, selected_task_ms, selected_task_self_reported, calltree_root_ms, event_type, event_ms, run_microtasks_ms, branch_1_label, branch_1_ms, branch_1_percent_of_selected_root, branch_1_percent_of_microtasks, branch_1_url, branch_2_label, branch_2_ms, branch_2_percent_of_selected_root, branch_2_percent_of_microtasks, branch_2_url, function_call_ms, notes

## bench/p0/product-trace-event-tree-snippets.csv
- Exists: True
- Rows: 14
- Columns: snippet_id, linked_source_row_id, run_label, session_turns, scenario_notes, task_duration_ms, task_self_reported, task_system_self_ms, task_system_children_ms, task_scripting_ms, task_rendering_ms, task_total_ms, event_type, event_duration_ms, event_self_reported, event_scripting_self_ms, event_scripting_children_ms, event_rendering_ms, event_system_ms, event_total_ms, run_microtasks_duration_ms, run_microtasks_self_reported, run_microtasks_scripting_self_ms, run_microtasks_scripting_children_ms, run_microtasks_rendering_ms, run_microtasks_system_ms, run_microtasks_total_ms, dominant_chain, source_status, notes

## bench/p0/product-trace-n-sweep.csv
- Exists: True
- Rows: 16
- Columns: source_row_id, run_id, turn_bucket, output_class, session_turns, timestamp_utc, recording_duration_s, click_ms, microtasks_ms, scripting_ms, rendering_ms, inp_ms, input_delay_ms, processing_ms, presentation_ms, long_task_total_ms, dominant_family, notes, source_status

Raw trace-derived CSVs should be reviewed before public release and may remain excluded from the public repository if they contain trace-specific details.
