#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = path.join(repoRoot, "bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json");
const targetPath = path.join(repoRoot, "bench/p5/targets/p5m_r0c_concurrent_input_stress.html");
const manualInputPath = "bench/p5/results/p5m_r0c_concurrent_input_results.manual-input.json";
const finalResultPath = "bench/p5/results/p5m_r0c_concurrent_input_results.json";

function main() {
  assertFile(matrixPath, "P5-D matrix");
  assertFile(targetPath, "P5-M R0m target");
  const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  const scenarios = Array.isArray(matrix.scenarios) ? matrix.scenarios : [];
  if (scenarios.length === 0) {
    throw new Error("P5-D matrix has no scenarios");
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
  console.log("P5-M R0c Concurrent Input Manual URL Generator");
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
  console.log("2. Wait for #p5m-r0c-summary-json to show the scenario_id and initial render.");
  console.log("3. Click concurrent_input_during_send_proxy.");
  console.log("4. Copy the JSON object from #p5m-r0c-summary-json.");
  console.log(`5. Paste that object as one row in ${manualInputPath}.`);
  console.log();
  console.log("Manual input template:");
  console.log(JSON.stringify(manualInputTemplate(urls), null, 2));
  console.log();
  console.log("Boundary:");
  console.log("- R0c concurrent-input worker/bounded-projection compact-context path only");
  console.log("- internal scheduling-delay proxy, not browser-level INP");
  console.log("- reuses the exact P5-D stress matrix");
  console.log("- no browser automation, screenshots, traces, videos, product sites, or P4 authorization");
  console.log("- no WebGPU or Canvas");
  console.log();
  console.log("After all rows are pasted, run:");
  console.log(`node scripts/p5/collect_p5m_manual_r0c_concurrent_results.mjs ${manualInputPath}`);
  console.log();
  console.log("AUDIT_STATUS=PASS");
}

function manualInputTemplate(urls) {
  return {
    schema_version: "p5m.r0c-concurrent-input-manual-input.v0",
    collection_mode: "manual_user_chrome",
    rows: urls.map((entry) => ({
      scenario_id: entry.scenario_id,
      paste_from: "#p5m-r0c-summary-json"
    }))
  };
}

main();
