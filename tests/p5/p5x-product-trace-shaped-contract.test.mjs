import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = fileURLToPath(
  new URL("../../bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json", import.meta.url)
);
const b2xTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5x_b2c_product_trace_shaped_stress.html", import.meta.url)
);
const r0xTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5x_r0c_product_trace_shaped_stress.html", import.meta.url)
);
const b2xRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5x_b2c_product_trace_shaped_stress.mjs", import.meta.url)
);
const r0xRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5x_r0c_product_trace_shaped_stress.mjs", import.meta.url)
);
const b2xCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5x_manual_b2c_product_trace_shaped_results.mjs", import.meta.url)
);
const r0xCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5x_manual_r0c_product_trace_shaped_results.mjs", import.meta.url)
);

const expectedScenarioIds = [
  "p5d_v10000_rich_ctx_full_repeat3",
  "p5d_v25000_rich_ctx_medium_repeat3",
  "p5d_v25000_rich_ctx_full_repeat3",
  "p5d_v50000_rich_ctx_medium_repeat2",
  "p5d_v50000_rich_ctx_full_repeat2"
];

const productTraceFields = [
  "product_trace_shaped_proxy",
  "concurrent_input_during_product_trace_proxy",
  "runProductTraceShapedProxy",
  "runConcurrentInputDuringProductTraceProxy",
  "trace_phase_count",
  "trace_phases",
  "trace_lane_count",
  "trace_lanes",
  "trace_events_processed",
  "assistant_stream_event_count",
  "tool_call_event_count",
  "tool_result_event_count",
  "agent_status_event_count",
  "code_diff_event_count",
  "review_note_event_count",
  "concurrent_product_trace_input_delay_ms",
  "max_concurrent_product_trace_input_delay_ms",
  "rolling_tail_window_after_append",
  "compact_checksum_index",
  "expected_final_logical_block_count"
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("P5-X product-trace-shaped files exist", () => {
  for (const filePath of [
    matrixPath,
    b2xTargetPath,
    r0xTargetPath,
    b2xRunnerPath,
    r0xRunnerPath,
    b2xCollectorPath,
    r0xCollectorPath
  ]) {
    assert.equal(fs.existsSync(filePath), true, `missing ${filePath}`);
  }
});

test("P5-X targets reuse the exact P5-D scenario ids", () => {
  const matrix = JSON.parse(read(matrixPath));
  assert.deepEqual(matrix.scenarios.map((scenario) => scenario.scenario_id), expectedScenarioIds);
  for (const source of [read(b2xTargetPath), read(r0xTargetPath)]) {
    for (const scenarioId of expectedScenarioIds) {
      assert.ok(source.includes(scenarioId), `missing scenario ${scenarioId}`);
    }
    for (const needle of ["visible_block_count", "active_context_window", "send_click_repeat_count"]) {
      assert.ok(source.includes(needle), `missing ${needle}`);
    }
  }
});

test("P5-X B2x target exposes product_trace hooks and stays non-worker DOM", () => {
  const html = read(b2xTargetPath);
  for (const needle of [
    "p5x-b2c-summary-json",
    "__P5X_B2C_PRODUCT_TRACE_SHAPED_SUMMARY__",
    "P5X_B2C_PRODUCT_TRACE_SHAPED_STRESS",
    "b2c_virtualized_dom_compact_context_product_trace_shaped",
    ...productTraceFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /new\s+Worker\b/);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-X R0x target exposes product_trace worker path", () => {
  const html = read(r0xTargetPath);
  for (const needle of [
    "p5x-r0c-summary-json",
    "__P5X_R0C_PRODUCT_TRACE_SHAPED_SUMMARY__",
    "P5X_R0C_PRODUCT_TRACE_SHAPED_STRESS",
    "r0c_worker_bounded_projection_compact_context_product_trace_shaped",
    "new Worker",
    "Blob",
    "postMessage",
    "onmessage",
    "worker_product_trace_processing_ms",
    "worker_trace_event_merge_ms",
    "worker_dynamic_active_context_update_ms",
    "worker_active_context_traversal_ms",
    "worker_roundtrip_minus_processing_ms",
    "main_commit_ms",
    "projection_payload_estimated_bytes",
    "concurrent_worker_product_trace_processing_ms",
    "concurrent_worker_roundtrip_minus_processing_ms",
    "concurrent_main_commit_ms",
    ...productTraceFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-X collectors validate product_trace metrics and invariants", () => {
  for (const source of [read(b2xCollectorPath), read(r0xCollectorPath)]) {
    for (const needle of [
      "trace_phase_count must equal 5",
      "trace_lane_count must equal 6",
      "trace_event_count_per_repeat must equal append_batch_size",
      "trace_events_processed must equal",
      "lane event counts must equal trace_events_processed",
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
      "concurrent_product_trace_input_delay_ms",
      "max_concurrent_product_trace_input_delay_ms",
      "concurrent_product_trace_typing_proxy_ms",
      "product_trace_send_work_ms",
      "trace_event_merge_ms",
      "dynamic_active_context_update_ms",
      "rendered DOM must remain bounded",
      "valid_manual",
      "user_chrome_manual",
      "not real product trace"
    ]) {
      assert.ok(source.includes(needle), `missing collector validation ${needle}`);
    }
  }
});

test("P5-X R0x collector validates worker-specific product_trace metrics", () => {
  const source = read(r0xCollectorPath);
  for (const needle of [
    "worker_product_trace_processing_ms",
    "worker_trace_event_merge_ms",
    "worker_dynamic_active_context_update_ms",
    "worker_active_context_traversal_ms",
    "worker_roundtrip_minus_processing_ms",
    "main_commit_ms",
    "projection_payload_estimated_bytes",
    "concurrent_worker_product_trace_processing_ms",
    "concurrent_worker_roundtrip_minus_processing_ms",
    "concurrent_main_commit_ms",
    "max_worker_product_trace_processing_ms",
    "max_worker_trace_event_merge_ms",
    "max_worker_dynamic_active_context_update_ms",
    "max_worker_roundtrip_minus_processing_ms",
    "max_main_commit_ms",
    "max_concurrent_worker_product_trace_processing_ms",
    "max_concurrent_worker_roundtrip_minus_processing_ms",
    "max_concurrent_main_commit_ms",
    "worker_roundtrip_minus_processing_ms must be >= 0",
    "concurrent_worker_roundtrip_minus_processing_ms must be >= 0"
  ]) {
    assert.ok(source.includes(needle), `missing R0x collector validation ${needle}`);
  }
});

test("P5-X collectors preserve explicit boundary language", () => {
  const b2xCollector = read(b2xCollectorPath);
  for (const needle of [
    "B2c product-trace-shaped compact dynamic-context baseline only",
    "R0x",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "Event Timing",
    "frame stability",
    "runtime superiority",
    "impossible-zone success",
    "P4 eligibility"
  ]) {
    assert.ok(b2xCollector.includes(needle), `missing B2x boundary ${needle}`);
  }

  const r0xCollector = read(r0xCollectorPath);
  for (const needle of [
    "R0c product-trace-shaped worker/bounded-projection path only",
    "B2x",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "Event Timing",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility"
  ]) {
    assert.ok(r0xCollector.includes(needle), `missing R0x boundary ${needle}`);
  }
});

test("P5-X URL generators print manual URLs and do not write results", () => {
  for (const runnerPath of [b2xRunnerPath, r0xRunnerPath]) {
    const source = read(runnerPath);
    assert.doesNotMatch(source, /writeFile|mkdir|createWriteStream/);
  }

  const b2xOutput = execFileSync(process.execPath, [b2xRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(b2xOutput, /scenario_count=5/);
  assert.match(b2xOutput, /file:\/\/.*p5x_b2c_product_trace_shaped_stress\.html\?scenario_id=/);
  assert.match(b2xOutput, /#p5x-b2c-summary-json/);
  assert.match(b2xOutput, /concurrent_input_during_product_trace_proxy/);
  assert.match(b2xOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(b2xOutput, /collect_p5x_manual_b2c_product_trace_shaped_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);

  const r0xOutput = execFileSync(process.execPath, [r0xRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(r0xOutput, /scenario_count=5/);
  assert.match(r0xOutput, /file:\/\/.*p5x_r0c_product_trace_shaped_stress\.html\?scenario_id=/);
  assert.match(r0xOutput, /#p5x-r0c-summary-json/);
  assert.match(r0xOutput, /concurrent_input_during_product_trace_proxy/);
  assert.match(r0xOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(r0xOutput, /collect_p5x_manual_r0c_product_trace_shaped_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);
});

test("P5-X files avoid product URLs and browser automation artifacts", () => {
  for (const filePath of [
    b2xTargetPath,
    r0xTargetPath,
    b2xRunnerPath,
    r0xRunnerPath,
    b2xCollectorPath,
    r0xCollectorPath
  ]) {
    const source = read(filePath);
    assert.doesNotMatch(source, /https?:\/\/(?:chatgpt|claude|gemini|bard|openai|anthropic|google)\b/i);
    assert.doesNotMatch(source, /remote-debugging|CDP|Chrome DevTools Protocol|WebSocket/i);
    assert.doesNotMatch(source, /page\.screenshot|screenshot\s*\(|recordVideo|tracing\.start|tracePath|videoPath/i);
  }
});
