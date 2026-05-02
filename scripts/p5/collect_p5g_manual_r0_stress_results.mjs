#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = path.join(repoRoot, "bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json");
const resultPath = path.join(repoRoot, "bench/p5/results/p5g_r0_p3_runtime_stress_results.json");
const targetPath = "bench/p5/targets/p5g_r0_p3_runtime_stress.html";
const runnerLabel = "p5g_r0_p3_runtime_manual_matrix";
const browserMode = "user_chrome_manual";
const baselineVariant = "r0_p3_derived_worker_bounded_projection";

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

const requiredMetricFields = [
  ...requiredCommonMetricFields,
  ...requiredProjectionMetricFields,
  ...requiredR0MetricFields
];

const numericMetricFields = requiredMetricFields.filter(
  (field) =>
    ![
      "scenario_id",
      "active_context_mode",
      "block_shape",
      "timestamp",
      "run_id",
      "anchor_transition_label"
    ].includes(field)
);

const boundary = {
  baseline: "R0 P3-derived worker/bounded-projection runtime path only",
  does_not_measure: [
    "B0 new measurement",
    "B1 new measurement",
    "B2 new measurement",
    "B3",
    "browser-level INP",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility"
  ],
  notes:
    "P5-G measures R0 P3-derived worker/bounded-projection proxy metrics only. It does not prove final runtime superiority alone and does not authorize P4."
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
    notes: "Manual user Chrome run; R0 P3-derived worker/bounded-projection stress proxy metrics only."
  }));

  const result = {
    schema_version: "p5g.r0-p3-runtime-stress-results.v0",
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
      max_logical_block_count: maxMetric(resultRows, "logical_block_count"),
      max_rendered_block_count: maxMetric(resultRows, "rendered_block_count"),
      max_rendered_dom_node_count: maxMetric(resultRows, "rendered_dom_node_count"),
      max_worker_roundtrip_ms: maxMetric(resultRows, "worker_roundtrip_ms"),
      max_worker_processing_ms: maxMetric(resultRows, "worker_processing_ms"),
      max_worker_projection_ms: maxMetric(resultRows, "worker_projection_ms"),
      max_main_commit_ms: maxMetric(resultRows, "main_commit_ms"),
      max_commit_cycle_count: maxMetric(resultRows, "commit_cycle_count"),
      scenario_ids: expectedScenarios.map((scenario) => scenario.scenario_id)
    }
  };

  await fsp.mkdir(path.dirname(resultPath), { recursive: true });
  await fsp.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log("P5-G Manual R0 P3-Derived Runtime Stress Result Collector");
  console.log(`input=${path.relative(repoRoot, inputPath)}`);
  console.log(`output=${path.relative(repoRoot, resultPath)}`);
  console.log(`rows=${resultRows.length}`);
  console.log(`max_initial_render_ms=${formatMetric(result.summary.max_initial_render_ms)}`);
  console.log(`max_send_click_proxy_ms=${formatMetric(result.summary.max_send_click_proxy_ms)}`);
  console.log(`max_worker_processing_ms=${formatMetric(result.summary.max_worker_processing_ms)}`);
  console.log(`max_main_commit_ms=${formatMetric(result.summary.max_main_commit_ms)}`);
  console.log("AUDIT_STATUS=PASS");
}

function usage() {
  console.error("Usage:");
  console.error(
    "  node scripts/p5/collect_p5g_manual_r0_stress_results.mjs bench/p5/results/p5g_r0_p3_runtime_stress_results.manual-input.json"
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
    if (typeof row.timestamp !== "string" || row.timestamp === "") {
      throw new Error(`${row.scenario_id} timestamp must be a non-empty string`);
    }
    if (typeof row.run_id !== "string" || row.run_id === "") {
      throw new Error(`${row.scenario_id} run_id must be a non-empty string`);
    }
    if (typeof row.anchor_transition_label !== "string" || row.anchor_transition_label === "") {
      throw new Error(`${row.scenario_id} anchor_transition_label must be a non-empty string`);
    }
    for (const field of numericMetricFields) {
      if (!Number.isFinite(row[field])) {
        throw new Error(`${row.scenario_id} ${field} must be a finite number`);
      }
    }
    if (row.logical_block_count < row.visible_block_count) {
      throw new Error(`${row.scenario_id} logical_block_count must be >= visible_block_count`);
    }
    if (row.rendered_block_count > row.visible_window_size) {
      throw new Error(`${row.scenario_id} rendered_block_count must be <= visible_window_size`);
    }
    const estimatedFullDomNodeCount = estimateFullDomNodeCount(scenario);
    if (row.rendered_dom_node_count >= estimatedFullDomNodeCount / 10) {
      throw new Error(`${row.scenario_id} rendered_dom_node_count is not bounded relative to full DOM estimate`);
    }
  }

  const missing = expectedScenarios
    .map((scenario) => scenario.scenario_id)
    .filter((scenarioId) => !seen.has(scenarioId));
  if (missing.length > 0) {
    throw new Error(`missing scenario rows: ${missing.join(",")}`);
  }
}

function estimateFullDomNodeCount(scenario) {
  const baseNodes = 7;
  const metadataNodes = scenario.rich_block_multiplier + 2;
  const tokenNodes = scenario.rich_block_multiplier + 2;
  const artifactNodes = Math.floor(scenario.visible_block_count * scenario.artifact_placeholder_ratio);
  return scenario.visible_block_count * (baseNodes + metadataNodes + tokenNodes) + artifactNodes;
}

function pickRequiredFields(row) {
  return Object.fromEntries(requiredMetricFields.map((field) => [field, row[field]]));
}

function maxMetric(rows, key) {
  const values = rows.map((row) => row[key]).filter((value) => Number.isFinite(value));
  return values.length > 0 ? Math.max(...values) : null;
}

function formatMetric(value) {
  return Number.isFinite(value) ? value.toFixed(3) : "null";
}

main().catch((error) => {
  console.error(`P5-G manual collector failed: ${error.message}`);
  process.exit(1);
});
