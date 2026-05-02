import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = fileURLToPath(
  new URL("../../bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json", import.meta.url)
);
const b2qTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5q_b2c_dynamic_context_stress.html", import.meta.url)
);
const r0qTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5q_r0c_dynamic_context_stress.html", import.meta.url)
);
const b2qRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5q_b2c_dynamic_context_stress.mjs", import.meta.url)
);
const r0qRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5q_r0c_dynamic_context_stress.mjs", import.meta.url)
);
const b2qCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5q_manual_b2c_dynamic_context_results.mjs", import.meta.url)
);
const r0qCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5q_manual_r0c_dynamic_context_results.mjs", import.meta.url)
);

const expectedScenarioIds = [
  "p5d_v10000_rich_ctx_full_repeat3",
  "p5d_v25000_rich_ctx_medium_repeat3",
  "p5d_v25000_rich_ctx_full_repeat3",
  "p5d_v50000_rich_ctx_medium_repeat2",
  "p5d_v50000_rich_ctx_full_repeat2"
];

const dynamicContextFields = [
  "dynamic_context_send_proxy",
  "runDynamicContextSendProxy",
  "rolling_tail_window_after_append",
  "dynamic_active_context_update_ms",
  "max_dynamic_active_context_update_ms",
  "dynamic_active_context_rebuild_ms",
  "active_context_final_index_size",
  "expected_final_logical_block_count",
  "active_context_generation_count",
  "active_context_update_count",
  "active_context_entries_added",
  "active_context_entries_removed",
  "compact_checksum_index",
  "active_context_entries_visited",
  "send_active_context_entries_visited",
  "active_context_compact_index_size",
  "active_context_compact_scan_units"
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("P5-Q dynamic-context files exist", () => {
  for (const filePath of [
    matrixPath,
    b2qTargetPath,
    r0qTargetPath,
    b2qRunnerPath,
    r0qRunnerPath,
    b2qCollectorPath,
    r0qCollectorPath
  ]) {
    assert.equal(fs.existsSync(filePath), true, `missing ${filePath}`);
  }
});

test("P5-Q targets reuse the exact P5-D scenario ids", () => {
  const matrix = JSON.parse(read(matrixPath));
  assert.deepEqual(matrix.scenarios.map((scenario) => scenario.scenario_id), expectedScenarioIds);
  for (const source of [read(b2qTargetPath), read(r0qTargetPath)]) {
    for (const scenarioId of expectedScenarioIds) {
      assert.ok(source.includes(scenarioId), `missing scenario ${scenarioId}`);
    }
    for (const needle of ["visible_block_count", "active_context_window", "send_click_repeat_count"]) {
      assert.ok(source.includes(needle), `missing ${needle}`);
    }
  }
});

test("P5-Q B2q target exposes dynamic context hooks and stays non-worker DOM", () => {
  const html = read(b2qTargetPath);
  for (const needle of [
    "p5q-b2c-summary-json",
    "__P5Q_B2C_DYNAMIC_CONTEXT_SUMMARY__",
    "P5Q_B2C_DYNAMIC_CONTEXT_STRESS",
    "b2c_virtualized_dom_compact_context_dynamic_active_context",
    "typing_proxy",
    "send_click_proxy",
    ...dynamicContextFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /new\s+Worker\b/);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-Q R0q target exposes dynamic context worker path", () => {
  const html = read(r0qTargetPath);
  for (const needle of [
    "p5q-r0c-summary-json",
    "__P5Q_R0C_DYNAMIC_CONTEXT_SUMMARY__",
    "P5Q_R0C_DYNAMIC_CONTEXT_STRESS",
    "r0c_worker_bounded_projection_compact_context_dynamic_active_context",
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
    ...dynamicContextFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-Q collectors validate dynamic context metrics and final logical count", () => {
  for (const source of [read(b2qCollectorPath), read(r0qCollectorPath)]) {
    for (const needle of [
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
      "dynamic_active_context_update_ms",
      "max_dynamic_active_context_update_ms",
      "dynamic_active_context_rebuild_ms",
      "max_dynamic_context_send_proxy_ms",
      "max_dynamic_active_context_update_ms",
      "valid_manual",
      "user_chrome_manual"
    ]) {
      assert.ok(source.includes(needle), `missing collector validation ${needle}`);
    }
  }
});

test("P5-Q R0q collector validates worker-specific dynamic metrics", () => {
  const source = read(r0qCollectorPath);
  for (const needle of [
    "send_worker_processing_ms",
    "send_worker_active_context_traversal_ms",
    "send_worker_dynamic_active_context_update_ms",
    "send_worker_roundtrip_minus_processing_ms",
    "send_main_commit_ms",
    "send_projection_payload_estimated_bytes",
    "max_send_worker_processing_ms",
    "max_send_worker_active_context_traversal_ms",
    "max_send_worker_dynamic_active_context_update_ms",
    "max_send_worker_roundtrip_minus_processing_ms",
    "max_send_main_commit_ms",
    "max_send_projection_payload_estimated_bytes",
    "send_worker_roundtrip_minus_processing_ms must be >= 0"
  ]) {
    assert.ok(source.includes(needle), `missing R0q collector validation ${needle}`);
  }
});

test("P5-Q collectors preserve explicit boundary language", () => {
  const b2qCollector = read(b2qCollectorPath);
  for (const needle of [
    "B2c dynamic active-context compact baseline only",
    "R0q",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "frame stability",
    "runtime superiority",
    "impossible-zone success",
    "P4 eligibility"
  ]) {
    assert.ok(b2qCollector.includes(needle), `missing B2q boundary ${needle}`);
  }

  const r0qCollector = read(r0qCollectorPath);
  for (const needle of [
    "R0c dynamic active-context worker/bounded-projection path only",
    "B2q",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility"
  ]) {
    assert.ok(r0qCollector.includes(needle), `missing R0q boundary ${needle}`);
  }
});

test("P5-Q URL generators print manual URLs and do not write results", () => {
  for (const runnerPath of [b2qRunnerPath, r0qRunnerPath]) {
    const source = read(runnerPath);
    assert.doesNotMatch(source, /writeFile|mkdir|createWriteStream/);
  }

  const b2qOutput = execFileSync(process.execPath, [b2qRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(b2qOutput, /scenario_count=5/);
  assert.match(b2qOutput, /file:\/\/.*p5q_b2c_dynamic_context_stress\.html\?scenario_id=/);
  assert.match(b2qOutput, /#p5q-b2c-summary-json/);
  assert.match(b2qOutput, /dynamic_context_send_proxy/);
  assert.match(b2qOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(b2qOutput, /collect_p5q_manual_b2c_dynamic_context_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);

  const r0qOutput = execFileSync(process.execPath, [r0qRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(r0qOutput, /scenario_count=5/);
  assert.match(r0qOutput, /file:\/\/.*p5q_r0c_dynamic_context_stress\.html\?scenario_id=/);
  assert.match(r0qOutput, /#p5q-r0c-summary-json/);
  assert.match(r0qOutput, /dynamic_context_send_proxy/);
  assert.match(r0qOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(r0qOutput, /collect_p5q_manual_r0c_dynamic_context_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);
});

test("P5-Q files avoid product URLs and browser automation artifacts", () => {
  for (const filePath of [
    b2qTargetPath,
    r0qTargetPath,
    b2qRunnerPath,
    r0qRunnerPath,
    b2qCollectorPath,
    r0qCollectorPath
  ]) {
    const source = read(filePath);
    assert.doesNotMatch(source, /https?:\/\/(?:chatgpt|claude|gemini|bard|openai|anthropic|google)\b/i);
    assert.doesNotMatch(source, /remote-debugging|CDP|Chrome DevTools Protocol|WebSocket/i);
    assert.doesNotMatch(source, /page\.screenshot|screenshot\s*\(|recordVideo|tracing\.start|tracePath|videoPath/i);
  }
});
