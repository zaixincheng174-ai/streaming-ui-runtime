#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = path.join(repoRoot, "bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json");
const targetPath = path.join(repoRoot, "bench/p5/targets/p5q_b2c_dynamic_context_stress.html");
const manualInputPath = "bench/p5/results/p5q_b2c_dynamic_context_results.manual-input.json";
const collectorCommand =
  "node scripts/p5/collect_p5q_manual_b2c_dynamic_context_results.mjs " + manualInputPath;

function main() {
  assertFile(matrixPath, "P5-D matrix");
  assertFile(targetPath, "P5-Q B2q target");

  const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  const scenarios = Array.isArray(matrix.scenarios) ? matrix.scenarios : [];

  console.log("P5-Q B2q Dynamic Active-Context Manual URL Generator");
  console.log("target=bench/p5/targets/p5q_b2c_dynamic_context_stress.html");
  console.log(`scenario_count=${scenarios.length}`);
  console.log("");
  console.log("Manual steps:");
  console.log("1. open URL in Chrome");
  console.log("2. wait for #p5q-b2c-summary-json to show scenario_id");
  console.log("3. click dynamic_context_send_proxy");
  console.log("4. copy #p5q-b2c-summary-json");
  console.log(`5. paste row into ${manualInputPath}`);
  console.log("");
  console.log("Manual URLs:");

  for (const scenario of scenarios) {
    const url = new URL(pathToFileURL(targetPath));
    url.searchParams.set("scenario_id", scenario.scenario_id);
    console.log(`${scenario.scenario_id} ${url.href}`);
  }

  console.log("");
  console.log("Collector command:");
  console.log(collectorCommand);
  console.log("AUDIT_STATUS=PASS");
}

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing ${label}: ${filePath}`);
  }
}

main();
