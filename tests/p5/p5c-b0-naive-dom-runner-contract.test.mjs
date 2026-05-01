import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const runnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5c_b0_naive_dom_matrix.mjs", import.meta.url)
);
const collectorPath = fileURLToPath(
  new URL("../../scripts/p5/collect_p5c_manual_b0_results.mjs", import.meta.url)
);

function readRunner() {
  return fs.readFileSync(runnerPath, "utf8");
}

function readCollector() {
  return fs.readFileSync(collectorPath, "utf8");
}

test("P5-C URL generator and collector files exist", () => {
  assert.equal(fs.existsSync(runnerPath), true);
  assert.equal(fs.existsSync(collectorPath), true);
});

test("P5-C URL generator references P5-B target and P5-A matrix", () => {
  const source = readRunner();
  assert.ok(source.includes("bench/p5/targets/p5b_naive_dom_baseline.html"));
  assert.ok(source.includes("bench/p5/scenarios/p5a_synthetic_impossible_zone_matrix.json"));
  assert.ok(source.includes("p5c_b0_naive_dom_matrix_results.manual-input.json"));
});

test("P5-C URL generator does not contain browser automation", () => {
  const source = readRunner();
  assert.doesNotMatch(source, /CDP|remote-debugging|WebSocket|headless|spawn|Page\.|Runtime\./i);
  assert.doesNotMatch(source, /captureScreenshot|startScreencast|recordVideo|Tracing\.start/i);
  assert.doesNotMatch(source, /navigator\.gpu|OffscreenCanvas|<canvas|getContext\s*\(/i);
});

test("P5-C URL generator prints 9 manual URLs and manual steps", () => {
  const output = execFileSync(process.execPath, [runnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.match(output, /scenario_count=9/);
  assert.match(output, /p5a_v1000_ctx_small/);
  assert.match(output, /p5a_v10000_ctx_full/);
  assert.match(output, /file:\/\/.*p5b_naive_dom_baseline\.html\?scenario_id=/);
  assert.match(output, /Click typing_proxy/);
  assert.match(output, /Click send_click_proxy/);
  assert.match(output, /Click scroll_jump_return/);
  assert.match(output, /AUDIT_STATUS=PASS/);
});

test("P5-C collector validates boundary language and final output path", () => {
  const source = readCollector();
  assert.ok(source.includes("bench/p5/results/p5c_b0_naive_dom_matrix_results.json"));
  assert.ok(source.includes("B0 naive DOM only"));
  assert.ok(source.includes("B1"));
  assert.ok(source.includes("B2"));
  assert.ok(source.includes("B3"));
  assert.ok(source.includes("R0"));
  assert.ok(source.includes("browser-level INP"));
  assert.ok(source.includes("frame stability"));
  assert.ok(source.includes("impossible-zone success"));
  assert.ok(source.includes("runtime superiority"));
  assert.ok(source.includes("P4 eligibility"));
  assert.ok(source.includes("valid_manual"));
  assert.ok(source.includes("user_chrome_manual"));
});

test("P5-C collector avoids product URLs and capture calls", () => {
  const source = readCollector();
  assert.doesNotMatch(source, /chatgpt|claude|gemini|openai/i);
  assert.doesNotMatch(source, /captureScreenshot|startScreencast|recordVideo|Tracing\.start/i);
  assert.doesNotMatch(source, /navigator\.gpu|OffscreenCanvas|<canvas|getContext\s*\(/i);
});

test("P5-C collector writes final result only from manual input", () => {
  const source = readCollector();
  assert.ok(source.includes("process.argv[2]"));
  assert.ok(source.includes("manual input"));
  assert.ok(source.includes("await fsp.writeFile(resultPath"));
  assert.doesNotMatch(readRunner(), /writeFile|writeFileSync|appendFile|appendFileSync/);
});
