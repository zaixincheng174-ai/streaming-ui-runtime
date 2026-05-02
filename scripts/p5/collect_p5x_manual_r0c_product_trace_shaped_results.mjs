#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = path.join(repoRoot, "bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json");
const resultPath = path.join(repoRoot, "bench/p5/results/p5x_r0c_product_trace_shaped_results.json");
const targetPath = "bench/p5/targets/p5x_r0c_product_trace_shaped_stress.html";
const runnerLabel = "p5x_r0c_product_trace_shaped_manual_matrix";
const browserMode = "user_chrome_manual";
const baselineVariant = "r0c_worker_bounded_projection_compact_context_product_trace_shaped";
const expectedTracePhases = [
  "user_prompt_and_context_load",
  "assistant_streaming",
  "tool_call_and_result",
  "code_or_diff_review",
  "agent_status_and_summary"
];
const expectedTraceLanes = ["assistant_stream", "tool_call", "tool_result", "agent_status", "code_diff", "review_note"];

const commonMetricFields = [
  "scenario_id",
  "visible_block_count",
  "active_context_mode",
  "active_context_window",
  "block_shape",
  "rich_block_multiplier",
  "send_click_repeat_count",
  "baseline_variant",
  "trace_phase_count",
  "trace_phases",
  "trace_lane_count",
  "trace_lanes",
  "trace_event_count_per_repeat",
  "trace_events_processed",
  "assistant_stream_event_count",
  "tool_call_event_count",
  "tool_result_event_count",
  "agent_status_event_count",
  "code_diff_event_count",
  "review_note_event_count",
  "initial_render_ms",
  "dom_node_count",
  "rendered_dom_node_count",
  "logical_block_count",
  "rendered_block_count",
  "visible_window_size",
  "expected_final_logical_block_count",
  "typing_proxy_ms",
  "product_trace_shaped_proxy_ms",
  "concurrent_product_trace_proxy_ms",
  "concurrent_product_trace_input_delay_ms",
  "max_concurrent_product_trace_input_delay_ms",
  "concurrent_product_trace_input_scheduled_at_ms",
  "concurrent_product_trace_input_started_at_ms",
  "concurrent_product_trace_typing_proxy_ms",
  "product_trace_send_work_ms",
  "trace_event_merge_ms",
  "max_trace_event_merge_ms",
  "active_context_scan_mode",
  "dynamic_active_context_update_mode",
  "active_context_entries_visited",
  "send_active_context_entries_visited",
  "active_context_compact_index_size",
  "active_context_final_index_size",
  "active_context_compact_scan_units",
  "active_context_update_count",
  "active_context_generation_count",
  "active_context_entries_added",
  "active_context_entries_removed",
  "dynamic_active_context_update_ms",
  "max_dynamic_active_context_update_ms",
  "dynamic_active_context_rebuild_ms",
  "compact_checksum_mode",
  "compact_index_build_ms",
  "send_active_context_compact_scan_ms",
  "tail_mutation_ms",
  "append_commit_ms",
  "max_interaction_ms",
  "long_task_like_count_50ms_proxy",
  "long_task_like_count_100ms_proxy",
  "long_task_like_count_200ms_proxy",
  "timestamp",
  "run_id"
];

const r0MetricFields = [
  "worker_product_trace_processing_ms",
  "worker_trace_event_merge_ms",
  "worker_dynamic_active_context_update_ms",
  "worker_active_context_traversal_ms",
  "worker_roundtrip_minus_processing_ms",
  "main_commit_ms",
  "projection_payload_estimated_bytes",
  "concurrent_worker_product_trace_processing_ms",
  "concurrent_worker_roundtrip_minus_processing_ms",
  "concurrent_main_commit_ms"
];

const requiredMetricFields = [...commonMetricFields, ...r0MetricFields];

const stringMetricFields = new Set([
  "scenario_id",
  "active_context_mode",
  "block_shape",
  "baseline_variant",
  "active_context_scan_mode",
  "dynamic_active_context_update_mode",
  "compact_checksum_mode",
  "timestamp",
  "run_id"
]);

const arrayMetricFields = new Set(["trace_phases", "trace_lanes"]);
const numericMetricFields = requiredMetricFields.filter(
  (field) => !stringMetricFields.has(field) && !arrayMetricFields.has(field)
);

