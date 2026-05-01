#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = path.join(repoRoot, "bench/p5/scenarios/p5a_synthetic_impossible_zone_matrix.json");
const targetPath = path.join(repoRoot, "bench/p5/targets/p5b_naive_dom_baseline.html");
const manualInputPath = "bench/p5/results/p5c_b0_naive_dom_matrix_results.manual-input.json";
const finalResultPath = "bench/p5/results/p5c_b0_naive_dom_matrix_results.json";

function main() {
  assertFile(matrixPath, "P5-A matrix");
  assertFile(targetPath, "P5-B target");

  const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  const scenarios = Array.isArray(matrix.scenarios) ? matrix.scenarios : [];
  if (scenarios.length === 0) {
    throw new Error("P5-A matrix has no scenarios");
  }

  const urls = scenarios.map((scenario) => ({
    scenario_id: scenario.scenario_id,
    url: scenarioUrl(scenario.scenario_id)
  }));

  printManualWorkflow(urls);
}

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing ${label}: ${filePath}`);
  }
}

function scenarioUrl(scenarioId) {
  const targetUrl = pathToFileURL(targetPath);
  targetUrl.searchParams.set("scenario_id", scenarioId);
  return targetUrl.href;
}

function printManualWorkflow(urls) {
  console.log("P5-C B0 Naive DOM Manual Measurement URL Generator");
  console.log(`target=${path.relative(repoRoot, targetPath)}`);
  console.log(`matrix=${path.relative(repoRoot, matrixPath)}`);
  console.log(`scenario_count=${urls.length}`);
  console.log(`manual_input_path=${manualInputPath}`);
  console.log(`final_result_path=${finalResultPath}`);
  console.log();
  console.log("Manual file URLs:");
  urls.forEach((entry, index) => {
    console.log(`${String(index + 1).padStart(2, "0")}. ${entry.scenario_id}`);
    console.log(`    ${entry.url}`);
  });
  console.log();
  console.log("Manual steps for each URL:");
  console.log("1. Open the URL in Chrome.");
  console.log("2. Wait for initial render to complete and for #p5b-summary-json to show the scenario_id.");
  console.log("3. Click typing_proxy.");
  console.log("4. Click send_click_proxy.");
  console.log("5. Click scroll_jump_return.");
  console.log("6. Copy the JSON object from #p5b-summary-json.");
  console.log(`7. Paste that object as one row in ${manualInputPath}.`);
  console.log();
  console.log("Manual input template:");
  console.log(JSON.stringify(manualInputTemplate(urls), null, 2));
  console.log();
  console.log("Boundary:");
  console.log("- manual B0 proxy measurement only");
  console.log("- not browser-level INP");
  console.log("- not frame stability");
  console.log("- not impossible-zone success");
  console.log("- not runtime superiority");
  console.log("- not P4 authorization");
  console.log();
  console.log("After all 9 rows are pasted, run:");
  console.log(`node scripts/p5/collect_p5c_manual_b0_results.mjs ${manualInputPath}`);
  console.log();
  console.log("AUDIT_STATUS=PASS");
}

function manualInputTemplate(urls) {
  return {
    schema_version: "p5c.b0-naive-dom-manual-input.v0",
    collection_mode: "manual_user_chrome",
    rows: urls.map((entry) => ({
      scenario_id: entry.scenario_id,
      paste_from: "#p5b-summary-json"
    }))
  };
}

main();
