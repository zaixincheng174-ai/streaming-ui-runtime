#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = path.join(repoRoot, "bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json");
const resultPath = path.join(repoRoot, "bench/p5/results/p5i_r0_compact_context_results.json");
const targetPath = "bench/p5/targets/p5i_r0_compact_context_stress.html";
const runnerLabel = "p5i_r0_compact_context_manual_matrix";
const browserMode = "user_chrome_manual";
const baselineVariant = "r0_p3_derived_worker_bounded_projection_compact_context";

const requiredCommonMetricFields = [
  "scenario_id",
  "visible_block_count",
  "active_context_mode",
  "active_context_window",
  "block_shape",
  "rich_block_multiplier",
  "send_click_repeat_count",
  "initial_render_ms",
  "dom_node_count",
  "typing_proxy_ms",
  "send_click_proxy_ms",
  "scroll_jump_return_ms",
  "active_context_traversal_ms",
  "tail_mutation_ms",
  "append_commit_ms",
  "max_interaction_ms",
  "long_task_like_count_50ms_proxy",
  "long_task_like_count_100ms_proxy",
  "long_task_like_count_200ms_proxy",
  "timestamp",
  "run_id"
];

const requiredProjectionMetricFields = [
  "visible_window_size",
  "logical_block_count",
  "rendered_block_count",
  "rendered_dom_node_count",
  "virtual_window_render_ms",
  "old_history_window_render_ms",
  "tail_window_render_ms"
];

const requiredR0MetricFields = [
  "worker_init_ms",
  "worker_roundtrip_ms",
  "worker_processing_ms",
  "worker_active_context_traversal_ms",
  "worker_tail_mutation_ms",
  "worker_append_ms",
  "worker_projection_ms",
  "main_commit_ms",
  "projection_block_count",
  "commit_cycle_count",
  "admitted_transaction_count",
  "rejected_transaction_count",
  "anchor_transition_label"
];

const requiredR0PhaseMetricFields = [
  "init_worker_roundtrip_ms",
  "init_worker_processing_ms",
  "init_worker_projection_ms",
  "init_main_commit_ms",
  "typing_worker_roundtrip_ms",
  "typing_worker_processing_ms",
  "send_worker_roundtrip_ms",
  "send_worker_processing_ms",
  "send_worker_active_context_traversal_ms",
  "send_worker_tail_mutation_ms",
  "send_worker_append_ms",
  "send_worker_projection_ms",
  "send_main_commit_ms",
  "send_end_to_end_ms",
  "scroll_old_worker_roundtrip_ms",
  "scroll_old_worker_processing_ms",
  "scroll_old_worker_projection_ms",
  "scroll_old_main_commit_ms",
  "scroll_tail_worker_roundtrip_ms",
  "scroll_tail_worker_processing_ms",
  "scroll_tail_worker_projection_ms",
  "scroll_tail_main_commit_ms",
  "max_phase_worker_roundtrip_ms",
  "max_phase_worker_processing_ms",
  "max_phase_worker_projection_ms",
  "max_phase_main_commit_ms"
];

const requiredConfoundMetricFields = [
  "send_worker_roundtrip_minus_processing_ms",
  "max_phase_worker_roundtrip_minus_processing_ms",
  "init_worker_roundtrip_minus_processing_ms",
  "typing_worker_roundtrip_minus_processing_ms",
  "scroll_old_worker_roundtrip_minus_processing_ms",
  "scroll_tail_worker_roundtrip_minus_processing_ms",
  "send_projection_payload_block_count",
  "send_projection_payload_estimated_bytes",
  "max_projection_payload_estimated_bytes",
  "projection_payload_estimate_mode",
  "active_context_entries_visited",
  "send_active_context_entries_visited",
  "active_context_scan_mode",
  "dynamic_active_context_update_mode"
];

const requiredCompactMetricFields = [
  "active_context_compact_index_size",
  "active_context_compact_scan_units",
  "compact_checksum_mode",
  "compact_index_build_ms",
  "send_active_context_compact_scan_ms"
];

const requiredScrollBatchMetricFields = [
  "scroll_batched_worker_roundtrip_ms",
  "scroll_batched_worker_processing_ms",
  "scroll_batched_worker_projection_ms",
  "scroll_batched_roundtrip_minus_processing_ms",
  "scroll_batched_projection_payload_estimated_bytes",
  "scroll_batched_projection_payload_block_count",
  "scroll_batched_main_commit_ms",
  "scroll_batched_old_main_commit_ms",
  "scroll_batched_tail_main_commit_ms",
  "scroll_batch_mode"
];

