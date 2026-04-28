// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  shouldCommitProjection,
  createProjectionRejectedDecision,
  isStaleProjection,
  validateProjectionBounds
} from "../../runtime/core/projection-policy.ts";

const bounds = {
  max_blocks: 2,
  max_result_bytes: 100,
  require_checksum: true,
  allow_stale_compatible: false
};

const equivalentWorkCounters = {
  module_flush_count: 20,
  subscriber_notify_count: 1920,
  queue_drain_step_count: 5120,
  derived_selector_eval_count: 15360,
  state_nodes_touched_observed: 32768,
  derived_hash_rounds_observed: 131072,
  projection_update_count_observed: 6
};

function projection(overrides = {}) {
  return {
    projection_id: "projection-1",
    txn_id: "txn-1",
    session_version: 3,
    result_version: 1,
    visible_range: {
      start_block_id: "block-1",
      end_block_id: "block-2"
    },
    blocks: [
      {
        block_id: "block-1",
        estimated_bytes: 40
      },
      {
        block_id: "block-2",
        estimated_bytes: 40
      }
    ],
    checksum: "projection-checksum-1",
    stale_status: "fresh",
    ...overrides
  };
}

function errorCodes(decision) {
  return decision.errors.map((error) => error.error_code);
}

test("stale projection is rejected when result session_version is older than current session_version", () => {
  const decision = shouldCommitProjection(projection({ session_version: 2, stale_status: "stale" }), 3, bounds);

  assert.equal(isStaleProjection(2, 3), true);
  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("StaleProjectionRejected"));
});

test("current-version projection is accepted when bounded and checksummed", () => {
  const decision = shouldCommitProjection(projection(), 3, bounds);

  assert.equal(decision.commit, true);
});

test("projection without equivalent_work_counters remains valid when otherwise bounded", () => {
  const decision = shouldCommitProjection(projection(), 3, bounds);

  assert.equal(decision.commit, true);
});

test("projection with malformed optional equivalent_work_counters fails closed", () => {
  const decision = shouldCommitProjection(
    projection({
      equivalent_work_counters: {
        ...equivalentWorkCounters,
        projection_update_count_observed: 6.5
      }
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("EquivalenceMismatch"));
});

test("valid finite projection bounds still pass", () => {
  const decision = shouldCommitProjection(
    projection({
      visible_range: {
        start_block_id: "block-1",
        end_block_id: "block-1"
      },
      blocks: [{ block_id: "block-1", estimated_bytes: 40 }]
    }),
    3,
    {
      ...bounds,
      max_blocks: 1,
      max_result_bytes: 40
    }
  );

  assert.equal(decision.commit, true);
});

test("NaN projection bound fails closed", () => {
  const decision = shouldCommitProjection(projection(), 3, {
    ...bounds,
    max_result_bytes: Number.NaN
  });

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("ProjectionTooLarge"));
});

test("Infinity projection bound fails closed", () => {
  const decision = shouldCommitProjection(projection(), 3, {
    ...bounds,
    max_result_bytes: Number.POSITIVE_INFINITY
  });

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("ProjectionTooLarge"));
});

test("non-integer max_blocks fails closed", () => {
  const decision = shouldCommitProjection(projection(), 3, {
    ...bounds,
    max_blocks: 1.5
  });

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("ProjectionTooLarge"));
});

test("missing require_checksum fails closed", () => {
  const incompleteBounds = { ...bounds };
  delete incompleteBounds.require_checksum;

  const decision = shouldCommitProjection(projection(), 3, incompleteBounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("MissingRequiredField"));
});

test("non-boolean require_checksum fails closed", () => {
  const decision = shouldCommitProjection(projection(), 3, {
    ...bounds,
    require_checksum: "yes"
  });

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("MissingRequiredField"));
});

test("missing allow_stale_compatible fails closed", () => {
  const incompleteBounds = { ...bounds };
  delete incompleteBounds.allow_stale_compatible;

  const decision = shouldCommitProjection(projection(), 3, incompleteBounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("MissingRequiredField"));
});

test("non-boolean allow_stale_compatible fails closed", () => {
  const decision = shouldCommitProjection(projection(), 3, {
    ...bounds,
    allow_stale_compatible: "no"
  });

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("MissingRequiredField"));
});

