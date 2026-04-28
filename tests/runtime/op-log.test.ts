// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import {
  appendOperation,
  createEmptyOpLog,
  getOperationCount,
  hasOperation,
  summarizeOpLog
} from "../../runtime/core/op-log.ts";

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

test("createEmptyOpLog returns empty log", () => {
  const log = createEmptyOpLog();

  assert.equal(getOperationCount(log), 0);
  assert.deepEqual(log.op_ids, []);
});

test("valid operation appends", () => {
  const log = createEmptyOpLog();
  const result = appendOperation(log, operation());

  assert.equal(result.accepted, true);
  assert.equal(getOperationCount(result.log), 1);
  assert.equal(hasOperation(result.log, "op-1"), true);
});

test("invalid operation rejects", () => {
  const log = createEmptyOpLog();
  const invalidOperation = operation();
  delete invalidOperation.block_id;

  const result = appendOperation(log, invalidOperation);

  assert.equal(result.accepted, false);
  assert.equal(result.log, log);
  assert.equal(getOperationCount(log), 0);
});

test("duplicate op_id rejects", () => {
  const first = appendOperation(createEmptyOpLog(), operation());
  assert.equal(first.accepted, true);

  const second = appendOperation(first.log, operation());

  assert.equal(second.accepted, false);
  assert.equal(second.log, first.log);
  assert.equal(second.errors[0].error_code, "DuplicateOperationId");
});

test("append does not mutate previous log", () => {
  const log = createEmptyOpLog();
  const result = appendOperation(log, operation());

  assert.equal(result.accepted, true);
  assert.equal(getOperationCount(log), 0);
  assert.equal(getOperationCount(result.log), 1);
});

test("summarizeOpLog reports count", () => {
  const result = appendOperation(createEmptyOpLog(), operation());
  assert.equal(result.accepted, true);

  const summary = summarizeOpLog(result.log);

  assert.equal(summary.operation_count, 1);
  assert.deepEqual(summary.op_ids, ["op-1"]);
});
