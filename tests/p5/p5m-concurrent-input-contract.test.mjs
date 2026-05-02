import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = fileURLToPath(
  new URL("../../bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json", import.meta.url)
);
const b2mTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5m_b2c_concurrent_input_stress.html", import.meta.url)
);
const r0mTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5m_r0c_concurrent_input_stress.html", import.meta.url)
);
const b2mRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5m_b2c_concurrent_input_stress.mjs", import.meta.url)
);
const r0mRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5m_r0c_concurrent_input_stress.mjs", import.meta.url)
);
const b2mCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5m_manual_b2c_concurrent_results.mjs", import.meta.url)
);
const r0mCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5m_manual_r0c_concurrent_results.mjs", import.meta.url)
);

const expectedScenarioIds = [
  "p5d_v10000_rich_ctx_full_repeat3",
  "p5d_v25000_rich_ctx_medium_repeat3",
  "p5d_v25000_rich_ctx_full_repeat3",
  "p5d_v50000_rich_ctx_medium_repeat2",
  "p5d_v50000_rich_ctx_full_repeat2"
];

const concurrentFields = [
  "concurrent_input_during_send_proxy",
  "runConcurrentInputDuringSendProxy",
  "concurrent_input_during_send_proxy_ms",
  "concurrent_input_delay_ms",
  "concurrent_input_scheduled_at_ms",
  "concurrent_input_started_at_ms",
  "concurrent_typing_proxy_ms",
  "concurrent_send_work_ms",
  "compact_checksum_index",
  "active_context_entries_visited",
  "send_active_context_entries_visited"
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("P5-M concurrent-input files exist", () => {
  for (const filePath of [
    matrixPath,
    b2mTargetPath,
    r0mTargetPath,
    b2mRunnerPath,
    r0mRunnerPath,
    b2mCollectorPath,
    r0mCollectorPath
  ]) {
    assert.equal(fs.existsSync(filePath), true, `missing ${filePath}`);
  }
});

test("P5-M targets reuse the exact P5-D scenario ids", () => {
  const matrix = JSON.parse(read(matrixPath));
  assert.deepEqual(matrix.scenarios.map((scenario) => scenario.scenario_id), expectedScenarioIds);
  for (const source of [read(b2mTargetPath), read(r0mTargetPath)]) {
    for (const scenarioId of expectedScenarioIds) {
      assert.ok(source.includes(scenarioId), `missing scenario ${scenarioId}`);
    }
    for (const needle of ["visible_block_count", "active_context_window", "send_click_repeat_count"]) {
      assert.ok(source.includes(needle), `missing ${needle}`);
    }
  }
});

test("P5-M B2m target exposes concurrent hooks and stays non-worker DOM", () => {
  const html = read(b2mTargetPath);
  for (const needle of [
    "p5m-b2c-summary-json",
    "__P5M_B2C_CONCURRENT_SUMMARY__",
    "P5M_B2C_CONCURRENT_INPUT_STRESS",
    "b2c_virtualized_dom_compact_context_concurrent_input",
    ...concurrentFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /new\s+Worker\b/);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-M R0m target exposes concurrent worker path", () => {
  const html = read(r0mTargetPath);
  for (const needle of [
    "p5m-r0c-summary-json",
    "__P5M_R0C_CONCURRENT_SUMMARY__",
    "P5M_R0C_CONCURRENT_INPUT_STRESS",
    "r0c_worker_bounded_projection_compact_context_concurrent_input",
    "new Worker",
    "Blob",
    "postMessage",
    "onmessage",
    "send_worker_processing_ms",
    "concurrent_worker_send_processing_ms",
    "concurrent_worker_roundtrip_minus_processing_ms",
    "concurrent_main_commit_ms",
    ...concurrentFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-M collectors validate concurrent metrics and entry count semantics", () => {
  for (const source of [read(b2mCollectorPath), read(r0mCollectorPath)]) {
    for (const needle of [
      "concurrent_input_delay_ms must be >= 0",
      "concurrent_input_during_send_proxy_ms",
      "concurrent_typing_proxy_ms",
      "concurrent_send_work_ms",
      "active_context_scan_mode must be compact_checksum_index",
      "dynamic_active_context_update_mode must be static_initial_active_context",
      "send_active_context_entries_visited must equal",
      "active_context_window * scenario.send_click_repeat_count",
      "active_context_compact_index_size must equal active_context_window",
      "max_concurrent_input_delay_ms",
      "max_concurrent_input_during_send_proxy_ms",
      "max_concurrent_typing_proxy_ms",
      "max_concurrent_send_work_ms",
      "valid_manual",
      "user_chrome_manual"
    ]) {
      assert.ok(source.includes(needle), `missing collector validation ${needle}`);
    }
  }
});

test("P5-M R0m collector validates worker-specific concurrent metrics", () => {
  const source = read(r0mCollectorPath);
  for (const needle of [
    "concurrent_worker_send_processing_ms",
    "concurrent_worker_roundtrip_minus_processing_ms",
    "concurrent_main_commit_ms",
    "max_concurrent_worker_send_processing_ms",
    "max_concurrent_worker_roundtrip_minus_processing_ms",
    "max_concurrent_main_commit_ms",
    "concurrent_worker_roundtrip_minus_processing_ms must be >= 0"
  ]) {
    assert.ok(source.includes(needle), `missing R0m collector validation ${needle}`);
  }
});

test("P5-M collectors preserve explicit boundary language", () => {
  const b2mCollector = read(b2mCollectorPath);
  for (const needle of [
    "B2c concurrent-input compact-context baseline only",
    "R0m",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "frame stability",
    "runtime superiority",
    "impossible-zone success",
    "P4 eligibility"
  ]) {
    assert.ok(b2mCollector.includes(needle), `missing B2m boundary ${needle}`);
  }

  const r0mCollector = read(r0mCollectorPath);
  for (const needle of [
    "R0c concurrent-input worker/bounded-projection compact-context path only",
    "B2m",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility"
  ]) {
    assert.ok(r0mCollector.includes(needle), `missing R0m boundary ${needle}`);
  }
});

test("P5-M URL generators print manual URLs and do not write results", () => {
  const b2mOutput = execFileSync(process.execPath, [b2mRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(b2mOutput, /scenario_count=5/);
  assert.match(b2mOutput, /file:\/\/.*p5m_b2c_concurrent_input_stress\.html\?scenario_id=/);
  assert.match(b2mOutput, /#p5m-b2c-summary-json/);
  assert.match(b2mOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(b2mOutput, /collect_p5m_manual_b2c_concurrent_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);

  const r0mOutput = execFileSync(process.execPath, [r0mRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(r0mOutput, /scenario_count=5/);
  assert.match(r0mOutput, /file:\/\/.*p5m_r0c_concurrent_input_stress\.html\?scenario_id=/);
  assert.match(r0mOutput, /#p5m-r0c-summary-json/);
  assert.match(r0mOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(r0mOutput, /collect_p5m_manual_r0c_concurrent_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);
});

test("P5-M files avoid product URLs and browser automation artifacts", () => {
  for (const filePath of [
    b2mTargetPath,
    r0mTargetPath,
    b2mRunnerPath,
    r0mRunnerPath,
    b2mCollectorPath,
    r0mCollectorPath
  ]) {
    const source = read(filePath);
    assert.doesNotMatch(source, /https?:\/\/(?:chatgpt|claude|gemini|bard|openai|anthropic|google)\b/i);
    assert.doesNotMatch(source, /remote-debugging|CDP|Chrome DevTools Protocol|WebSocket/i);
    assert.doesNotMatch(source, /page\.screenshot|screenshot\s*\(|recordVideo|tracing\.start|tracePath|videoPath/i);
  }
});
