#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const matrixPath = path.join(repoRoot, "bench/p5/scenarios/p5d_b0_stress_calibration_matrix.json");
const targetPath = path.join(repoRoot, "bench/p5/targets/p5u_r0c_multistream_agent_trace_stress.html");
const manualInputPath = "bench/p5/results/p5u_r0c_multistream_agent_trace_results.manual-input.json";
const collectorCommand =
  "node scripts/p5/collect_p5u_manual_r0c_multistream_agent_trace_results.mjs " + manualInputPath;

function main() {
  assertFile(matrixPath, "P5-D matrix");
  assertFile(targetPath, "P5-U R0u target");

  const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  const scenarios = Array.isArray(matrix.scenarios) ? matrix.scenarios : [];

  console.log("P5-U R0u Multistream Agent Trace Manual URL Generator");
  console.log("target=bench/p5/targets/p5u_r0c_multistream_agent_trace_stress.html");
  console.log(`scenario_count=${scenarios.length}`);
  console.log("");
  console.log("Manual steps:");
  console.log("1. open URL in Chrome");
  console.log("2. wait for #p5u-r0c-summary-json to show scenario_id");
  console.log("3. click concurrent_input_during_multistream_proxy");
  console.log("4. copy #p5u-r0c-summary-json");
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
