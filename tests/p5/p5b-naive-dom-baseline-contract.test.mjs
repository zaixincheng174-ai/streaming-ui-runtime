import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const targetPath = fileURLToPath(
  new URL("../../bench/p5/targets/p5b_naive_dom_baseline.html", import.meta.url)
);
const runnerPath = fileURLToPath(
  new URL("../../scripts/p5/run_p5b_naive_dom_baseline.mjs", import.meta.url)
);

function readTarget() {
  return fs.readFileSync(targetPath, "utf8");
}

test("P5-B target and runner files exist", () => {
  assert.equal(fs.existsSync(targetPath), true);
  assert.equal(fs.existsSync(runnerPath), true);
});

test("P5-B target includes required interaction hooks", () => {
  const html = readTarget();
  for (const hook of [
    "P5B_NAIVE_DOM_BASELINE",
    "runInteraction",
    "runTypingProxy",
    "runSendClickProxy",
    "runScrollJumpReturn",
    "typing_proxy",
    "send_click_proxy",
    "scroll_jump_return"
  ]) {
    assert.ok(html.includes(hook), `missing hook ${hook}`);
  }
});

test("P5-B target includes required metric fields", () => {
  const html = readTarget();
  for (const field of [
    "initial_render_ms",
    "typing_proxy_ms",
    "send_click_proxy_ms",
    "scroll_jump_return_ms",
    "dom_node_count",
    "active_context_traversal_ms",
    "tail_mutation_ms",
    "append_commit_ms",
    "max_interaction_ms",
    "long_task_like_count_50ms_proxy",
    "run_id"
  ]) {
    assert.ok(html.includes(field), `missing metric field ${field}`);
  }
});

test("P5-B target does not include deferred backend implementations", () => {
  const html = readTarget();
  assert.doesNotMatch(html, /new\s+Worker\b/);
  assert.doesNotMatch(html, /OffscreenCanvas\b/);
  assert.doesNotMatch(html, /navigator\.gpu\b/);
  assert.doesNotMatch(html, /\bwebgpu\b/i);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /\.getContext\s*\(/);
});

test("P5-B runner validates hooks and scenario ids", () => {
  const output = execFileSync(process.execPath, [runnerPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.match(output, /AUDIT_STATUS=PASS/);
  assert.match(output, /scenario_count=9/);
  assert.match(output, /p5a_v1000_ctx_small/);
  assert.match(output, /p5a_v10000_ctx_full/);
  assert.match(output, /typing_proxy/);
  assert.match(output, /send_click_proxy/);
  assert.match(output, /scroll_jump_return/);
});
