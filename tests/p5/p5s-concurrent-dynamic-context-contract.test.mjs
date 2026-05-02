import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = fileURLToPath(
  new URL("../../bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json", import.meta.url)
);
const b2sTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5s_b2c_concurrent_dynamic_context_stress.html", import.meta.url)
);
const r0sTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5s_r0c_concurrent_dynamic_context_stress.html", import.meta.url)
);
const b2sRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5s_b2c_concurrent_dynamic_context_stress.mjs", import.meta.url)
);
const r0sRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5s_r0c_concurrent_dynamic_context_stress.mjs", import.meta.url)
);
const b2sCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5s_manual_b2c_concurrent_dynamic_context_results.mjs", import.meta.url)
);
const r0sCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5s_manual_r0c_concurrent_dynamic_context_results.mjs", import.meta.url)
);

const expectedScenarioIds = [
  "p5d_v10000_rich_ctx_full_repeat3",
  "p5d_v25000_rich_ctx_medium_repeat3",
  "p5d_v25000_rich_ctx_full_repeat3",
  "p5d_v50000_rich_ctx_medium_repeat2",
  "p5d_v50000_rich_ctx_full_repeat2"
];

const concurrentDynamicFields = [
  "concurrent_input_during_dynamic_context_update_proxy",
  "runConcurrentInputDuringDynamicContextUpdateProxy",
  "dynamic_update_input_delay_ms",
  "max_dynamic_update_input_delay_ms",
  "dynamic_update_typing_proxy_ms",
  "dynamic_update_send_work_ms",
  "rolling_tail_window_after_append",
  "dynamic_active_context_update_ms",
  "active_context_final_index_size",
  "expected_final_logical_block_count",
  "active_context_generation_count",
  "active_context_update_count",
  "compact_checksum_index",
  "active_context_entries_visited",
  "send_active_context_entries_visited"
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("P5-S concurrent dynamic-context files exist", () => {
  for (const filePath of [
    matrixPath,
    b2sTargetPath,
    r0sTargetPath,
    b2sRunnerPath,
    r0sRunnerPath,
    b2sCollectorPath,
    r0sCollectorPath
  ]) {
    assert.equal(fs.existsSync(filePath), true, `missing ${filePath}`);
  }
});

test("P5-S targets reuse the exact P5-D scenario ids", () => {
  const matrix = JSON.parse(read(matrixPath));
  assert.deepEqual(matrix.scenarios.map((scenario) => scenario.scenario_id), expectedScenarioIds);
  for (const source of [read(b2sTargetPath), read(r0sTargetPath)]) {
    for (const scenarioId of expectedScenarioIds) {
      assert.ok(source.includes(scenarioId), `missing scenario ${scenarioId}`);
    }
    for (const needle of ["visible_block_count", "active_context_window", "send_click_repeat_count"]) {
      assert.ok(source.includes(needle), `missing ${needle}`);
    }
  }
});

test("P5-S B2s target exposes concurrent dynamic hooks and stays non-worker DOM", () => {
  const html = read(b2sTargetPath);
  for (const needle of [
    "p5s-b2c-summary-json",
    "__P5S_B2C_CONCURRENT_DYNAMIC_CONTEXT_SUMMARY__",
    "P5S_B2C_CONCURRENT_DYNAMIC_CONTEXT_STRESS",
    "b2c_virtualized_dom_compact_context_concurrent_dynamic_context",
    ...concurrentDynamicFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /new\s+Worker\b/);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-S R0s target exposes concurrent dynamic worker path", () => {
  const html = read(r0sTargetPath);
  for (const needle of [
    "p5s-r0c-summary-json",
    "__P5S_R0C_CONCURRENT_DYNAMIC_CONTEXT_SUMMARY__",
    "P5S_R0C_CONCURRENT_DYNAMIC_CONTEXT_STRESS",
    "r0c_worker_bounded_projection_compact_context_concurrent_dynamic_context",
    "new Worker",
    "Blob",
    "postMessage",
    "onmessage",
    "send_worker_processing_ms",
    "send_worker_active_context_traversal_ms",
    "send_worker_dynamic_active_context_update_ms",
    "send_worker_roundtrip_minus_processing_ms",
    "send_main_commit_ms",
    "send_projection_payload_estimated_bytes",
    "concurrent_worker_dynamic_context_processing_ms",
    "concurrent_worker_roundtrip_minus_processing_ms",
    "concurrent_main_commit_ms",
    ...concurrentDynamicFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-S collectors validate concurrent dynamic-context metrics and final logical count", () => {
  for (const source of [read(b2sCollectorPath), read(r0sCollectorPath)]) {
    for (const needle of [
      "dynamic_update_input_delay_ms",
      "max_dynamic_update_input_delay_ms",
      "dynamic_update_typing_proxy_ms",
      "dynamic_update_send_work_ms",
      "active_context_scan_mode must be compact_checksum_index",
      "dynamic_active_context_update_mode must be rolling_tail_window_after_append",
      "send_active_context_entries_visited must equal",
      "active_context_entries_visited must equal",
      "active_context_compact_index_size must equal active_context_window",
      "active_context_final_index_size must equal active_context_window",
      "expected_final_logical_block_count must equal",
      "logical_block_count must equal expected_final_logical_block_count",
      "active_context_update_count must equal send_click_repeat_count",
      "active_context_generation_count must be >= send_click_repeat_count + 1",
      "rendered DOM must remain bounded",
      "max_dynamic_update_input_delay_ms",
      "max_concurrent_dynamic_context_send_proxy_ms",
      "max_dynamic_update_typing_proxy_ms",
      "max_dynamic_update_send_work_ms",
      "valid_manual",
      "user_chrome_manual"
    ]) {
      assert.ok(source.includes(needle), `missing collector validation ${needle}`);
    }
  }
});

test("P5-S R0s collector validates worker-specific concurrent dynamic metrics", () => {
  const source = read(r0sCollectorPath);
  for (const needle of [
    "send_worker_processing_ms",
    "send_worker_active_context_traversal_ms",
    "send_worker_dynamic_active_context_update_ms",
    "send_worker_roundtrip_minus_processing_ms",
    "send_main_commit_ms",
    "send_projection_payload_estimated_bytes",
    "concurrent_worker_dynamic_context_processing_ms",
    "concurrent_worker_roundtrip_minus_processing_ms",
    "concurrent_main_commit_ms",
    "max_concurrent_worker_dynamic_context_processing_ms",
    "max_concurrent_worker_roundtrip_minus_processing_ms",
    "max_concurrent_main_commit_ms",
    "max_send_worker_dynamic_active_context_update_ms",
    "max_send_main_commit_ms",
    "concurrent_worker_roundtrip_minus_processing_ms must be >= 0"
  ]) {
    assert.ok(source.includes(needle), `missing R0s collector validation ${needle}`);
  }
});

test("P5-S collectors preserve explicit boundary language", () => {
  const b2sCollector = read(b2sCollectorPath);
  for (const needle of [
    "B2c concurrent-input dynamic active-context baseline only",
    "R0s",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "Event Timing",
    "frame stability",
    "runtime superiority",
    "impossible-zone success",
    "P4 eligibility"
  ]) {
    assert.ok(b2sCollector.includes(needle), `missing B2s boundary ${needle}`);
  }

  const r0sCollector = read(r0sCollectorPath);
  for (const needle of [
    "R0c concurrent-input dynamic active-context worker/bounded-projection path only",
    "B2s",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "Event Timing",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility"
  ]) {
    assert.ok(r0sCollector.includes(needle), `missing R0s boundary ${needle}`);
  }
});

test("P5-S URL generators print manual URLs and do not write results", () => {
  for (const runnerPath of [b2sRunnerPath, r0sRunnerPath]) {
    const source = read(runnerPath);
    assert.doesNotMatch(source, /writeFile|mkdir|createWriteStream/);
  }

  const b2sOutput = execFileSync(process.execPath, [b2sRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(b2sOutput, /scenario_count=5/);
  assert.match(b2sOutput, /file:\/\/.*p5s_b2c_concurrent_dynamic_context_stress\.html\?scenario_id=/);
  assert.match(b2sOutput, /#p5s-b2c-summary-json/);
  assert.match(b2sOutput, /concurrent_input_during_dynamic_context_update_proxy/);
  assert.match(b2sOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(b2sOutput, /collect_p5s_manual_b2c_concurrent_dynamic_context_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);

  const r0sOutput = execFileSync(process.execPath, [r0sRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(r0sOutput, /scenario_count=5/);
  assert.match(r0sOutput, /file:\/\/.*p5s_r0c_concurrent_dynamic_context_stress\.html\?scenario_id=/);
  assert.match(r0sOutput, /#p5s-r0c-summary-json/);
  assert.match(r0sOutput, /concurrent_input_during_dynamic_context_update_proxy/);
  assert.match(r0sOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(r0sOutput, /collect_p5s_manual_r0c_concurrent_dynamic_context_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);
});

test("P5-S files avoid product URLs and browser automation artifacts", () => {
  for (const filePath of [
    b2sTargetPath,
    r0sTargetPath,
    b2sRunnerPath,
    r0sRunnerPath,
    b2sCollectorPath,
    r0sCollectorPath
  ]) {
    const source = read(filePath);
    assert.doesNotMatch(source, /https?:\/\/(?:chatgpt|claude|gemini|bard|openai|anthropic|google)\b/i);
    assert.doesNotMatch(source, /remote-debugging|CDP|Chrome DevTools Protocol|WebSocket/i);
    assert.doesNotMatch(source, /page\.screenshot|screenshot\s*\(|recordVideo|tracing\.start|tracePath|videoPath/i);
  }
});
