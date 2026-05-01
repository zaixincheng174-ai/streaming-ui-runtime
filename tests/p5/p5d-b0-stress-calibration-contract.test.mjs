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
  new URL("../../bench/p5/targets/p5d_b0_stress_calibration.html", import.meta.url)
);
const runnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5d_b0_stress_calibration.mjs", import.meta.url)
);
const collectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5d_manual_b0_stress_results.mjs", import.meta.url)
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

test("P5-D matrix exists and has expected stress scenarios", () => {
  assert.equal(fs.existsSync(matrixPath), true);
  const matrix = JSON.parse(read(matrixPath));
  assert.deepEqual(matrix.scenarios.map((scenario) => scenario.scenario_id), expectedScenarioIds);
  for (const scenario of matrix.scenarios) {
    assert.equal(scenario.block_shape, "rich");
    assert.ok(scenario.visible_block_count >= 10000);
    assert.ok(scenario.rich_block_multiplier >= 4);
    assert.ok(scenario.send_click_repeat_count >= 2);
  }
});

test("P5-D target contains required hooks, buttons, and summary ids", () => {
  assert.equal(fs.existsSync(targetPath), true);
  const html = read(targetPath);
  for (const needle of [
    "p5d-summary-json",
    "__P5D_B0_STRESS_SUMMARY__",
    "P5D_B0_STRESS_CALIBRATION",
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

test("P5-D target includes rich block and stress metric fields", () => {
  const html = read(targetPath);
  for (const needle of [
    "block_shape",
    "rich_block_multiplier",
    "send_click_repeat_count",
    "block-title",
    "block-body",
    "block-meta",
    "token-chip",
    "artifact-region",
    "long_task_like_count_50ms_proxy",
    "long_task_like_count_100ms_proxy",
    "long_task_like_count_200ms_proxy"
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("P5-D target does not include Worker, WebGPU, or canvas implementation", () => {
  const html = read(targetPath);
  assert.doesNotMatch(html, /new\s+Worker\b/);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /\bwebgpu\b/i);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-D URL generator exists and prints manual URLs", () => {
  assert.equal(fs.existsSync(runnerPath), true);
  const output = execFileSync(process.execPath, [runnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(output, /scenario_count=5/);
  assert.match(output, /p5d_v10000_rich_ctx_full_repeat3/);
  assert.match(output, /p5d_v50000_rich_ctx_full_repeat2/);
  assert.match(output, /file:\/\/.*p5d_b0_stress_calibration\.html\?scenario_id=/);
  assert.match(output, /B0 stress calibration only/);
  assert.match(output, /AUDIT_STATUS=PASS/);
});

test("P5-D collector exists and validates boundary language", () => {
  assert.equal(fs.existsSync(collectorPath), true);
  const source = read(collectorPath);
  for (const needle of [
    "bench/p5/results/p5d_b0_stress_calibration_results.json",
    "B0 naive DOM stress calibration only",
    "B1",
    "B2",
    "B3",
    "R0",
    "browser-level INP",
    "frame stability",
    "runtime superiority",
    "impossible-zone success",
    "P4 eligibility",
    "valid_manual",
    "user_chrome_manual"
  ]) {
    assert.ok(source.includes(needle), `missing ${needle}`);
  }
});

test("P5-D collector writes final result only from manual input", () => {
  const source = read(collectorPath);
  const runnerSource = read(runnerPath);
  assert.ok(source.includes("process.argv[2]"));
  assert.ok(source.includes("manual input"));
  assert.ok(source.includes("await fsp.writeFile(resultPath"));
  assert.doesNotMatch(runnerSource, /writeFile|writeFileSync|appendFile|appendFileSync/);
});

test("P5-D files avoid product URLs, screenshots, traces, and videos", () => {
  const combined = [read(targetPath), read(runnerPath), read(collectorPath)].join("\n");
  assert.doesNotMatch(combined, /chatgpt|claude|gemini|openai/i);
  assert.doesNotMatch(combined, /captureScreenshot|startScreencast|recordVideo|Tracing\.start/i);
});
