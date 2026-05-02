import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = fileURLToPath(
  new URL("../../bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json", import.meta.url)
);
const targetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5g_r0_p3_runtime_stress.html", import.meta.url)
);
const runnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5g_r0_p3_runtime_stress.mjs", import.meta.url)
);
const collectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5g_manual_r0_stress_results.mjs", import.meta.url)
);

const expectedScenarioIds = [
  "p5d_v10000_rich_ctx_full_repeat3",
  "p5d_v25000_rich_ctx_medium_repeat3",
  "p5d_v25000_rich_ctx_full_repeat3",
  "p5d_v50000_rich_ctx_medium_repeat2",
  "p5d_v50000_rich_ctx_full_repeat2"
];

const phaseSpecificMetricFields = [
  "init_worker_roundtrip_ms",
  "init_worker_processing_ms",
  "init_worker_projection_ms",
  "init_main_commit_ms",
  "typing_worker_roundtrip_ms",
  "typing_worker_processing_ms",
  "send_worker_roundtrip_ms",
  "send_worker_processing_ms",
  "send_worker_active_context_traversal_ms",
  "send_worker_tail_mutation_ms",
  "send_worker_append_ms",
  "send_worker_projection_ms",
  "send_main_commit_ms",
  "send_end_to_end_ms",
  "scroll_old_worker_roundtrip_ms",
  "scroll_old_worker_processing_ms",
  "scroll_old_worker_projection_ms",
  "scroll_old_main_commit_ms",
  "scroll_tail_worker_roundtrip_ms",
  "scroll_tail_worker_processing_ms",
  "scroll_tail_worker_projection_ms",
  "scroll_tail_main_commit_ms",
  "max_phase_worker_roundtrip_ms",
  "max_phase_worker_processing_ms",
  "max_phase_worker_projection_ms",
  "max_phase_main_commit_ms"
];