const boundary = {
  baseline: "R0c product-trace-shaped worker/bounded-projection path only",
  does_not_measure: [
    "B2x",
    "real product trace",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "Event Timing",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility"
  ],
  notes:
    "P5-X measures R0x product-trace-shaped Worker/bounded-projection proxy metrics only. It is a fictional synthetic trace, not a real product trace. It preserves the P5-D matrix, compact scan semantics, rolling-tail dynamic context, full logical transcript, tail mutation, append stream, and bounded rendered projection."
};

async function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    usage();
    process.exit(1);
  }

  assertFile(matrixPath, "P5-D matrix");
  const inputPath = path.resolve(process.cwd(), inputArg);
  assertFile(inputPath, "manual input");

  const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  const expectedScenarios = Array.isArray(matrix.scenarios) ? matrix.scenarios : [];
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const rows = normalizeInputRows(input);
  validateManualRows(rows, expectedScenarios);

  const resultRows = rows.map((row) => ({
    ...pickRequiredFields(row),
    runner_label: runnerLabel,
    browser_mode: browserMode,
    validity_label: "valid_manual",
    baseline_variant: baselineVariant,
    notes: "Manual user Chrome run; R0x product-trace-shaped synthetic proxy metrics only; not real product trace."
  }));

  const result = {
    schema_version: "p5x.r0c-product-trace-shaped-results.v0",
    generated_at: new Date().toISOString(),
    collection_mode: "manual_user_chrome",
    target: targetPath,
    scenario_count: expectedScenarios.length,
    boundary,
    rows: resultRows,
    summary: {
      max_concurrent_product_trace_input_delay_ms: maxMetric(resultRows, "concurrent_product_trace_input_delay_ms"),
      max_concurrent_product_trace_proxy_ms: maxMetric(resultRows, "concurrent_product_trace_proxy_ms"),
      max_product_trace_shaped_proxy_ms: maxMetric(resultRows, "product_trace_shaped_proxy_ms"),
      max_product_trace_send_work_ms: maxMetric(resultRows, "product_trace_send_work_ms"),
      max_trace_event_merge_ms: maxMetric(resultRows, "trace_event_merge_ms"),
      max_dynamic_active_context_update_ms: maxMetric(resultRows, "dynamic_active_context_update_ms"),
      max_trace_events_processed: maxMetric(resultRows, "trace_events_processed"),
      max_send_active_context_entries_visited: maxMetric(resultRows, "send_active_context_entries_visited"),
      max_logical_block_count: maxMetric(resultRows, "logical_block_count"),
      max_expected_final_logical_block_count: maxMetric(resultRows, "expected_final_logical_block_count"),
      max_rendered_dom_node_count: maxMetric(resultRows, "rendered_dom_node_count"),
      trace_phases: expectedTracePhases,
      trace_lanes: expectedTraceLanes,
      active_context_scan_modes: uniqueStrings(resultRows, "active_context_scan_mode"),
      dynamic_active_context_update_modes: uniqueStrings(resultRows, "dynamic_active_context_update_mode"),
      max_worker_product_trace_processing_ms: maxMetric(resultRows, "worker_product_trace_processing_ms"),
      max_worker_trace_event_merge_ms: maxMetric(resultRows, "worker_trace_event_merge_ms"),
      max_worker_dynamic_active_context_update_ms: maxMetric(resultRows, "worker_dynamic_active_context_update_ms"),
      max_worker_roundtrip_minus_processing_ms: maxMetric(resultRows, "worker_roundtrip_minus_processing_ms"),
      max_main_commit_ms: maxMetric(resultRows, "main_commit_ms"),
      max_concurrent_worker_product_trace_processing_ms: maxMetric(
        resultRows,
        "concurrent_worker_product_trace_processing_ms"
      ),
      max_concurrent_worker_roundtrip_minus_processing_ms: maxMetric(
        resultRows,
        "concurrent_worker_roundtrip_minus_processing_ms"
      ),
      max_concurrent_main_commit_ms: maxMetric(resultRows, "concurrent_main_commit_ms"),
      scenario_ids: expectedScenarios.map((scenario) => scenario.scenario_id)
    }
  };

  await fsp.mkdir(path.dirname(resultPath), { recursive: true });
  await fsp.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log("P5-X Manual R0x Product Trace Shaped Result Collector");
  console.log(`input=${path.relative(repoRoot, inputPath)}`);
  console.log(`output=${path.relative(repoRoot, resultPath)}`);
  console.log(`rows=${resultRows.length}`);
  console.log(`max_concurrent_product_trace_input_delay_ms=${formatMetric(result.summary.max_concurrent_product_trace_input_delay_ms)}`);
  console.log("AUDIT_STATUS=PASS");
}

