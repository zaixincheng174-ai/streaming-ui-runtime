import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = fileURLToPath(
  new URL("../../bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json", import.meta.url)
);
const b2TargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5i_b2_compact_context_stress.html", import.meta.url)
);
const r0TargetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5i_r0_compact_context_stress.html", import.meta.url)
);
const b2RunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5i_b2_compact_context_stress.mjs", import.meta.url)
);
const r0RunnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5i_r0_compact_context_stress.mjs", import.meta.url)
);
const b2CollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5i_manual_b2_compact_results.mjs", import.meta.url)
);
const r0CollectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5i_manual_r0_compact_results.mjs", import.meta.url)
);

const expectedScenarioIds = [
  "p5d_v10000_rich_ctx_full_repeat3",
  "p5d_v25000_rich_ctx_medium_repeat3",
  "p5d_v25000_rich_ctx_full_repeat3",
  "p5d_v50000_rich_ctx_medium_repeat2",
  "p5d_v50000_rich_ctx_full_repeat2"
];

const compactFields = [
  "compact_checksum",
  "compact_metadata_weight",
  "compact_entry_weight",
  "compact_scan_units",
  "active_context_scan_mode",
  "compact_checksum_index",
  "dynamic_active_context_update_mode",
  "static_initial_active_context",
  "active_context_entries_visited",
  "send_active_context_entries_visited",
  "active_context_compact_index_size",
  "active_context_compact_scan_units",
  "compact_checksum_mode",
  "numeric_precomputed_weight",
  "compact_index_build_ms",
  "send_active_context_compact_scan_ms"
];

const scrollBatchFields = [
  "scroll_jump_return_batched",
  "scroll_batch_mode",
  "old_and_tail_single_worker_message",
  "scroll_batched_worker_roundtrip_ms",
  "scroll_batched_worker_processing_ms",
  "scroll_batched_worker_projection_ms",
  "scroll_batched_roundtrip_minus_processing_ms",
  "scroll_batched_projection_payload_estimated_bytes",
  "scroll_batched_projection_payload_block_count",
  "scroll_batched_main_commit_ms",
  "scroll_batched_old_main_commit_ms",
  "scroll_batched_tail_main_commit_ms"
];

const scrollBatchMetricFields = scrollBatchFields.filter((field) => field !== "scroll_jump_return_batched");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("P5-I compact-context files exist", () => {
  for (const filePath of [
    matrixPath,
    b2TargetPath,
    r0TargetPath,
    b2RunnerPath,
    r0RunnerPath,
    b2CollectorPath,
    r0CollectorPath
  ]) {
    assert.equal(fs.existsSync(filePath), true, `missing ${filePath}`);
  }
});

test("P5-I compact variants reuse the exact P5-D scenario ids", () => {
  const matrix = JSON.parse(read(matrixPath));
  assert.deepEqual(matrix.scenarios.map((scenario) => scenario.scenario_id), expectedScenarioIds);

  for (const source of [read(b2TargetPath), read(r0TargetPath)]) {
    for (const scenarioId of expectedScenarioIds) {
      assert.ok(source.includes(scenarioId), `missing scenario ${scenarioId}`);
    }
    for (const needle of ["visible_block_count", "active_context_window", "send_click_repeat_count"]) {
      assert.ok(source.includes(needle), `missing ${needle}`);
    }
  }
});

