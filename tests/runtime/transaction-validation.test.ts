// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { validateTransaction } from "../../runtime/core/transaction-validation.ts";

function visibleRange() {
  return {
    start_block_id: "block-1",
    end_block_id: "block-2"
  };
}

function transaction(overrides = {}) {
  return {
    txn_id: "txn-1",
    parent_action_id: "action-1",
    op_ids: ["op-1"],
    transaction_type: "visible-projection",
    priority: "visible-projection",
    deadline_ms: 16,
    budget_ms: 4,
    session_version: 3,
    visible_range: visibleRange(),
    dirty_ranges: [],
    required_work_units: 1,
    cancellation_policy: "required-before-visible-commit",
    stale_policy: "reject",
    result_version: 1,
    checksum: "transaction-checksum-1",
    trace_context: { trace_id: "trace-1" },
    projection_contract: {
      max_result_bytes: 4096,
      required_visible_range: visibleRange(),
      require_projection_checksum: true,
      require_version_check: true
    },
    ...overrides
  };
}

function errorCodes(result) {
  return result.errors.map((error) => error.error_code);
}

test("valid transaction passes", () => {
  assert.equal(validateTransaction(transaction()).valid, true);
});

test("missing trace_context fails", () => {
  const candidate = transaction();
  delete candidate.trace_context;

  const result = validateTransaction(candidate);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("invalid trace_context fails", () => {
  const result = validateTransaction(transaction({ trace_context: "trace-1" }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("invalid transaction preserves trace_context on errors when available", () => {
  const traceContext = { trace_id: "trace-invalid-transaction" };
  const result = validateTransaction(transaction({ checksum: "", trace_context: traceContext }));

  assert.equal(result.valid, false);
  assert.equal(result.errors[0].trace_context, traceContext);
});

test("missing txn_id fails", () => {
  const candidate = transaction();
  delete candidate.txn_id;

  const result = validateTransaction(candidate);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("missing parent_action_id fails", () => {
  const candidate = transaction();
  delete candidate.parent_action_id;

  const result = validateTransaction(candidate);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("empty op_ids fails", () => {
  const result = validateTransaction(transaction({ op_ids: [] }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("missing projection_contract fails", () => {
  const candidate = transaction();
  delete candidate.projection_contract;

  const result = validateTransaction(candidate);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("invalid session_version fails", () => {
  const result = validateTransaction(transaction({ session_version: -1 }));

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-session-version"));
});

test("session_version rejects non-finite and fractional values", () => {
  for (const session_version of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 3.5]) {
    const result = validateTransaction(transaction({ session_version }));

    assert.equal(result.valid, false);
    assert.ok(result.reasons.includes("invalid-session-version"));
  }
});

test("deadline_ms and budget_ms reject non-finite values", () => {
  const cases = [
    transaction({ deadline_ms: Number.NaN }),
    transaction({ deadline_ms: Number.POSITIVE_INFINITY }),
    transaction({ budget_ms: Number.NaN }),
    transaction({ budget_ms: Number.POSITIVE_INFINITY })
  ];

  for (const candidate of cases) {
    const result = validateTransaction(candidate);

    assert.equal(result.valid, false);
    assert.ok(errorCodes(result).includes("MissingRequiredField"));
  }
});

test("missing checksum fails", () => {
  const candidate = transaction();
  delete candidate.checksum;

  const result = validateTransaction(candidate);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("InvalidChecksum"));
});

test("non-finite numeric checksum fails", () => {
  const result = validateTransaction(transaction({ checksum: Number.POSITIVE_INFINITY }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("InvalidChecksum"));
});

test("result_version rejects non-finite and fractional values", () => {
  for (const result_version of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5]) {
    const result = validateTransaction(transaction({ result_version }));

    assert.equal(result.valid, false);
    assert.ok(errorCodes(result).includes("MissingRequiredField"));
  }
});

test("missing required_work_units fails", () => {
  const candidate = transaction();
  delete candidate.required_work_units;

  const result = validateTransaction(candidate);

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-work-units"));
});

test("required_work_units rejects non-finite and fractional values", () => {
  for (const required_work_units of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5]) {
    const result = validateTransaction(transaction({ required_work_units }));

    assert.equal(result.valid, false);
    assert.ok(result.reasons.includes("invalid-work-units"));
  }
});

test("dirty range offsets reject non-finite and fractional values", () => {
  const cases = [
    transaction({ dirty_ranges: [{ block_id: "block-1", start_offset: Number.NaN, end_offset: 1 }] }),
    transaction({ dirty_ranges: [{ block_id: "block-1", start_offset: 0, end_offset: Number.POSITIVE_INFINITY }] }),
    transaction({ dirty_ranges: [{ block_id: "block-1", start_offset: 0.5, end_offset: 1 }] })
  ];

  for (const candidate of cases) {
    const result = validateTransaction(candidate);

    assert.equal(result.valid, false);
    assert.ok(result.reasons.includes("invalid-range"));
  }
});

test("projection_contract max_result_bytes rejects non-finite and fractional values", () => {
  for (const max_result_bytes of [Number.NaN, Number.POSITIVE_INFINITY, 4096.5]) {
    const result = validateTransaction(
      transaction({
        projection_contract: {
          max_result_bytes,
          required_visible_range: visibleRange(),
          require_projection_checksum: true,
          require_version_check: true
        }
      })
    );

    assert.equal(result.valid, false);
    assert.ok(result.reasons.includes("invalid-range"));
  }
});
