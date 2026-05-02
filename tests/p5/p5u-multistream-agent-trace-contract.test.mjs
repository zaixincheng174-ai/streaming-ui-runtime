import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = fileURLToPath(
  new URL("../../bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json", import.meta.url)
);
const b2uTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5u_b2c_multistream_agent_trace_stress.html", import.meta.url)
);
const r0uTargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5u_r0c_multistream_agent_trace_stress.html", import.meta.url)
);
const b2uRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5u_b2c_multistream_agent_trace_stress.mjs", import.meta.url)
);
const r0uRunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5u_r0c_multistream_agent_trace_stress.mjs", import.meta.url)
);
const b2uCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5u_manual_b2c_multistream_agent_trace_results.mjs", import.meta.url)
);
const r0uCollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5u_manual_r0c_multistream_agent_trace_results.mjs", import.meta.url)
);

const expectedScenarioIds = [
  "p5d_v10000_rich_ctx_full_repeat3",
  "p5d_v25000_rich_ctx_medium_repeat3",
  "p5d_v25000_rich_ctx_full_repeat3",
  "p5d_v50000_rich_ctx_medium_repeat2",
  "p5d_v50000_rich_ctx_full_repeat2"
];

const multistreamFields = [
  "multistream_agent_trace_proxy",
  "concurrent_input_during_multistream_proxy",
  "runMultistreamAgentTraceProxy",
  "runConcurrentInputDuringMultistreamProxy",
  "stream_lane_count",
  "stream_events_processed",
  "agent_trace_event_count",
  "tool_event_count",
  "code_diff_event_count",
  "assistant_token_event_count",
  "concurrent_multistream_input_delay_ms",
  "max_concurrent_multistream_input_delay_ms",
  "rolling_tail_window_after_append",
  "compact_checksum_index",
  "expected_final_logical_block_count"
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("P5-U multistream agent-trace files exist", () => {
  for (const filePath of [
    matrixPath,
    b2uTargetPath,
    r0uTargetPath,
    b2uRunnerPath,
    r0uRunnerPath,
    b2uCollectorPath,
    r0uCollectorPath
  ]) {
    assert.equal(fs.existsSync(filePath), true, `missing ${filePath}`);
  }
});

test("P5-U targets reuse the exact P5-D scenario ids", () => {
  const matrix = JSON.parse(read(matrixPath));
  assert.deepEqual(matrix.scenarios.map((scenario) => scenario.scenario_id), expectedScenarioIds);
  for (const source of [read(b2uTargetPath), read(r0uTargetPath)]) {
    for (const scenarioId of expectedScenarioIds) {
      assert.ok(source.includes(scenarioId), `missing scenario ${scenarioId}`);
    }
    for (const needle of ["visible_block_count", "active_context_window", "send_click_repeat_count"]) {
      assert.ok(source.includes(needle), `missing ${needle}`);
    }
  }
});

test("P5-U B2u target exposes multistream hooks and stays non-worker DOM", () => {
  const html = read(b2uTargetPath);
  for (const needle of [
    "p5u-b2c-summary-json",
    "__P5U_B2C_MULTISTREAM_SUMMARY__",
    "P5U_B2C_MULTISTREAM_AGENT_TRACE_STRESS",
    "b2c_virtualized_dom_compact_context_multistream_agent_trace",
    ...multistreamFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /new\s+Worker\b/);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-U R0u target exposes multistream worker path", () => {
  const html = read(r0uTargetPath);
  for (const needle of [
    "p5u-r0c-summary-json",
    "__P5U_R0C_MULTISTREAM_SUMMARY__",
    "P5U_R0C_MULTISTREAM_AGENT_TRACE_STRESS",
    "r0c_worker_bounded_projection_compact_context_multistream_agent_trace",
    "new Worker",
    "Blob",
    "postMessage",
    "onmessage",
    "worker_multistream_processing_ms",
    "worker_stream_merge_ms",
    "worker_dynamic_active_context_update_ms",
    "worker_active_context_traversal_ms",
    "worker_roundtrip_minus_processing_ms",
    "main_commit_ms",
    "projection_payload_estimated_bytes",
    "concurrent_worker_multistream_processing_ms",
    "concurrent_worker_roundtrip_minus_processing_ms",
    "concurrent_main_commit_ms",
    ...multistreamFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-U collectors validate multistream metrics and invariants", () => {
  for (const source of [read(b2uCollectorPath), read(r0uCollectorPath)]) {
    for (const needle of [
      "stream_lane_count must equal 4",
      "stream_event_count must equal append_batch_size",
      "stream_events_processed must equal",
      "lane event counts must equal stream_events_processed",
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
      "concurrent_multistream_input_delay_ms",
      "max_concurrent_multistream_input_delay_ms",
      "concurrent_multistream_typing_proxy_ms",
      "multistream_send_work_ms",
      "stream_merge_ms",
      "dynamic_active_context_update_ms",
      "rendered DOM must remain bounded",
      "valid_manual",
      "user_chrome_manual"
    ]) {
      assert.ok(source.includes(needle), `missing collector validation ${needle}`);
    }
  }
});

test("P5-U R0u collector validates worker-specific multistream metrics", () => {
  const source = read(r0uCollectorPath);
  for (const needle of [
    "worker_multistream_processing_ms",
    "worker_stream_merge_ms",
    "worker_dynamic_active_context_update_ms",
    "worker_active_context_traversal_ms",
    "worker_roundtrip_minus_processing_ms",
    "main_commit_ms",
    "projection_payload_estimated_bytes",
    "concurrent_worker_multistream_processing_ms",
    "concurrent_worker_roundtrip_minus_processing_ms",
    "concurrent_main_commit_ms",
    "max_worker_multistream_processing_ms",
    "max_worker_stream_merge_ms",
    "max_worker_dynamic_active_context_update_ms",
    "max_worker_roundtrip_minus_processing_ms",
    "max_main_commit_ms",
    "max_concurrent_worker_multistream_processing_ms",
    "max_concurrent_worker_roundtrip_minus_processing_ms",
    "max_concurrent_main_commit_ms",
    "worker_roundtrip_minus_processing_ms must be >= 0",
    "concurrent_worker_roundtrip_minus_processing_ms must be >= 0"
  ]) {
    assert.ok(source.includes(needle), `missing R0u collector validation ${needle}`);
  }
});

test("P5-U collectors preserve explicit boundary language", () => {
  const b2uCollector = read(b2uCollectorPath);
  for (const needle of [
    "B2c multistream agent-trace compact dynamic-context baseline only",
    "R0u",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "Event Timing",
    "frame stability",
    "runtime superiority",
    "impossible-zone success",
    "P4 eligibility"
  ]) {
    assert.ok(b2uCollector.includes(needle), `missing B2u boundary ${needle}`);
  }

  const r0uCollector = read(r0uCollectorPath);
  for (const needle of [
    "R0c multistream agent-trace worker/bounded-projection path only",
    "B2u",
    "B0/B1/B2/R0 original new measurement",
    "browser-level INP",
    "Event Timing",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility"
  ]) {
    assert.ok(r0uCollector.includes(needle), `missing R0u boundary ${needle}`);
  }
});

test("P5-U URL generators print manual URLs and do not write results", () => {
  for (const runnerPath of [b2uRunnerPath, r0uRunnerPath]) {
    const source = read(runnerPath);
    assert.doesNotMatch(source, /writeFile|mkdir|createWriteStream/);
  }

  const b2uOutput = execFileSync(process.execPath, [b2uRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(b2uOutput, /scenario_count=5/);
  assert.match(b2uOutput, /file:\/\/.*p5u_b2c_multistream_agent_trace_stress\.html\?scenario_id=/);
  assert.match(b2uOutput, /#p5u-b2c-summary-json/);
  assert.match(b2uOutput, /concurrent_input_during_multistream_proxy/);
  assert.match(b2uOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(b2uOutput, /collect_p5u_manual_b2c_multistream_agent_trace_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);

  const r0uOutput = execFileSync(process.execPath, [r0uRunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(r0uOutput, /scenario_count=5/);
  assert.match(r0uOutput, /file:\/\/.*p5u_r0c_multistream_agent_trace_stress\.html\?scenario_id=/);
  assert.match(r0uOutput, /#p5u-r0c-summary-json/);
  assert.match(r0uOutput, /concurrent_input_during_multistream_proxy/);
  assert.match(r0uOutput, /AUDIT_STATUS=PASS/);
  assert.doesNotMatch(r0uOutput, /collect_p5u_manual_r0c_multistream_agent_trace_results\.mjs.*AUDIT_STATUS=PASS.*output=/s);
});

test("P5-U files avoid product URLs and browser automation artifacts", () => {
  for (const filePath of [
    b2uTargetPath,
    r0uTargetPath,
    b2uRunnerPath,
    r0uRunnerPath,
    b2uCollectorPath,
    r0uCollectorPath
  ]) {
    const source = read(filePath);
    assert.doesNotMatch(source, /https?:\/\/(?:chatgpt|claude|gemini|bard|openai|anthropic|google)\b/i);
    assert.doesNotMatch(source, /remote-debugging|CDP|Chrome DevTools Protocol|WebSocket/i);
    assert.doesNotMatch(source, /page\.screenshot|screenshot\s*\(|recordVideo|tracing\.start|tracePath|videoPath/i);
  }
});