test("missing checksum cannot commit when bounds are incomplete", () => {
  const result = projection();
  const incompleteBounds = { ...bounds };
  delete result.checksum;
  delete incompleteBounds.require_checksum;

  const decision = shouldCommitProjection(result, 3, incompleteBounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("MissingRequiredField"));
});

test("NaN projection block estimated bytes fail closed", () => {
  const decision = shouldCommitProjection(
    projection({
      blocks: [{ block_id: "block-1", estimated_bytes: Number.NaN }]
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("ProjectionTooLarge"));
});

test("Infinity projection block estimated bytes fail closed", () => {
  const decision = shouldCommitProjection(
    projection({
      blocks: [{ block_id: "block-1", estimated_bytes: Number.POSITIVE_INFINITY }]
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("ProjectionTooLarge"));
});

test("fractional projection block estimated bytes fail closed", () => {
  const decision = shouldCommitProjection(
    projection({
      blocks: [{ block_id: "block-1", estimated_bytes: 1.5 }]
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("ProjectionTooLarge"));
});

test("future-version projection fails closed by default", () => {
  const decision = shouldCommitProjection(projection({ session_version: 4 }), 3, bounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("StaleProjectionRejected"));
});

test("fractional projection session_version fails closed", () => {
  const decision = shouldCommitProjection(projection({ session_version: 3.5 }), 3.5, bounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("StaleProjectionRejected"));
});

test("fractional current session version fails closed", () => {
  const decision = shouldCommitProjection(projection({ session_version: 3 }), 3.5, bounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("StaleProjectionRejected"));
});

test("missing checksum fails closed when required", () => {
  const result = projection();
  delete result.checksum;

  const decision = shouldCommitProjection(result, 3, bounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("InvalidChecksum"));
});

test("missing projection_id fails closed", () => {
  const result = projection();
  delete result.projection_id;

  const decision = shouldCommitProjection(result, 3, bounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("MissingRequiredField"));
});

test("missing txn_id fails closed", () => {
  const result = projection();
  delete result.txn_id;

  const decision = shouldCommitProjection(result, 3, bounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("MissingRequiredField"));
});

test("missing result_version fails closed", () => {
  const result = projection();
  delete result.result_version;

  const decision = shouldCommitProjection(result, 3, bounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("MissingRequiredField"));
});

test("invalid result_version values fail closed", () => {
  for (const result_version of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 1.5]) {
    const decision = shouldCommitProjection(projection({ result_version }), 3, bounds);

    assert.equal(decision.commit, false);
    assert.ok(errorCodes(decision).includes("MissingRequiredField"));
  }
});

test("validateProjectionBounds rejects missing session_version", () => {
  const result = projection();
  delete result.session_version;

  const validation = validateProjectionBounds(result, bounds);

  assert.equal(validation.valid, false);
  assert.ok(errorCodes(validation).includes("StaleProjectionRejected"));
});

test("validateProjectionBounds rejects invalid session_version values", () => {
  for (const session_version of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    1.5
  ]) {
    const validation = validateProjectionBounds(projection({ session_version }), bounds);

    assert.equal(validation.valid, false);
    assert.ok(errorCodes(validation).includes("StaleProjectionRejected"));
  }
});

test("validateProjectionBounds accepts valid integer session_version", () => {
  const validation = validateProjectionBounds(projection({ session_version: 3 }), bounds);

  assert.equal(validation.valid, true);
});

test("missing visible_range fails closed", () => {
  const result = projection();
  delete result.visible_range;

  const decision = shouldCommitProjection(result, 3, bounds);

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("MissingRequiredField"));
});

test("malformed projection visible_range fails closed", () => {
  const cases = [
    projection({ visible_range: {} }),
    projection({ visible_range: [] }),
    projection({ visible_range: { start_block_id: "block-1" } }),
    projection({ visible_range: { start_block_id: "", end_block_id: "block-2" } }),
    projection({ visible_range: { start_block_id: "block-1", end_block_id: "block-2", anchor_block_id: "" } })
  ];

  for (const result of cases) {
    const decision = shouldCommitProjection(result, 3, bounds);

    assert.equal(decision.commit, false);
    assert.ok(errorCodes(decision).includes("MissingRequiredField"));
  }
});

test("visible_range start and end block ids present in blocks passes", () => {
  const decision = shouldCommitProjection(
    projection({
      visible_range: {
        start_block_id: "block-1",
        end_block_id: "block-2"
      },
      blocks: [
        { block_id: "block-1", estimated_bytes: 20 },
        { block_id: "block-2", estimated_bytes: 20 }
      ]
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, true);
});

test("visible_range start_block_id absent from blocks fails closed", () => {
  const decision = shouldCommitProjection(
    projection({
      visible_range: {
        start_block_id: "missing-block",
        end_block_id: "block-2"
      }
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("EquivalenceMismatch"));
});

test("visible_range end_block_id absent from blocks fails closed", () => {
  const decision = shouldCommitProjection(
    projection({
      visible_range: {
        start_block_id: "block-1",
        end_block_id: "missing-block"
      }
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("EquivalenceMismatch"));
});

test("visible_range anchor_block_id must reference a projection block when present", () => {
  const accepted = shouldCommitProjection(
    projection({
      visible_range: {
        start_block_id: "block-1",
        end_block_id: "block-2",
        anchor_block_id: "block-2"
      }
    }),
    3,
    bounds
  );

  const rejected = shouldCommitProjection(
    projection({
      visible_range: {
        start_block_id: "block-1",
        end_block_id: "block-2",
        anchor_block_id: "missing-block"
      }
    }),
    3,
    bounds
  );

  assert.equal(accepted.commit, true);
  assert.equal(rejected.commit, false);
  assert.ok(errorCodes(rejected).includes("EquivalenceMismatch"));
});

test("oversized blocks fail closed", () => {
  const decision = shouldCommitProjection(
    projection({
      blocks: [
        { block_id: "block-1", estimated_bytes: 20 },
        { block_id: "block-2", estimated_bytes: 20 },
        { block_id: "block-3", estimated_bytes: 20 }
      ]
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("ProjectionTooLarge"));
});

test("non-array blocks fail closed", () => {
  const decision = shouldCommitProjection(
    projection({
      blocks: { block_id: "block-1", estimated_bytes: 10 }
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("MissingRequiredField"));
});

test("malformed projection block objects fail closed", () => {
  const cases = [
    projection({ blocks: [null] }),
    projection({ blocks: [[]] }),
    projection({ blocks: [{ estimated_bytes: 10 }] }),
    projection({ blocks: [{ block_id: "", estimated_bytes: 10 }] }),
    projection({ blocks: [{ block_id: "block-1" }] })
  ];

  for (const result of cases) {
    const decision = shouldCommitProjection(result, 3, bounds);

    assert.equal(decision.commit, false);
  }
});

test("duplicate projection block_id fails closed", () => {
  const decision = shouldCommitProjection(
    projection({
      blocks: [
        { block_id: "block-1", estimated_bytes: 10 },
        { block_id: "block-1", estimated_bytes: 20 }
      ]
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("EquivalenceMismatch"));
});

test("oversized estimated bytes fail closed", () => {
  const decision = shouldCommitProjection(
    projection({
      visible_range: {
        start_block_id: "block-1",
        end_block_id: "block-1"
      },
      blocks: [{ block_id: "block-1", estimated_bytes: 101 }]
    }),
    3,
    bounds
  );

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("ProjectionTooLarge"));
});

test("stale compatible projection is accepted only when bounds allow stale compatible", () => {
  const staleCompatible = projection({ session_version: 2, stale_status: "compatible" });

  const rejected = shouldCommitProjection(staleCompatible, 3, bounds);
  const accepted = shouldCommitProjection(staleCompatible, 3, {
    ...bounds,
    allow_stale_compatible: true
  });

  assert.equal(rejected.commit, false);
  assert.equal(accepted.commit, true);
});

test("returned rejection includes requested RuntimeErrorCode", () => {
  const decision = createProjectionRejectedDecision("too large", "ProjectionTooLarge");

  assert.equal(decision.commit, false);
  assert.ok(errorCodes(decision).includes("ProjectionTooLarge"));
});

test("source does not import or use browser/runtime APIs", () => {
  const source = readFileSync(new URL("../../runtime/core/projection-policy.ts", import.meta.url), "utf8");
  const forbiddenTokens = [
    "docu" + "ment",
    "win" + "dow",
    "new " + "Worker" + "(",
    "from \"" + "react" + "\"",
    "from '" + "react" + "'",
    "HTML" + "CanvasElement",
    "Offscreen" + "Canvas",
    "Canvas" + "RenderingContext2D",
    "Web" + "GPU",
    "GPU" + "Device",
    "navigator" + ".gpu"
  ];

  for (const token of forbiddenTokens) {
    assert.equal(source.includes(token), false);
  }
});
