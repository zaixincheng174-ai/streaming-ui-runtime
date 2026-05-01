import assert from "node:assert/strict";
import test from "node:test";

import {
  auditP5AWorkload,
  expandP5AScenarios,
  generateSyntheticLongSessionWorkload,
  getP5ABaselineInventory,
  loadP5AMatrix,
  summarizeP5AWorkload
} from "../../bench/p5/lib/synthetic-long-session-workload.mjs";

const matrixUrl = new URL(
  "../../bench/p5/scenarios/p5a_synthetic_impossible_zone_matrix.json",
  import.meta.url
);

function loadScenarios() {
  return expandP5AScenarios(loadP5AMatrix(matrixUrl));
}

test("P5-A workload generation is deterministic", () => {
  for (const scenario of loadScenarios()) {
    const first = generateSyntheticLongSessionWorkload(scenario);
    const second = generateSyntheticLongSessionWorkload(scenario);

    assert.deepEqual(summarizeP5AWorkload(first), summarizeP5AWorkload(second));
    assert.deepEqual(first.recall_probes, second.recall_probes);
    assert.deepEqual(first.tail_mutations, second.tail_mutations);
    assert.deepEqual(first.artifact_placeholders, second.artifact_placeholders);
  }
});

test("small, medium, and full active context windows behave correctly", () => {
  for (const scenario of loadScenarios()) {
    if (scenario.active_context_mode === "small") {
      assert.equal(scenario.active_context_window, 128);
    }

    if (scenario.active_context_mode === "medium") {
      assert.equal(scenario.active_context_window, 1000);
    }

    if (scenario.active_context_mode === "full") {
      assert.equal(scenario.active_context_window, scenario.visible_block_count);
    }
  }
});

test("full active context equals visible block count in generated workloads", () => {
  const fullScenarios = loadScenarios().filter((scenario) => scenario.active_context_mode === "full");
  assert.ok(fullScenarios.length > 0);

  for (const scenario of fullScenarios) {
    const workload = generateSyntheticLongSessionWorkload(scenario);
    assert.equal(workload.active_context_window, workload.visible_block_count);
    assert.equal(workload.active_context_index.length, workload.visible_block_count);
  }
});

test("recall probes stay within active context", () => {
  for (const scenario of loadScenarios()) {
    const workload = generateSyntheticLongSessionWorkload(scenario);
    const activeStart = workload.visible_block_count - workload.active_context_window + 1;

    for (const probe of workload.recall_probes) {
      assert.ok(probe.ordinal >= activeStart, `${probe.probe_id} is before active context`);
      assert.ok(probe.ordinal <= workload.visible_block_count, `${probe.probe_id} is after visible range`);
    }
  }
});

test("tail mutations stay within tail range", () => {
  for (const scenario of loadScenarios()) {
    const workload = generateSyntheticLongSessionWorkload(scenario);
    const tailStart = workload.visible_block_count - workload.tail_mutations.length + 1;

    for (const mutation of workload.tail_mutations) {
      assert.ok(mutation.ordinal >= tailStart, `${mutation.mutation_id} is before tail range`);
      assert.ok(mutation.ordinal <= workload.visible_block_count, `${mutation.mutation_id} is after visible range`);
    }
  }
});

test("audit passes deterministic workload invariants", () => {
  for (const scenario of loadScenarios()) {
    const result = auditP5AWorkload(generateSyntheticLongSessionWorkload(scenario));
    assert.equal(result.ok, true, result.errors.join("; "));
  }
});

test("baseline inventory includes B0/B1/B2/B3/R0 with status and limitation", () => {
  const inventory = getP5ABaselineInventory();
  const byId = new Map(inventory.map((entry) => [entry.baseline_id, entry]));

  for (const baselineId of ["B0", "B1", "B2", "B3", "R0"]) {
    const entry = byId.get(baselineId);
    assert.ok(entry, `${baselineId} missing from baseline inventory`);
    assert.match(entry.status, /^(exists|partial|missing)$/);
    assert.ok(entry.current_limitation.length > 0);
    assert.ok(entry.next_required_patch.length > 0);
  }
});
