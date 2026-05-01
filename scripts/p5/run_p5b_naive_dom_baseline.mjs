#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const targetPath = path.join(repoRoot, "bench/p5/targets/p5b_naive_dom_baseline.html");
const matrixPath = path.join(repoRoot, "bench/p5/scenarios/p5a_synthetic_impossible_zone_matrix.json");

const REQUIRED_HOOKS = [
  "P5B_NAIVE_DOM_BASELINE",
  "runInteraction",
  "runTypingProxy",
  "runSendClickProxy",
  "runScrollJumpReturn",
  "typing_proxy",
  "send_click_proxy",
  "scroll_jump_return"
];

const REQUIRED_DOM_IDS = [
  "p5b-summary-json",
  "typing-proxy-button",
  "send-click-proxy-button",
  "scroll-jump-return-button"
];

const REQUIRED_METRIC_FIELDS = [
  "scenario_id",
  "visible_block_count",
  "active_context_mode",
  "active_context_window",
  "initial_render_ms",
  "dom_node_count",
  "typing_proxy_ms",
  "send_click_proxy_ms",
  "scroll_jump_return_ms",
  "active_context_traversal_ms",
  "tail_mutation_ms",
  "append_commit_ms",
  "max_interaction_ms",
  "long_task_like_count_50ms_proxy",
  "timestamp",
  "run_id"
];

const FORBIDDEN_IMPLEMENTATION_PATTERNS = [
  /new\s+Worker\b/,
  /OffscreenCanvas\b/,
  /navigator\.gpu\b/,
  /\bwebgpu\b/i,
  /<canvas\b/i,
  /\.getContext\s*\(/
];

function main() {
  const errors = [];
  if (!fs.existsSync(targetPath)) {
    errors.push(`missing target: ${targetPath}`);
  }
  if (!fs.existsSync(matrixPath)) {
    errors.push(`missing matrix: ${matrixPath}`);
  }

  const targetHtml = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : "";
  const matrix = fs.existsSync(matrixPath) ? JSON.parse(fs.readFileSync(matrixPath, "utf8")) : { scenarios: [] };
  const scenarioIds = Array.isArray(matrix.scenarios)
    ? matrix.scenarios.map((scenario) => scenario.scenario_id)
    : [];

  errors.push(...missingNeedles(targetHtml, REQUIRED_HOOKS, "required hook"));
  errors.push(...missingNeedles(targetHtml, REQUIRED_DOM_IDS, "required DOM id"));
  errors.push(...missingNeedles(targetHtml, REQUIRED_METRIC_FIELDS, "required metric field"));

  for (const pattern of FORBIDDEN_IMPLEMENTATION_PATTERNS) {
    if (pattern.test(targetHtml)) {
      errors.push(`forbidden implementation pattern present: ${pattern}`);
    }
  }

  if (scenarioIds.length === 0) {
    errors.push("no scenario ids found in P5-A matrix");
  }

  if (errors.length > 0) {
    console.error("P5-B naive DOM baseline contract failures:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const targetUrl = pathToFileURL(targetPath);
  targetUrl.searchParams.set("scenario_id", scenarioIds[0]);

  console.log("P5-B Naive DOM Baseline Static Contract Audit");
  console.log(`target=${targetPath}`);
  console.log(`matrix=${matrixPath}`);
  console.log(`scenario_count=${scenarioIds.length}`);
  console.log(`scenario_ids=${scenarioIds.join(",")}`);
  console.log(`default_manual_url=${targetUrl.href}`);
  console.log();
  console.log("Manual local run:");
  console.log(`  open '${targetUrl.href}'`);
  console.log("  Click typing_proxy, send_click_proxy, and scroll_jump_return.");
  console.log("  Read the machine summary from #p5b-summary-json or window.__P5B_NAIVE_DOM_SUMMARY__.");
  console.log();
  console.log("AUDIT_STATUS=PASS");
}

function missingNeedles(content, needles, label) {
  return needles
    .filter((needle) => !content.includes(needle))
    .map((needle) => `missing ${label}: ${needle}`);
}

main();
