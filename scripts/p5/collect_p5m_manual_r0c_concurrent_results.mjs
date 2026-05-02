#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = path.join(repoRoot, "bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json");
const resultPath = path.join(repoRoot, "bench/p5/results/p5m_r0c_concurrent_input_results.json");
const targetPath = "bench/p5/targets/p5m_r0c_concurrent_input_stress.html";
const runnerLabel = "p5m_r0c_concurrent_input_manual_matrix";
const browserMode = "user_chrome_manual";
const baselineVariant = "r0c_worker_bounded_projection_compact_context_concurrent_input";

const commonMetricFields = [
  "scenario_id",
  "visible_block_count",
  "active_context_mode",
  "active_context_window",
  "block_shape",
  "rich_block_multiplier",
  "send_click_repeat_count",
  "baseline_variant",
  "initial_render_ms",
  "dom_node_count",
  "rendered_dom_node_count",
  "logical_block_count",
  "rendered_block_count",
  "typing_proxy_ms",
  "send_click_proxy_ms",
  "concurrent_input_during_send_proxy_ms",
  "concurrent_input_delay_ms",
  "concurrent_input_scheduled_at_ms",
  "concurrent_input_started_at_ms",
  "concurrent_typing_proxy_ms",
  "concurrent_send_work_ms",
  "max_interaction_ms",
  "long_task_like_count_50ms_proxy",
  "long_task_like_count_100ms_proxy",
  "long_task_like_count_200ms_proxy",
  "active_context_scan_mode",
  "dynamic_active_context_update_mode",
  "active_context_entries_visited",
  "send_active_context_entries_visited",
  "active_context_compact_index_size",
  "active_context_compact_scan_units",
  "compact_checksum_mode",
  "compact_index_build_ms",
  "send_active_context_compact_scan_ms",
  "timestamp",
  "run_id"
];

const r0MetricFields = [
  "send_worker_processing_ms",
  "send_worker_active_context_traversal_ms",
  "send_worker_roundtrip_minus_processing_ms",
  "send_main_commit_ms",
  "send_projection_payload_estimated_bytes",
  "concurrent_worker_send_processing_ms",
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

const numericMetricFields = requiredMetricFields.filter((field) => !stringMetricFields.has(field));

const boundary = {
  baseline: "R0c concurrent-input worker/bounded-projection compact-context path only",
  does_not_measure: [
    "B2m",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility"
  ],
  notes:
    "P5-M measures R0c concurrent-input internal scheduling-delay proxy metrics only. It preserves the P5-D matrix, compact active-context semantics, full logical transcript, tail mutation, append stream, and bounded rendered window."
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
    notes: "Manual user Chrome run; R0c concurrent-input worker/bounded-projection compact-context proxy metrics only."
  }));

  const result = {
    schema_version: "p5m.r0c-concurrent-input-results.v0",
    generated_at: new Date().toISOString(),
    collection_mode: "manual_user_chrome",
    target: targetPath,
    scenario_count: expectedScenarios.length,
    boundary,
    rows: resultRows,
    summary: {
      max_concurrent_input_delay_ms: maxMetric(resultRows, "concurrent_input_delay_ms"),
      max_concurrent_input_during_send_proxy_ms: maxMetric(resultRows, "concurrent_input_during_send_proxy_ms"),
      max_concurrent_typing_proxy_ms: maxMetric(resultRows, "concurrent_typing_proxy_ms"),
      max_concurrent_send_work_ms: maxMetric(resultRows, "concurrent_send_work_ms"),
      max_send_click_proxy_ms: maxMetric(resultRows, "send_click_proxy_ms"),
      max_send_active_context_entries_visited: maxMetric(resultRows, "send_active_context_entries_visited"),
      max_rendered_dom_node_count: maxMetric(resultRows, "rendered_dom_node_count"),
      max_logical_block_count: maxMetric(resultRows, "logical_block_count"),
      active_context_scan_modes: uniqueStrings(resultRows, "active_context_scan_mode"),
      dynamic_active_context_update_modes: uniqueStrings(resultRows, "dynamic_active_context_update_mode"),
      max_concurrent_worker_send_processing_ms: maxMetric(resultRows, "concurrent_worker_send_processing_ms"),
      max_concurrent_worker_roundtrip_minus_processing_ms: maxMetric(
        resultRows,
        "concurrent_worker_roundtrip_minus_processing_ms"
      ),
      max_concurrent_main_commit_ms: maxMetric(resultRows, "concurrent_main_commit_ms"),
      max_send_worker_processing_ms: maxMetric(resultRows, "send_worker_processing_ms"),
      max_send_main_commit_ms: maxMetric(resultRows, "send_main_commit_ms"),
      scenario_ids: expectedScenarios.map((scenario) => scenario.scenario_id)
    }
  };

  await fsp.mkdir(path.dirname(resultPath), { recursive: true });
  await fsp.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log("P5-M Manual R0c Concurrent Input Result Collector");
  console.log(`input=${path.relative(repoRoot, inputPath)}`);
  console.log(`output=${path.relative(repoRoot, resultPath)}`);
  console.log(`rows=${resultRows.length}`);
  console.log(`max_concurrent_input_delay_ms=${formatMetric(result.summary.max_concurrent_input_delay_ms)}`);
  console.log(`max_concurrent_worker_send_processing_ms=${formatMetric(result.summary.max_concurrent_worker_send_processing_ms)}`);
  console.log("AUDIT_STATUS=PASS");
}

function usage() {
  console.error("Usage:");
  console.error(
    "  node scripts/p5/collect_p5m_manual_r0c_concurrent_results.mjs bench/p5/results/p5m_r0c_concurrent_input_results.manual-input.json"
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
    if (row.baseline_variant !== baselineVariant) {
      throw new Error(`${row.scenario_id} baseline_variant must be ${baselineVariant}`);
    }
    validateSharedMetrics(row, scenario);
    for (const field of r0MetricFields) {
      if (!Number.isFinite(row[field])) {
        throw new Error(`${row.scenario_id} ${field} must be a finite number`);
      }
    }
    if (row.concurrent_worker_roundtrip_minus_processing_ms < 0) {
      throw new Error(`${row.scenario_id} concurrent_worker_roundtrip_minus_processing_ms must be >= 0`);
    }
  }
}

function validateSharedMetrics(row, scenario) {
  if (row.active_context_scan_mode !== "compact_checksum_index") {
    throw new Error(`${row.scenario_id} active_context_scan_mode must be compact_checksum_index`);
  }
  if (row.dynamic_active_context_update_mode !== "static_initial_active_context") {
    throw new Error(`${row.scenario_id} dynamic_active_context_update_mode must be static_initial_active_context`);
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
  if (row.concurrent_input_delay_ms < 0) {
    throw new Error(`${row.scenario_id} concurrent_input_delay_ms must be >= 0`);
  }
  if (row.rendered_block_count > 300 || row.rendered_dom_node_count > 10000) {
    throw new Error(`${row.scenario_id} rendered DOM must remain bounded`);
  }
  if (row.logical_block_count < row.visible_block_count) {
    throw new Error(`${row.scenario_id} logical_block_count must be >= visible_block_count`);
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
  console.error(`P5-M R0c manual collector failed: ${error.message}`);
  process.exit(1);
});
