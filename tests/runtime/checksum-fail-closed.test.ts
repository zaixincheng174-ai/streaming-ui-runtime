// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import {
  validateEquivalentWorkCounters,
  validateProjectionChecksum,
  validateWorkerResultChecksum
} from "../../runtime/core/checksums.ts";
import { createRuntimeError } from "../../runtime/core/errors.ts";

const expectedCounters = {
  module_flush_count: 20,
  subscriber_notify_count: 1920,
  queue_drain_step_count: 5120,
  derived_selector_eval_count: 15360,
  state_nodes_touched_observed: 32768,
  derived_hash_rounds_observed: 131072,
  projection_update_count_observed: 6
};

function errorCodes(result) {
  return result.errors.map((error) => error.error_code);
}

test("missing worker_result_checksum fails closed in test mode", () => {
  const result = validateWorkerResultChecksum(undefined);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("InvalidChecksum"));
});

test("reduced equivalent_work_counters fail closed", () => {
  const result = validateEquivalentWorkCounters(
    {
      ...expectedCounters,
      subscriber_notify_count: expectedCounters.subscriber_notify_count - 1
    },
    expectedCounters
  );

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("EquivalenceMismatch"));
});

test("matching equivalent_work_counters pass", () => {
  const result = validateEquivalentWorkCounters({ ...expectedCounters }, expectedCounters);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("equivalent_work_counters require finite non-negative integer values", () => {
  for (const value of [6.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
    const result = validateEquivalentWorkCounters(
      {
        ...expectedCounters,
        projection_update_count_observed: value
      },
      expectedCounters
    );

    assert.equal(result.valid, false);
    assert.ok(errorCodes(result).includes("EquivalenceMismatch"));
  }
});

test("missing equivalent_work_counters field fails closed", () => {
  const counters = { ...expectedCounters };
  delete counters.projection_update_count_observed;

  const result = validateEquivalentWorkCounters(counters, expectedCounters);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("EquivalenceMismatch"));
});

test("invalid or missing projection checksum shape fails closed", () => {
  const result = validateProjectionChecksum("");

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("InvalidChecksum"));
});

test("non-finite numeric checksums fail closed", () => {
  const workerResult = validateWorkerResultChecksum(Number.NaN);
  const projectionResult = validateProjectionChecksum(Number.POSITIVE_INFINITY);

  assert.equal(workerResult.valid, false);
  assert.equal(projectionResult.valid, false);
  assert.ok(errorCodes(workerResult).includes("InvalidChecksum"));
  assert.ok(errorCodes(projectionResult).includes("InvalidChecksum"));
});

test("EquivalenceMismatch error shape is produced", () => {
  const error = createRuntimeError("EquivalenceMismatch", {
    message_id: "msg-1",
    txn_id: "txn-1",
    detail: "reduced equivalent work counters"
  });

  assert.equal(error.error_code, "EquivalenceMismatch");
  assert.equal(error.message_id, "msg-1");
  assert.equal(error.txn_id, "txn-1");
  assert.equal(error.safe_fallback, "reject-message");
});