test("P5-I B2c target exposes compact-context hooks and stays non-worker DOM", () => {
  const html = read(b2TargetPath);
  for (const needle of [
    "p5i-b2-summary-json",
    "__P5I_B2_COMPACT_SUMMARY__",
    "P5I_B2_COMPACT_CONTEXT_STRESS",
    "runTypingProxy",
    "runSendClickProxy",
    "runScrollJumpReturn",
    "runInteraction",
    "b2_virtualized_dom_compact_context",
    "visible_window_size",
    "logical_block_count",
    "rendered_dom_node_count",
    ...compactFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /new\s+Worker\b/);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-I R0c target exposes compact-context worker/runtime hooks", () => {
  const html = read(r0TargetPath);
  for (const needle of [
    "p5i-r0-summary-json",
    "__P5I_R0_COMPACT_SUMMARY__",
    "P5I_R0_COMPACT_CONTEXT_STRESS",
    "runTypingProxy",
    "runSendClickProxy",
    "runScrollJumpReturn",
    "runInteraction",
    "r0_p3_derived_worker_bounded_projection_compact_context",
    "new Worker",
    "Blob",
    "postMessage",
    "onmessage",
    "buildBoundedProjection",
    "createRenderingTransaction",
    "admitViewportTransaction",
    "selectNextCommitCandidate",
    "createCommitCycleRecord",
    "classifyAnchorTransition",
    ...compactFields,
    ...scrollBatchFields
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-I collectors validate compact metrics and entry count semantics", () => {
  for (const source of [read(b2CollectorPath), read(r0CollectorPath)]) {
    for (const needle of [
      "active_context_scan_mode must be compact_checksum_index",
      "dynamic_active_context_update_mode must be static_initial_active_context",
      "compact_checksum_mode must be numeric_precomputed_weight",
      "active_context_window * scenario.send_click_repeat_count",
      "send_active_context_entries_visited must equal",
      "active_context_entries_visited must equal",
      "active_context_compact_index_size must equal active_context_window",
      "max_send_click_proxy_ms",
      "max_active_context_entries_visited",
      "max_send_active_context_entries_visited",
      "max_active_context_compact_index_size",
      "max_active_context_compact_scan_units",
      "max_compact_index_build_ms",
      "max_send_active_context_compact_scan_ms",
      "valid_manual",
      "user_chrome_manual"
    ]) {
      assert.ok(source.includes(needle), `missing ${needle}`);
    }
  }
});

test("P5-I R0c collector validates scroll batching metrics", () => {
  const source = read(r0CollectorPath);
  for (const needle of [
    ...scrollBatchMetricFields,
    "max_scroll_batched_worker_roundtrip_ms",
    "max_scroll_batched_worker_processing_ms",
    "max_scroll_batched_roundtrip_minus_processing_ms",
    "max_scroll_batched_main_commit_ms",
    "max_scroll_batched_projection_payload_estimated_bytes",
    "scroll_batch_modes",
    "scroll_batch_mode must be old_and_tail_single_worker_message",
    "scroll_batched_roundtrip_minus_processing_ms must be >= 0"
  ]) {
    assert.ok(source.includes(needle), `missing ${needle}`);
  }
});

test("P5-I collectors preserve explicit boundary language", () => {
  const b2Collector = read(b2CollectorPath);
  for (const needle of [
    "B2c virtualized DOM compact-context stress baseline only",
    "B0 new measurement",
    "B1 new measurement",
    "B2 original new measurement",
    "R0",
    "R0c",
    "B3",
    "browser-level INP",
    "frame stability",
    "runtime superiority",
    "impossible-zone success",
    "P4 eligibility"
  ]) {
    assert.ok(b2Collector.includes(needle), `missing B2c boundary ${needle}`);
  }

  const r0Collector = read(r0CollectorPath);
  for (const needle of [
    "R0c P3-derived worker/bounded-projection compact-context path only",
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
  ]) {
    assert.ok(r0Collector.includes(needle), `missing R0c boundary ${needle}`);
  }
});

test("P5-I URL generators print manual URLs and do not write results", () => {
  const b2Output = execFileSync(process.execPath, [b2RunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(b2Output, /scenario_count=5/);
  assert.match(b2Output, /file:\/\/.*p5i_b2_compact_context_stress\.html\?scenario_id=/);
  assert.match(b2Output, /#p5i-b2-summary-json/);
  assert.match(b2Output, /AUDIT_STATUS=PASS/);

  const r0Output = execFileSync(process.execPath, [r0RunnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(r0Output, /scenario_count=5/);
  assert.match(r0Output, /file:\/\/.*p5i_r0_compact_context_stress\.html\?scenario_id=/);
  assert.match(r0Output, /#p5i-r0-summary-json/);
  assert.match(r0Output, /AUDIT_STATUS=PASS/);

  assert.doesNotMatch(read(b2RunnerPath), /writeFile|writeFileSync|appendFile|appendFileSync/);
  assert.doesNotMatch(read(r0RunnerPath), /writeFile|writeFileSync|appendFile|appendFileSync/);
});

test("P5-I files avoid product URLs, browser automation, screenshots, traces, and videos", () => {
  const combined = [
    read(b2TargetPath),
    read(r0TargetPath),
    read(b2RunnerPath),
    read(r0RunnerPath),
    read(b2CollectorPath),
    read(r0CollectorPath)
  ].join("\n");
  assert.doesNotMatch(combined, /chatgpt|claude|gemini|openai/i);
  assert.doesNotMatch(combined, /captureScreenshot|startScreencast|recordVideo|Tracing\.start/i);
  assert.doesNotMatch(combined, /remote-debugging|websocket|CDP/i);
});
