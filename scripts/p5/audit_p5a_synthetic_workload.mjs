#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import {
  auditP5AWorkload,
  expandP5AScenarios,
  generateSyntheticLongSessionWorkload,
  getP5ABaselineInventory,
  loadP5AMatrix,
  summarizeP5AWorkload
} from "../../bench/p5/lib/synthetic-long-session-workload.mjs";

const matrixPath = fileURLToPath(
  new URL("../../bench/p5/scenarios/p5a_synthetic_impossible_zone_matrix.json", import.meta.url)
);

function main() {
  const matrix = loadP5AMatrix(matrixPath);
  const scenarios = expandP5AScenarios(matrix);
  const workloads = scenarios.map((scenario) => generateSyntheticLongSessionWorkload(scenario));
  const auditResults = workloads.map((workload) => auditP5AWorkload(workload));
  const failed = auditResults.filter((result) => !result.ok);

  printSummary(matrix, scenarios, workloads);

  if (failed.length > 0) {
    console.log();
    console.error("P5-A invariant failures:");
    for (const result of failed) {
      console.error(`- ${result.summary.scenario_id}`);
      for (const error of result.errors) {
        console.error(`  - ${error}`);
      }
    }
    process.exit(1);
  }

  console.log();
  console.log("AUDIT_STATUS=PASS");
}

function printSummary(matrix, scenarios, workloads) {
  const summaries = workloads.map((workload) => summarizeP5AWorkload(workload));
  const visibleBlockCounts = unique(summaries.map((summary) => summary.visible_block_count));
  const activeModes = unique(summaries.map((summary) => summary.active_context_mode));
  const activeWindows = activeModes.map((mode) => {
    if (mode === "full") {
      return "full:per-visible-block-count";
    }

    const modeWindows = unique(
      summaries
        .filter((summary) => summary.active_context_mode === mode)
        .map((summary) => summary.active_context_window)
    );
    return `${mode}:${modeWindows.join("/")}`;
  });

  console.log("P5-A Synthetic Workload Audit");
  console.log(`matrix=${matrixPath}`);
  console.log(`schema_version=${matrix.schema_version}`);
  console.log(`scenario_count=${scenarios.length}`);
  console.log(`visible_block_count_values=${visibleBlockCounts.join(",")}`);
  console.log(`active_context_modes=${activeModes.join(",")}`);
  console.log(`active_context_windows=${activeWindows.join(",")}`);
  console.log();
  console.log("Scenario matrix:");
  for (const summary of summaries) {
    console.log(
      [
        `- ${summary.scenario_id}`,
        `visible=${summary.visible_block_count}`,
        `active=${summary.active_context_mode}`,
        `window=${summary.active_context_window}`,
        `blocks=${summary.block_count}`,
        `append=${summary.append_stream_count}`,
        `tail_mutations=${summary.tail_mutation_count}`,
        `recall_probes=${summary.recall_probe_count}`,
        `artifact_placeholders=${summary.artifact_placeholder_count}`,
        `interactions=${summary.interaction_types.join("|")}`
      ].join(" ")
    );
  }

  console.log();
  console.log("Baseline inventory:");
  for (const entry of getP5ABaselineInventory()) {
    console.log(
      `- ${entry.baseline_id} ${entry.name}: status=${entry.status}; limitation=${entry.current_limitation}; next=${entry.next_required_patch}`
    );
    console.log(`  files=${entry.likely_files.join(",")}`);
  }
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") {
      return a - b;
    }

    return String(a).localeCompare(String(b));
  });
}

main();
