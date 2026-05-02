import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = fileURLToPath(
  new URL("../../bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json", import.meta.url)
);
const b2oTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5o_b2c_commit_window_input_stress.html", import.meta.url)
);
const r0oTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5o_r0c_commit_window_input_stress.html", import.meta.url)
);
const b2oRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5o_b2c_commit_window_input_stress.mjs", import.meta.url)
);
const r0oRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5o_r0c_commit_window_input_stress.mjs", import.meta.url)
);
const b2oCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5o_manual_b2c_commit_window_results.mjs", import.meta.url)
);
const r0oCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5o_manual_r0c_commit_window_results.mjs", import.meta.url)
);

const expectedScenarioIds = [
  "p5d_v10000_rich_ctx_full_repeat3",
  "p5d_v25000_rich_ctx_medium_repeat3",
  "p5d_v25000_rich_ctx_full_repeat3",
  "p5d_v50000_rich_ctx_medium_repeat2",
  "p5d_v50000_rich_ctx_full_repeat2"
];

const commitWindowFields = [
  "commit_window_input_during_send_proxy",
  "runCommitWindowInputDuringSendProxy",
  "commit_window_input_during_send_proxy_ms",
  "commit_window_input_delay_ms",
  "commit_window_input_scheduled_at_ms",
  "commit_window_input_started_at_ms",
  "commit_window_typing_proxy_ms",
  "commit_window_send_work_ms",
  "commit_window_total_proxy_ms",
  "commit_window_main_commit_ms",
  "max_commit_window_input_delay_ms",
  "max_commit_window_main_commit_ms",
  "compact_checksum_index",
  "active_context_entries_visited",
  "send_active_context_entries_visited"
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("P5-O commit-window files exist", () => {
  for (const filePath of [
    matrixPath,
    b2oTargetPath,
    r0oTargetPath,
    b2oRunnerPath,
    r0oRunnerPath,
    b2oCollectorPath,
    r0oCollectorPath
  ]) {
    assert.equal(fs.existsSync(filePath), true, `missing ${filePath}`);
  }
});

test("P5-O targets reuse the exact P5-D scenario ids", () => {
  const matrix = JSON.parse(read(matrixPath));
  assert.deepEqual(matrix.scenarios.map((scenario) => scenario.scenario_id), expectedScenarioIds);
  for (const source of [read(b2oTargetPath), read(r0oTargetPath)]) {
    for (const scenarioId of expectedScenarioIds) {
      assert.ok(source.includes(scenarioId), `missing scenario ${scenarioId}`);
    }
    for (const needle of ["visible_block_count", "active_context_window", "send_click_repeat_count"]) {
      assert.ok(source.includes(needle), `missing ${needle}`);
    }
  }
});

test("P5-O B2o target exposes commit-window hooks and stays non-worker DOM", () => {
  const html = read(b2oTargetPath);
  for (const needle of [
    "p5o-b2c-summary-json",
    "__P5O_B2C_COMMIT_WINDOW_SUMMARY__",
    "P5O_B2C_COMMIT_WINDOW_INPUT_STRESS",
    "b2c_virtualized_dom_compact_context_commit_window_input",
    ...commitWindowFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /new\s+Worker\b/);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-O R0o target exposes commit-window worker path", () => {
  const html = read(r0oTargetPath);
  for (const needle of [
    "p5o-r0c-summary-json",
    "__P5O_R0C_COMMIT_WINDOW_SUMMARY__",
    "P5O_R0C_COMMIT_WINDOW_INPUT_STRESS",
    "r0c_worker_bounded_projection_compact_context_commit_window_input",
    "new Worker",
    "Blob",
    "postMessage",
    "onmessage",
    "send_worker_processing_ms",
    "send_worker_active_context_traversal_ms",
    "send_worker_roundtrip_minus_processing_ms",
    "send_main_commit_ms",
    "send_projection_payload_estimated_bytes",
    "commit_window_worker_send_processing_ms",
    "commit_window_worker_roundtrip_minus_processing_ms",
    ...commitWindowFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-O collectors validate commit-window metrics and entry count semantics", () => {
  for (const source of [read(b2oCollectorPath), read(r0oCollectorPath)]) {
    for (const needle of [
      "commit_window_input_delay_ms",
      "max_commit_window_input_delay_ms",
      "commit_window_input_during_send_proxy_ms",
      "commit_window_typing_proxy_ms",
      "commit_window_main_commit_ms",
      "max_commit_window_main_commit_ms",
      "commit_window_total_proxy_ms",
      "active_context_scan_mode must be compact_checksum_index",
      "dynamic_active_context_update_mode must be static_initial_active_context",
      "send_active_context_entries_visited must equal",
      "active_context_window * scenario.send_click_repeat_count",
      "active_context_compact_index_size must equal active_context_window",
      "logical_block_count must be >= visible_block_count",
      "rendered DOM must remain bounded",
      "valid_manual",
      "user_chrome_manual"
    ]) {
      assert.ok(source.includes(needle), `missing collector validation ${needle}`);
    }
  }
});

test("P5-O R0o collector validates worker-specific commit-window metrics", () => {
  const source = read(r0oCollectorPath);
  for (const needle of [
    "send_worker_processing_ms",
    "send_worker_active_context_traversal_ms",
    "send_worker_roundtrip_minus_processing_ms",
    "send_main_commit_ms",
    "send_projection_payload_estimated_bytes",
    "commit_window_worker_send_processing_ms",
    "commit_window_worker_roundtrip_minus_processing_ms",
    "max_commit_window_worker_send_processing_ms",
    "max_commit_window_worker_roundtrip_minus_processing_ms",
    "commit_window_worker_roundtrip_minus_processing_ms must be >= 0"
  ]) {
    assert.ok(source.includes(needle), `missing R0o collector validation ${needle}`);
  }
});

test("P5-O collectors preserve explicit boundary language", () => {
  const b2oCollector = read(b2oCollectorPath);
  for (const needle of [
    "B2c commit-window compact-context baseline only",
    "R0o",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "frame stability",
    "runtime superiority",
    "impossible-zone success",
    "P4 eligibility"
  ]) {
    assert.ok(b2oCollector.includes(needle), `missing B2o boundary ${needle}`);
  }

  const r0oCollector = read(r0oCollectorPath);
  for (const needle of [
    "R0c commit-window worker/bounded-projection compact-context path only",
    "B2o",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility"
  ]) {
    assert.ok(r0oCollector.includes(needle), `missing R0o boundary ${needle}`);
  }
});

test("P5-O URL generators print manual URLs and do not write results", () => {
  for (const runnerPath of [b2oRunnerPath, r0oRunnerPath]) {
    const source = read(runnerPath);
    assert.doesNotMatch(source, /writeFile|mkdir|createWriteStream/);
  }

  const b2oOutput = execFileSync(process.execPath, [b2oRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(b2oOutput, /scenario_count=5/);
  assert.match(b2oOutput, /file:\/\/.*p5o_b2c_commit_window_input_stress\.html\?scenario_id=/);
  assert.match(b2oOutput, /#p5o-b2c-summary-json/);
  assert.match(b2oOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(b2oOutput, /collect_p5o_manual_b2c_commit_window_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);

  const r0oOutput = execFileSync(process.execPath, [r0oRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(r0oOutput, /scenario_count=5/);
  assert.match(r0oOutput, /file:\/\/.*p5o_r0c_commit_window_input_stress\.html\?scenario_id=/);
  assert.match(r0oOutput, /#p5o-r0c-summary-json/);
  assert.match(r0oOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(r0oOutput, /collect_p5o_manual_r0c_commit_window_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);
});

test("P5-O files avoid product URLs and browser automation artifacts", () => {
  for (const filePath of [
    b2oTargetPath,
    r0oTargetPath,
    b2oRunnerPath,
    r0oRunnerPath,
    b2oCollectorPath,
    r0oCollectorPath
  ]) {
    const source = read(filePath);
    assert.doesNotMatch(source, /https?:\/\/(?:chatgpt|claude|gemini|bard|openai|anthropic|google)\b/i);
    assert.doesNotMatch(source, /remote-debugging|CDP|Chrome DevTools Protocol|WebSocket/i);
    assert.doesNotMatch(source, /page\.screenshot|screenshot\s*\(|recordVideo|tracing\.start|tracePath|videoPath/i);
  }
});
