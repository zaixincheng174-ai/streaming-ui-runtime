#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = path.join(repoRoot, "bench/p5/scenarios/p5a_synthetic_impossible_zone_matrix.json");
const resultPath = path.join(repoRoot, "bench/p5/results/p5c_b0_naive_dom_matrix_results.json");
const targetPath = "bench/p5/targets/p5b_naive_dom_baseline.html";
const runnerLabel = "p5c_b0_naive_dom_manual_matrix";
const browserMode = "user_chrome_manual";

const requiredMetricFields = [
  "scenario_id",
  "visible_block_count",
  "active_context_mode",
  "active_context_window",
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
  "timestamp",
  "run_id"
];

const numericMetricFields = requiredMetricFields.filter(
  (field) => !["scenario_id", "active_context_mode", "timestamp", "run_id"].includes(field)
);

const boundary = {
  baseline: "B0 naive DOM only",
  does_not_measure: [
    "B1",
    "B2",
    "B3",
    "R0",
    "browser-level INP",
    "frame stability",
    "impossible-zone success",
    "runtime superiority",
    "P4 eligibility"
  ],
  notes:
    "P5-C manual collection records B0 naive DOM proxy metrics only and does not authorize P4."
};

async function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    usage();
    process.exit(1);
  }

  assertFile(matrixPath, "P5-A matrix");
  const inputPath = path.resolve(process.cwd(), inputArg);
  assertFile(inputPath, "manual input");

  const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  const expectedScenarios = Array.isArray(matrix.scenarios) ? matrix.scenarios : [];
  if (expectedScenarios.length !== 9) {
    throw new Error(`expected 9 P5-A scenarios, found ${expectedScenarios.length}`);
  }

  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const rows = normalizeInputRows(input);
  validateManualRows(rows, expectedScenarios);

  const resultRows = rows.map((row) => ({
    ...pickRequiredFields(row),
    runner_label: runnerLabel,
    browser_mode: browserMode,
    validity_label: "valid_manual",
    notes: "Manual user Chrome run; proxy metrics only."
  }));

  const result = {
    schema_version: "p5c.b0-naive-dom-matrix-results.v0",
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
      max_dom_node_count: maxMetric(resultRows, "dom_node_count"),
      scenario_ids: expectedScenarios.map((scenario) => scenario.scenario_id)
    }
  };

  await fsp.mkdir(path.dirname(resultPath), { recursive: true });
  await fsp.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log("P5-C Manual B0 Result Collector");
  console.log(`input=${path.relative(repoRoot, inputPath)}`);
  console.log(`output=${path.relative(repoRoot, resultPath)}`);
  console.log(`rows=${resultRows.length}`);
  console.log(`max_initial_render_ms=${formatMetric(result.summary.max_initial_render_ms)}`);
  console.log(`max_send_click_proxy_ms=${formatMetric(result.summary.max_send_click_proxy_ms)}`);
  console.log(`max_scroll_jump_return_ms=${formatMetric(result.summary.max_scroll_jump_return_ms)}`);
  console.log(`max_typing_proxy_ms=${formatMetric(result.summary.max_typing_proxy_ms)}`);
  console.log("AUDIT_STATUS=PASS");
}

function usage() {
  console.error("Usage:");
  console.error(
    "  node scripts/p5/collect_p5c_manual_b0_results.mjs bench/p5/results/p5c_b0_naive_dom_matrix_results.manual-input.json"
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

    if (row.visible_block_count !== scenario.visible_block_count) {
      throw new Error(`${row.scenario_id} visible_block_count mismatch`);
    }
    if (row.active_context_mode !== scenario.active_context_mode) {
      throw new Error(`${row.scenario_id} active_context_mode mismatch`);
    }
    if (row.active_context_window !== scenario.active_context_window) {
      throw new Error(`${row.scenario_id} active_context_window mismatch`);
    }
    if (typeof row.timestamp !== "string" || row.timestamp === "") {
      throw new Error(`${row.scenario_id} timestamp must be a non-empty string`);
    }
    if (typeof row.run_id !== "string" || row.run_id === "") {
      throw new Error(`${row.scenario_id} run_id must be a non-empty string`);
    }
    for (const field of numericMetricFields) {
      if (!Number.isFinite(row[field])) {
        throw new Error(`${row.scenario_id} ${field} must be a finite number`);
      }
    }
  }

  const missing = expectedScenarios
    .map((scenario) => scenario.scenario_id)
    .filter((scenarioId) => !seen.has(scenarioId));
  if (missing.length > 0) {
    throw new Error(`missing scenario rows: ${missing.join(",")}`);
  }
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
  console.error(`P5-C manual collector failed: ${error.message}`);
  process.exit(1);
});
