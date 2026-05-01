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
  new URL("../../bench/p5/targets/p5f_b2_virtualized_dom_stress.html", import.meta.url)
);
const runnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5f_b2_virtualized_dom_stress.mjs", import.meta.url)
);
const collectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5f_manual_b2_stress_results.mjs", import.meta.url)
);

const expectedScenarioIds = [
  "p5d_v10000_rich_ctx_full_repeat3",
  "p5d_v25000_rich_ctx_medium_repeat3",
  "p5d_v25000_rich_ctx_full_repeat3",
  "p5d_v50000_rich_ctx_medium_repeat2",
  "p5d_v50000_rich_ctx_full_repeat2"
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("P5-F target, URL generator, and collector exist", () => {
  assert.equal(fs.existsSync(targetPath), true);
  assert.equal(fs.existsSync(runnerPath), true);
  assert.equal(fs.existsSync(collectorPath), true);
});

test("P5-F reuses the P5-D scenario matrix dimensions", () => {
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

test("P5-F target contains required hooks, buttons, and summary ids", () => {
  const html = read(targetPath);
  for (const needle of [
    "p5f-summary-json",
    "__P5F_B2_STRESS_SUMMARY__",
    "P5F_B2_VIRTUALIZED_DOM_STRESS",
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

test("P5-F target includes B2 virtualization indicators", () => {
  const html = read(targetPath);
  for (const needle of [
    "visible_window_size",
    "logical_block_count",
    "rendered_block_count",
    "rendered_dom_node_count",
    "renderWindow",
    "old_history_window_render_ms",
    "tail_window_render_ms",
    "virtual_window_render_ms",
    "b2_virtualized_dom"
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("P5-F target includes fairness indicators", () => {
  const html = read(targetPath);
  for (const needle of [
    "active_context_window",
    "active_context_traversal_ms",
    "tail_mutation_ms",
    "append_commit_ms",
    "send_click_repeat_count",
    "logicalBlocks",
    "activeContextIndex",
    "logicalBlockById"
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("P5-F target avoids deferred backend paths", () => {
  const html = read(targetPath);
  assert.doesNotMatch(html, /new\s+Worker\b/);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /\bwebgpu\b/i);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
  assert.doesNotMatch(html, /\bR0\b|runtime path/i);
});

test("P5-F URL generator exists and prints manual URLs", () => {
  const output = execFileSync(process.execPath, [runnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(output, /scenario_count=5/);
  assert.match(output, /p5d_v10000_rich_ctx_full_repeat3/);
  assert.match(output, /p5d_v50000_rich_ctx_full_repeat2/);
  assert.match(output, /file:\/\/.*p5f_b2_virtualized_dom_stress\.html\?scenario_id=/);
  assert.match(output, /B2 virtualized DOM stress baseline only/);
  assert.match(output, /AUDIT_STATUS=PASS/);
});

test("P5-F collector validates boundary language", () => {
  const source = read(collectorPath);
  for (const needle of [
    "bench/p5/results/p5f_b2_virtualized_dom_stress_results.json",
    "B2 virtualized DOM stress baseline only",
    "B0 new measurement",
    "B1 new measurement",
    "B3",
    "R0",
    "browser-level INP",
    "frame stability",
    "runtime superiority",
    "impossible-zone success",
    "P4 eligibility",
    "valid_manual",
    "user_chrome_manual",
    "b2_virtualized_dom"
  ]) {
    assert.ok(source.includes(needle), `missing ${needle}`);
  }
});

test("P5-F collector writes final result only from manual input", () => {
  const source = read(collectorPath);
  const runnerSource = read(runnerPath);
  assert.ok(source.includes("process.argv[2]"));
  assert.ok(source.includes("manual input"));
  assert.ok(source.includes("await fsp.writeFile(resultPath"));
  assert.ok(source.includes("logical_block_count"));
  assert.ok(source.includes("rendered_block_count"));
  assert.doesNotMatch(runnerSource, /writeFile|writeFileSync|appendFile|appendFileSync/);
});

test("P5-F files avoid product URLs, screenshots, traces, and videos", () => {
  const combined = [read(targetPath), read(runnerPath), read(collectorPath)].join("\n");
  assert.doesNotMatch(combined, /chatgpt|claude|gemini|openai/i);
  assert.doesNotMatch(combined, /captureScreenshot|startScreencast|recordVideo|Tracing\.start/i);
  assert.doesNotMatch(combined, /remote-debugging|websocket|CDP/i);
});