const requiredMetricFields = [
  ...requiredCommonMetricFields,
  ...requiredProjectionMetricFields,
  ...requiredR0MetricFields,
  ...requiredR0PhaseMetricFields,
  ...requiredConfoundMetricFields,
  ...requiredCompactMetricFields,
  ...requiredScrollBatchMetricFields
];

const stringMetricFields = new Set([
  "scenario_id",
  "active_context_mode",
  "block_shape",
  "timestamp",
  "run_id",
  "anchor_transition_label",
  "projection_payload_estimate_mode",
  "active_context_scan_mode",
  "dynamic_active_context_update_mode",
  "compact_checksum_mode",
  "scroll_batch_mode"
]);

const numericMetricFields = requiredMetricFields.filter((field) => !stringMetricFields.has(field));

const boundary = {
  baseline: "R0c P3-derived worker/bounded-projection compact-context path only",
  does_not_measure: [
    "B0 new measurement",
    "B1 new measurement",
    "B2 original new measurement",
    "R0 original new measurement",
    "B2c",
    "B3",
    "browser-level INP",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility"
  ],
  notes:
    "P5-I measures R0c P3-derived worker/bounded-projection compact-context proxy metrics only. It preserves full logical transcript and active-context entry visits while replacing full string scan with a compact checksum index. It does not prove runtime superiority and does not authorize P4."
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
    notes: "Manual user Chrome run; R0c P3-derived worker/bounded-projection compact-context stress proxy metrics only."
  }));

  const result = {
    schema_version: "p5i.r0-compact-context-results.v0",
    generated_at: new Date().toISOString(),
    collection_mode: "manual_user_chrome",
    target: targetPath,
    scenario_count: expectedScenarios.length,
    boundary,
    rows: resultRows,
    summary: {
      max_initial_render_ms: maxMetric(resultRows, "initial_render_ms"),
      max_send_click_proxy_ms: maxMetric(resultRows, "send_click_proxy_ms"),
      max_scroll_jump_return_ms: maxMetric(resultRows, "scroll_jump_return_ms"),
      max_typing_proxy_ms: maxMetric(resultRows, "typing_proxy_ms"),
      max_long_task_like_count_50ms_proxy: maxMetric(resultRows, "long_task_like_count_50ms_proxy"),
      max_long_task_like_count_100ms_proxy: maxMetric(resultRows, "long_task_like_count_100ms_proxy"),
      max_long_task_like_count_200ms_proxy: maxMetric(resultRows, "long_task_like_count_200ms_proxy"),
      max_dom_node_count: maxMetric(resultRows, "dom_node_count"),
      max_rendered_dom_node_count: maxMetric(resultRows, "rendered_dom_node_count"),
      max_logical_block_count: maxMetric(resultRows, "logical_block_count"),
      max_active_context_entries_visited: maxMetric(resultRows, "active_context_entries_visited"),
      max_send_active_context_entries_visited: maxMetric(resultRows, "send_active_context_entries_visited"),
      max_active_context_compact_index_size: maxMetric(resultRows, "active_context_compact_index_size"),
      max_active_context_compact_scan_units: maxMetric(resultRows, "active_context_compact_scan_units"),
      max_compact_index_build_ms: maxMetric(resultRows, "compact_index_build_ms"),
      max_send_active_context_compact_scan_ms: maxMetric(resultRows, "send_active_context_compact_scan_ms"),
      max_send_worker_processing_ms: maxMetric(resultRows, "send_worker_processing_ms"),
      max_send_worker_active_context_traversal_ms: maxMetric(resultRows, "send_worker_active_context_traversal_ms"),
      max_send_worker_roundtrip_minus_processing_ms: maxMetric(resultRows, "send_worker_roundtrip_minus_processing_ms"),
      max_send_main_commit_ms: maxMetric(resultRows, "send_main_commit_ms"),
      max_send_projection_payload_estimated_bytes: maxMetric(resultRows, "send_projection_payload_estimated_bytes"),
      max_scroll_batched_worker_roundtrip_ms: maxMetric(resultRows, "scroll_batched_worker_roundtrip_ms"),
      max_scroll_batched_worker_processing_ms: maxMetric(resultRows, "scroll_batched_worker_processing_ms"),
      max_scroll_batched_roundtrip_minus_processing_ms: maxMetric(
        resultRows,
        "scroll_batched_roundtrip_minus_processing_ms"
      ),
      max_scroll_batched_main_commit_ms: maxMetric(resultRows, "scroll_batched_main_commit_ms"),
      max_scroll_batched_projection_payload_estimated_bytes: maxMetric(
        resultRows,
        "scroll_batched_projection_payload_estimated_bytes"
      ),
      active_context_scan_modes: uniqueStrings(resultRows, "active_context_scan_mode"),
      dynamic_active_context_update_modes: uniqueStrings(resultRows, "dynamic_active_context_update_mode"),
      scroll_batch_modes: uniqueStrings(resultRows, "scroll_batch_mode"),
      scenario_ids: expectedScenarios.map((scenario) => scenario.scenario_id)
    }
  };

  await fsp.mkdir(path.dirname(resultPath), { recursive: true });
  await fsp.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log("P5-I Manual R0c Compact Context Result Collector");
  console.log(`input=${path.relative(repoRoot, inputPath)}`);
  console.log(`output=${path.relative(repoRoot, resultPath)}`);
  console.log(`rows=${resultRows.length}`);
  console.log(`max_send_click_proxy_ms=${formatMetric(result.summary.max_send_click_proxy_ms)}`);
  console.log(`max_send_worker_processing_ms=${formatMetric(result.summary.max_send_worker_processing_ms)}`);
  console.log(`max_send_active_context_entries_visited=${formatMetric(result.summary.max_send_active_context_entries_visited)}`);
  console.log(`max_send_active_context_compact_scan_ms=${formatMetric(result.summary.max_send_active_context_compact_scan_ms)}`);
  console.log("AUDIT_STATUS=PASS");
}

