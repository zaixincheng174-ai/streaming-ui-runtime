// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canAdmitTransaction,
  canMergeStreamUpdate,
  createBackpressureRejectedDecision,
  shouldRejectProjectionSize,
  shouldThrottleBackground,
  validateBackpressureLimits
} from "../../runtime/core/backpressure-policy.ts";

const limits = {
  max_pending_transactions: 4,
  max_pending_bytes: 1024,
  max_projection_result_bytes: 256,
  max_uncommitted_projection_count: 2
};

function snapshot(overrides = {}) {
  return {
    pending_transactions: 1,
    pending_bytes: 128,
    largest_pending_projection_bytes: 64,
    uncommitted_projection_count: 1,
    background_queue_depth: 0,
    stream_update_queue_depth: 0,
    ...overrides
  };
}

function errorCodes(decision) {
  return decision.errors.map((error) => error.error_code);
}

test("valid limits and low snapshot allow admission", () => {
  const decision = canAdmitTransaction({ priority: "stream-update", projected_bytes: 64 }, snapshot(), limits);

  assert.equal(decision.admit, true);
});

test("invalid priority rejects fail closed", () => {
  const decision = canAdmitTransaction({ priority: "not-a-lane" }, snapshot(), limits);

  assert.equal(decision.admit, false);
  assert.ok(errorCodes(decision).includes("BackpressureLimitExceeded"));
});

test("missing limits fail closed", () => {
  const validation = validateBackpressureLimits(undefined);

  assert.equal(validation.valid, false);
});

test("negative limits fail closed", () => {
  const validation = validateBackpressureLimits({
    ...limits,
    max_pending_transactions: -1
  });

  assert.equal(validation.valid, false);
});

test("fractional limits fail closed", () => {
  for (const field of [
    "max_pending_transactions",
    "max_uncommitted_projection_count",
    "max_pending_bytes",
    "max_projection_result_bytes"
  ]) {
    const validation = validateBackpressureLimits({
      ...limits,
      [field]: 1.5
    });

    assert.equal(validation.valid, false);
  }
});

test("negative snapshot counts fail closed", () => {
  const decision = canAdmitTransaction({ priority: "stream-update" }, snapshot({ pending_bytes: -1 }), limits);

  assert.equal(decision.admit, false);
  assert.ok(errorCodes(decision).includes("BackpressureLimitExceeded"));
});

test("fractional snapshot counts and byte sizes fail closed", () => {
  for (const field of [
    "pending_transactions",
    "background_queue_depth",
    "stream_update_queue_depth",
    "pending_bytes",
    "largest_pending_projection_bytes",
    "uncommitted_projection_count"
  ]) {
    const decision = canAdmitTransaction({ priority: "stream-update" }, snapshot({ [field]: 1.5 }), limits);

    assert.equal(decision.admit, false);
    assert.ok(errorCodes(decision).includes("BackpressureLimitExceeded"));
  }
});

test("pending transaction limit rejects non-urgent work", () => {
  const decision = canAdmitTransaction(
    { priority: "stream-update" },
    snapshot({ pending_transactions: limits.max_pending_transactions }),
    limits
  );

  assert.equal(decision.admit, false);
  assert.ok(errorCodes(decision).includes("BackpressureLimitExceeded"));
});

test("pending byte limit rejects non-urgent work", () => {
  const decision = canAdmitTransaction(
    { priority: "stream-update", projected_bytes: 1 },
    snapshot({ pending_bytes: limits.max_pending_bytes }),
    limits
  );

  assert.equal(decision.admit, false);
  assert.ok(errorCodes(decision).includes("BackpressureLimitExceeded"));
});

test("oversized projection result is rejected", () => {
  assert.equal(shouldRejectProjectionSize({ result_bytes: limits.max_projection_result_bytes + 1 }, limits), true);

  const decision = canAdmitTransaction(
    {
      priority: "visible-projection",
      projection_size: { result_bytes: limits.max_projection_result_bytes + 1 }
    },
    snapshot(),
    limits
  );

  assert.equal(decision.admit, false);
  assert.ok(errorCodes(decision).includes("ProjectionTooLarge"));
});

test("fractional projected and projection result byte sizes fail closed", () => {
  const projectedBytesDecision = canAdmitTransaction(
    { priority: "stream-update", projected_bytes: 1.5 },
    snapshot(),
    limits
  );
  const projectionSizeDecision = canAdmitTransaction(
    {
      priority: "visible-projection",
      projection_size: { result_bytes: 1.5 }
    },
    snapshot(),
    limits
  );

  assert.equal(projectedBytesDecision.admit, false);
  assert.ok(errorCodes(projectedBytesDecision).includes("BackpressureLimitExceeded"));
  assert.equal(shouldRejectProjectionSize({ result_bytes: 1.5 }, limits), true);
  assert.equal(projectionSizeDecision.admit, false);
  assert.ok(errorCodes(projectionSizeDecision).includes("ProjectionTooLarge"));
});

test("uncommitted projection limit rejects additional visible projection", () => {
  const decision = canAdmitTransaction(
    { priority: "visible-projection" },
    snapshot({ uncommitted_projection_count: limits.max_uncommitted_projection_count }),
    limits
  );

  assert.equal(decision.admit, false);
  assert.ok(errorCodes(decision).includes("BackpressureLimitExceeded"));
});

test("urgent-input is not dropped under pressure", () => {
  const decision = canAdmitTransaction(
    { priority: "urgent-input" },
    snapshot({
      pending_transactions: limits.max_pending_transactions,
      pending_bytes: limits.max_pending_bytes + 1,
      uncommitted_projection_count: limits.max_uncommitted_projection_count
    }),
    limits
  );

  assert.equal(decision.admit, true);
  assert.equal(decision.throttle_background, true);
});

test("background-indexing is throttled under pressure", () => {
  assert.equal(
    shouldThrottleBackground(snapshot({ pending_transactions: limits.max_pending_transactions }), limits),
    true
  );
});

test("stream-update is mergeable only when semantic equivalence is explicitly preserved", () => {
  assert.equal(canMergeStreamUpdate({ semantic_equivalence_preserved: true }), true);
});

test("stream-update is not mergeable without semantic equivalence", () => {
  assert.equal(canMergeStreamUpdate({ semantic_equivalence_preserved: false }), false);
  assert.equal(canMergeStreamUpdate(undefined), false);
});

test("rejection includes RuntimeErrorCode for backpressure and projection size failures", () => {
  const backpressureDecision = createBackpressureRejectedDecision("pressure", "BackpressureLimitExceeded");
  const projectionDecision = createBackpressureRejectedDecision("too large", "ProjectionTooLarge");

  assert.ok(errorCodes(backpressureDecision).includes("BackpressureLimitExceeded"));
  assert.ok(errorCodes(projectionDecision).includes("ProjectionTooLarge"));
});

test("source does not import or use browser runtime or capture APIs", () => {
  const source = readFileSync(new URL("../../runtime/core/backpressure-policy.ts", import.meta.url), "utf8");
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
    "navigator" + ".gpu",
    "Tracing" + ".start",
    "run_single_capture" + "_no_warmup"
  ];

  for (const token of forbiddenTokens) {
    assert.equal(source.includes(token), false);
  }
});