function usage() {
  console.error("Usage:");
  console.error(
    "  node scripts/p5/collect_p5x_manual_r0c_product_trace_shaped_results.mjs bench/p5/results/p5x_r0c_product_trace_shaped_results.manual-input.json"
  );
}

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing ${label}: ${filePath}`);
  }
}

function normalizeInputRows(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === "object" && input != null && Array.isArray(input.rows)) return input.rows;
  throw new Error("manual input must be an array or an object with rows[]");
}

function validateManualRows(rows, expectedScenarios) {
  if (rows.length !== expectedScenarios.length) {
    throw new Error(`expected ${expectedScenarios.length} manual rows, found ${rows.length}`);
  }

  const expectedById = new Map(expectedScenarios.map((scenario) => [scenario.scenario_id, scenario]));
  const seen = new Set();
  for (const row of rows) {
    if (typeof row !== "object" || row == null || Array.isArray(row)) {
      throw new Error("each manual row must be an object");
    }
    for (const field of requiredMetricFields) {
      if (!(field in row)) {
        throw new Error(`manual row missing ${field}`);
      }
    }
    const scenario = expectedById.get(row.scenario_id);
    if (!scenario) throw new Error(`unexpected scenario_id: ${row.scenario_id}`);
    if (seen.has(row.scenario_id)) throw new Error(`duplicate scenario_id: ${row.scenario_id}`);
    seen.add(row.scenario_id);
    validateScenarioDimensions(row, scenario);
    validateStreamMetrics(row, scenario);
    validateDynamicContextMetrics(row, scenario);
    validateConcurrentMetrics(row);
    validateR0Metrics(row);
  }
}

function validateScenarioDimensions(row, scenario) {
  for (const field of [
    "visible_block_count",
    "active_context_mode",
    "active_context_window",
    "block_shape",
    "rich_block_multiplier",
    "send_click_repeat_count"
  ]) {
    if (row[field] !== scenario[field]) {
      throw new Error(`${row.scenario_id} ${field} mismatch`);
    }
  }
  if (row.baseline_variant !== baselineVariant) {
    throw new Error(`${row.scenario_id} baseline_variant must be ${baselineVariant}`);
  }
}

function validateStreamMetrics(row, scenario) {
  if (!Array.isArray(row.trace_phases) || row.trace_phases.join("|") !== expectedTracePhases.join("|")) {
    throw new Error(`${row.scenario_id} trace_phases must match expected synthetic phases`);
  }
  if (row.trace_phase_count !== 5) {
    throw new Error(`${row.scenario_id} trace_phase_count must equal 5`);
  }
  if (!Array.isArray(row.trace_lanes) || row.trace_lanes.join("|") !== expectedTraceLanes.join("|")) {
    throw new Error(`${row.scenario_id} trace_lanes must match expected synthetic lanes`);
  }
  if (row.trace_lane_count !== 6) {
    throw new Error(`${row.scenario_id} trace_lane_count must equal 6`);
  }
  if (row.trace_event_count_per_repeat !== scenario.append_batch_size) {
    throw new Error(`${row.scenario_id} trace_event_count_per_repeat must equal append_batch_size`);
  }
  const expectedTraceEvents = scenario.append_batch_size * scenario.send_click_repeat_count;
  if (row.trace_events_processed !== expectedTraceEvents) {
    throw new Error(`${row.scenario_id} trace_events_processed must equal ${expectedTraceEvents}`);
  }
  const laneTotal =
    row.assistant_stream_event_count +
    row.tool_call_event_count +
    row.tool_result_event_count +
    row.agent_status_event_count +
    row.code_diff_event_count +
    row.review_note_event_count;
  if (laneTotal !== row.trace_events_processed) {
    throw new Error(`${row.scenario_id} lane event counts must equal trace_events_processed`);
  }
}

function validateDynamicContextMetrics(row, scenario) {
  if (row.active_context_scan_mode !== "compact_checksum_index") {
    throw new Error(`${row.scenario_id} active_context_scan_mode must be compact_checksum_index`);
  }
  if (row.dynamic_active_context_update_mode !== "rolling_tail_window_after_append") {
    throw new Error(`${row.scenario_id} dynamic_active_context_update_mode must be rolling_tail_window_after_append`);
  }
  if (row.compact_checksum_mode !== "numeric_precomputed_weight") {
    throw new Error(`${row.scenario_id} compact_checksum_mode must be numeric_precomputed_weight`);
  }
  for (const field of ["timestamp", "run_id"]) {
    if (typeof row[field] !== "string" || row[field] === "") {
      throw new Error(`${row.scenario_id} ${field} must be a non-empty string`);
    }
  }
  for (const field of numericMetricFields) {
    if (!Number.isFinite(row[field])) {
      throw new Error(`${row.scenario_id} ${field} must be a finite number`);
    }
  }

  const expectedVisited = scenario.active_context_window * scenario.send_click_repeat_count;
  if (row.send_active_context_entries_visited !== expectedVisited) {
    throw new Error(`${row.scenario_id} send_active_context_entries_visited must equal ${expectedVisited}`);
  }
  if (row.active_context_entries_visited !== expectedVisited) {
    throw new Error(`${row.scenario_id} active_context_entries_visited must equal ${expectedVisited}`);
  }
  if (row.active_context_compact_index_size !== scenario.active_context_window) {
    throw new Error(`${row.scenario_id} active_context_compact_index_size must equal active_context_window`);
  }
  if (row.active_context_final_index_size !== scenario.active_context_window) {
    throw new Error(`${row.scenario_id} active_context_final_index_size must equal active_context_window`);
  }
  const expectedFinalLogicalBlockCount =
    scenario.visible_block_count + (scenario.append_batch_size * scenario.send_click_repeat_count);
  if (row.expected_final_logical_block_count !== expectedFinalLogicalBlockCount) {
    throw new Error(`${row.scenario_id} expected_final_logical_block_count must equal ${expectedFinalLogicalBlockCount}`);
  }
  if (row.logical_block_count !== expectedFinalLogicalBlockCount) {
    throw new Error(`${row.scenario_id} logical_block_count must equal expected_final_logical_block_count`);
  }
  if (row.active_context_update_count !== scenario.send_click_repeat_count) {
    throw new Error(`${row.scenario_id} active_context_update_count must equal send_click_repeat_count`);
  }
  if (row.active_context_generation_count < scenario.send_click_repeat_count + 1) {
    throw new Error(`${row.scenario_id} active_context_generation_count must be >= send_click_repeat_count + 1`);
  }
  if (row.rendered_block_count > 300 || row.rendered_dom_node_count > 10000) {
    throw new Error(`${row.scenario_id} rendered DOM must remain bounded`);
  }
}

function validateConcurrentMetrics(row) {
  for (const field of [
    "concurrent_product_trace_input_delay_ms",
    "max_concurrent_product_trace_input_delay_ms",
    "concurrent_product_trace_typing_proxy_ms",
    "product_trace_send_work_ms",
    "trace_event_merge_ms",
    "max_trace_event_merge_ms",
    "dynamic_active_context_update_ms",
    "max_dynamic_active_context_update_ms",
    "dynamic_active_context_rebuild_ms"
  ]) {
    if (!Number.isFinite(row[field]) || row[field] < 0) {
      throw new Error(`${row.scenario_id} ${field} must be finite and >= 0`);
    }
  }
}

function validateR0Metrics(row) {
  for (const field of r0MetricFields) {
    if (!Number.isFinite(row[field])) {
      throw new Error(`${row.scenario_id} ${field} must be a finite number`);
    }
  }
  if (row.worker_roundtrip_minus_processing_ms < 0) {
    throw new Error(`${row.scenario_id} worker_roundtrip_minus_processing_ms must be >= 0`);
  }
  if (row.concurrent_worker_roundtrip_minus_processing_ms < 0) {
    throw new Error(`${row.scenario_id} concurrent_worker_roundtrip_minus_processing_ms must be >= 0`);
  }
}

function pickRequiredFields(row) {
  return Object.fromEntries(requiredMetricFields.map((field) => [field, row[field]]));
}

function maxMetric(rows, key) {
  const values = rows.map((row) => row[key]).filter((value) => Number.isFinite(value));
  return values.length > 0 ? Math.max(...values) : null;
}

function uniqueStrings(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter((value) => typeof value === "string" && value !== ""))].sort();
}

function formatMetric(value) {
  return Number.isFinite(value) ? value.toFixed(3) : "null";
}

main().catch((error) => {
  console.error(`P5-X R0x manual collector failed: ${error.message}`);
  process.exit(1);
});