const confoundMetricFields = [
  "send_worker_roundtrip_minus_processing_ms",
  "max_phase_worker_roundtrip_minus_processing_ms",
  "init_worker_roundtrip_minus_processing_ms",
  "typing_worker_roundtrip_minus_processing_ms",
  "scroll_old_worker_roundtrip_minus_processing_ms",
  "scroll_tail_worker_roundtrip_minus_processing_ms",
  "send_projection_payload_block_count",
  "send_projection_payload_estimated_bytes",
  "max_projection_payload_estimated_bytes",
  "projection_payload_estimate_mode",
  "active_context_entries_visited",
  "send_active_context_entries_visited",
  "active_context_scan_mode",
  "dynamic_active_context_update_mode"
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("P5-G target, URL generator, and collector exist", () => {
  assert.equal(fs.existsSync(targetPath), true);
  assert.equal(fs.existsSync(runnerPath), true);
  assert.equal(fs.existsSync(collectorPath), true);
});

test("P5-G reuses the P5-D scenario matrix dimensions", () => {
  assert.equal(fs.existsSync(matrixPath), true);
  const matrix = JSON.parse(read(matrixPath));
  assert.deepEqual(matrix.scenarios.map((scenario) => scenario.scenario_id), expectedScenarioIds);

  const html = read(targetPath);
  for (const scenarioId of expectedScenarioIds) {
    assert.ok(html.includes(scenarioId), `missing scenario ${scenarioId}`);
  }
  for (const needle of ["visible_block_count", "active_context_window", "rich_block_multiplier", "send_click_repeat_count"]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("P5-G target contains required hooks, buttons, and summary ids", () => {
  const html = read(targetPath);
  for (const needle of [
    "p5g-summary-json",
    "__P5G_R0_STRESS_SUMMARY__",
    "P5G_R0_P3_RUNTIME_STRESS",
    "typing-proxy-button",
    "send-click-proxy-button",
    "scroll-jump-return-button",
    "runTypingProxy",
    "runSendClickProxy",
    "runScrollJumpReturn",
    "runInteraction",
    "typing_proxy",
    "send_click_proxy",
    "scroll_jump_return"
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("P5-G target includes Worker and P3-derived runtime indicators", () => {
  const html = read(targetPath);
  for (const needle of [
    "new Worker",
    "Blob",
    "postMessage",
    "onmessage",
    "buildBoundedProjection",
    "createRenderingTransaction",
    "admitViewportTransaction",
    "selectNextCommitCandidate",
    "createCommitCycleRecord",
    "classifyAnchorTransition"
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("P5-G target includes fairness indicators", () => {
  const html = read(targetPath);
  for (const needle of [
    "active_context_window",
    "worker_active_context_traversal_ms",
    "worker_tail_mutation_ms",
    "worker_append_ms",
    "send_click_repeat_count",
    "logical_block_count",
    "logicalBlocks",
    "activeContextIndex",
    "tailMutations",
    "appendStream"
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("P5-G target exposes phase-specific R0 instrumentation fields", () => {
  const html = read(targetPath);
  for (const field of phaseSpecificMetricFields) {
    assert.ok(html.includes(field), `missing ${field}`);
  }
  for (const needle of ["recordWorkerPhase", "recordMainCommitPhase"]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("P5-G target exposes pre-optimization confound instrumentation fields", () => {
  const html = read(targetPath);
  for (const field of confoundMetricFields) {
    assert.ok(html.includes(field), `missing ${field}`);
  }
  for (const needle of [
    "roundtripMinusProcessing",
    "estimateProjectionPayloadBytes",
    "full_string_scan",
    "static_initial_active_context",
    "synthetic_block_text_metadata_length"
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("P5-G target avoids deferred render backends and product URLs", () => {
  const html = read(targetPath);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
  assert.doesNotMatch(html, /chatgpt|claude|gemini|openai/i);
});

test("P5-G URL generator exists and prints manual URLs", () => {
  const output = execFileSync(process.execPath, [runnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(output, /scenario_count=5/);
  assert.match(output, /p5d_v10000_rich_ctx_full_repeat3/);
  assert.match(output, /p5d_v50000_rich_ctx_full_repeat2/);
  assert.match(output, /file:\/\/.*p5g_r0_p3_runtime_stress\.html\?scenario_id=/);
  assert.match(output, /R0 P3-derived worker\/bounded-projection runtime path only/);
  assert.match(output, /AUDIT_STATUS=PASS/);
});

test("P5-G collector validates boundary language", () => {
  const source = read(collectorPath);
  for (const needle of [
    "bench/p5/results/p5g_r0_p3_runtime_stress_results.json",
    "R0 P3-derived worker/bounded-projection runtime path only",
    "B0 new measurement",
    "B1 new measurement",
    "B2 new measurement",
    "B3",
    "browser-level INP",
    "frame stability",
    "production runtime readiness",
    "WebGPU",
    "Canvas",
    "P4 eligibility",
    "valid_manual",
    "user_chrome_manual",
    "r0_p3_derived_worker_bounded_projection"
  ]) {
    assert.ok(source.includes(needle), `missing ${needle}`);
  }
});

test("P5-G collector validates phase-specific R0 instrumentation fields", () => {
  const source = read(collectorPath);
  for (const field of phaseSpecificMetricFields) {
    assert.ok(source.includes(field), `missing ${field}`);
  }
  for (const field of [
    "max_send_end_to_end_ms",
    "max_send_worker_processing_ms",
    "max_send_worker_active_context_traversal_ms",
    "max_send_worker_tail_mutation_ms",
    "max_send_worker_append_ms",
    "max_send_worker_projection_ms",
    "max_send_main_commit_ms",
    "max_phase_worker_roundtrip_ms",
    "max_phase_worker_processing_ms",
    "max_phase_worker_projection_ms",
    "max_phase_main_commit_ms"
  ]) {
    assert.ok(source.includes(field), `missing ${field}`);
  }
});

test("P5-G collector validates pre-optimization confound instrumentation fields", () => {
  const source = read(collectorPath);
  for (const field of confoundMetricFields) {
    assert.ok(source.includes(field), `missing ${field}`);
  }
  for (const field of [
    "max_send_worker_roundtrip_minus_processing_ms",
    "max_phase_worker_roundtrip_minus_processing_ms",
    "max_send_projection_payload_estimated_bytes",
    "max_projection_payload_estimated_bytes",
    "max_send_active_context_entries_visited",
    "active_context_scan_modes",
    "dynamic_active_context_update_modes",
    "uniqueStrings"
  ]) {
    assert.ok(source.includes(field), `missing ${field}`);
  }
});

test("P5-G collector writes final result only from manual input", () => {
  const source = read(collectorPath);
  const runnerSource = read(runnerPath);
  assert.ok(source.includes("process.argv[2]"));
  assert.ok(source.includes("manual input"));
  assert.ok(source.includes("await fsp.writeFile(resultPath"));
  assert.ok(source.includes("worker_processing_ms"));
  assert.ok(source.includes("main_commit_ms"));
  assert.doesNotMatch(runnerSource, /writeFile|writeFileSync|appendFile|appendFileSync/);
});

test("P5-G files avoid screenshots, traces, videos, and browser automation hooks", () => {
  const combined = [read(targetPath), read(runnerPath), read(collectorPath)].join("\n");
  assert.doesNotMatch(combined, /captureScreenshot|startScreencast|recordVideo|Tracing\.start/i);
  assert.doesNotMatch(combined, /remote-debugging|websocket|CDP/i);
});