function usage() {
  console.error("Usage:");
  console.error(
    "  node scripts/p5/collect_p5i_manual_r0_compact_results.mjs bench/p5/results/p5i_r0_compact_context_results.manual-input.json"
  );
}

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing ${label}: ${filePath}`);
  }
}

function normalizeInputRows(input) {
  if (Array.isArray(input)) {
    return input;
  }
  if (typeof input === "object" && input != null && Array.isArray(input.rows)) {
    return input.rows;
  }
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
    if (!scenario) {
      throw new Error(`unexpected scenario_id: ${row.scenario_id}`);
    }
    if (seen.has(row.scenario_id)) {
      throw new Error(`duplicate scenario_id: ${row.scenario_id}`);
    }
    seen.add(row.scenario_id);

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
    for (const field of ["timestamp", "run_id", "anchor_transition_label"]) {
      if (typeof row[field] !== "string" || row[field] === "") {
        throw new Error(`${row.scenario_id} ${field} must be a non-empty string`);
      }
    }
    if (row.active_context_scan_mode !== "compact_checksum_index") {
      throw new Error(`${row.scenario_id} active_context_scan_mode must be compact_checksum_index`);
    }
    if (row.dynamic_active_context_update_mode !== "static_initial_active_context") {
      throw new Error(`${row.scenario_id} dynamic_active_context_update_mode must be static_initial_active_context`);
    }
    if (row.compact_checksum_mode !== "numeric_precomputed_weight") {
      throw new Error(`${row.scenario_id} compact_checksum_mode must be numeric_precomputed_weight`);
    }
    if (row.scroll_batch_mode !== "old_and_tail_single_worker_message") {
      throw new Error(`${row.scenario_id} scroll_batch_mode must be old_and_tail_single_worker_message`);
    }
    for (const field of numericMetricFields) {
      if (!Number.isFinite(row[field])) {
        throw new Error(`${row.scenario_id} ${field} must be a finite number`);
      }
    }
    if (row.scroll_batched_roundtrip_minus_processing_ms < 0) {
      throw new Error(`${row.scenario_id} scroll_batched_roundtrip_minus_processing_ms must be >= 0`);
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
    if (row.logical_block_count < row.visible_block_count) {
      throw new Error(`${row.scenario_id} logical_block_count must be >= visible_block_count`);
    }
    if (row.rendered_block_count > row.visible_window_size) {
      throw new Error(`${row.scenario_id} rendered_block_count must be <= visible_window_size`);
    }
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
  console.error(`P5-I R0c manual collector failed: ${error.message}`);
  process.exit(1);
});
