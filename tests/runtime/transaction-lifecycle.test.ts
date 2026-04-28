// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import {
  createTransactionFromOperation,
  markTransactionAccepted,
  markTransactionCanceled,
  markTransactionCompleted,
  markTransactionRejected
} from "../../runtime/core/transaction-lifecycle.ts";
import { validateTransaction } from "../../runtime/core/transaction-validation.ts";

function operation(overrides = {}) {
  return {
    op_id: "op-1",
    parent_action_id: "action-1",
    session_version: 1,
    checksum: "op-checksum-1",
    op_type: "AppendChunk",
    block_id: "block-1",
    chunk_id: "chunk-1",
    text_bytes_or_ref: "hello",
    append_offset: 0,
    ...overrides
  };
}

test("valid transaction can be created from valid operation", () => {
  const result = createTransactionFromOperation(operation());

  assert.equal(result.ok, true);
  assert.equal(result.record.transaction.op_ids[0], "op-1");
  assert.equal(result.record.status, "queued");
});

test("created transaction passes validateTransaction", () => {
  const result = createTransactionFromOperation(operation());
  assert.equal(result.ok, true);

  assert.equal(validateTransaction(result.record.transaction).valid, true);
});

test("created transaction includes provided trace_context", () => {
  const traceContext = { trace_id: "trace-transaction" };
  const result = createTransactionFromOperation(operation(), { trace_context: traceContext });

  assert.equal(result.ok, true);
  assert.equal(result.record.transaction.trace_context, traceContext);
});

test("accepted transition works", () => {
  const created = createTransactionFromOperation(operation());
  assert.equal(created.ok, true);

  const accepted = markTransactionAccepted(created.record);

  assert.equal(accepted.ok, true);
  assert.equal(accepted.record.status, "running");
});

test("rejected transition works", () => {
  const created = createTransactionFromOperation(operation());
  assert.equal(created.ok, true);

  const rejected = markTransactionRejected(created.record, "invalid");

  assert.equal(rejected.ok, true);
  assert.equal(rejected.record.status, "rejected");
  assert.equal(rejected.record.reason, "invalid");
});

test("completed transition works", () => {
  const created = createTransactionFromOperation(operation());
  assert.equal(created.ok, true);
  const accepted = markTransactionAccepted(created.record);
  assert.equal(accepted.ok, true);

  const completed = markTransactionCompleted(accepted.record, 2);

  assert.equal(completed.ok, true);
  assert.equal(completed.record.status, "completed");
  assert.equal(completed.record.result_version, 2);
});

test("completed transition rejects invalid resultVersion values", () => {
  const created = createTransactionFromOperation(operation());
  assert.equal(created.ok, true);
  const accepted = markTransactionAccepted(created.record);
  assert.equal(accepted.ok, true);

  for (const resultVersion of [2.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
    const completed = markTransactionCompleted(accepted.record, resultVersion);

    assert.equal(completed.ok, false);
    assert.equal(completed.record, accepted.record);
    assert.ok(completed.errors.length > 0);
    assert.match(String(completed.errors[0].detail), /finite non-negative integer/);
  }
});

test("canceled transition works", () => {
  const created = createTransactionFromOperation(operation());
  assert.equal(created.ok, true);

  const canceled = markTransactionCanceled(created.record, "superseded");

  assert.equal(canceled.ok, true);
  assert.equal(canceled.record.status, "canceled");
});

test("invalid transition fails closed", () => {
  const created = createTransactionFromOperation(operation());
  assert.equal(created.ok, true);

  const completed = markTransactionCompleted(created.record, 2);

  assert.equal(completed.ok, false);
  assert.ok(completed.errors.length > 0);
});

test("missing required op data fails closed", () => {
  const invalidOperation = operation();
  delete invalidOperation.parent_action_id;

  const result = createTransactionFromOperation(invalidOperation);

  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});
