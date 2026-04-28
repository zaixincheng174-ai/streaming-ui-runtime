// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateOperation } from "../../runtime/core/op-validation.ts";

function base(overrides = {}) {
  return {
    op_id: "op-1",
    parent_action_id: "action-1",
    session_version: 3,
    checksum: "checksum-1",
    ...overrides
  };
}

function appendChunk(overrides = {}) {
  return base({
    op_type: "AppendChunk",
    block_id: "block-1",
    chunk_id: "chunk-1",
    text_bytes_or_ref: "hello",
    append_offset: 0,
    ...overrides
  });
}

function sealBlock(overrides = {}) {
  return base({
    op_type: "SealBlock",
    block_id: "block-1",
    final_length: 5,
    ...overrides
  });
}

function patchRange(overrides = {}) {
  return base({
    op_type: "PatchRange",
    block_id: "block-1",
    start_offset: 1,
    end_offset: 3,
    replacement_ref: {
      ref_id: "replacement-1",
      byte_length: 12,
      checksum: "replacement-checksum-1"
    },
    ...overrides
  });
}

function addMessage(overrides = {}) {
  return base({
    op_type: "AddMessage",
    message_id: "message-1",
    role: "assistant",
    block_ids: ["block-1"],
    created_at_ms: 10,
    ...overrides
  });
}

function visibleRange() {
  return {
    start_block_id: "block-1",
    end_block_id: "block-2"
  };
}

function setViewport(overrides = {}) {
  return base({
    op_type: "SetViewport",
    visible_range: visibleRange(),
    anchor: "tail",
    viewport_version: 1,
    ...overrides
  });
}

function requestProjection(overrides = {}) {
  return base({
    op_type: "RequestProjection",
    visible_range: visibleRange(),
    priority: "visible-projection",
    deadline_ms: 16,
    reason: "input",
    ...overrides
  });
}

function cancelTransaction(overrides = {}) {
  return base({
    op_type: "CancelTransaction",
    txn_id: "txn-1",
    reason: "superseded",
    cancellation_policy: "best-effort",
    ...overrides
  });
}

function commitProjectionAck(overrides = {}) {
  return base({
    op_type: "CommitProjectionAck",
    projection_id: "projection-1",
    result_version: 2,
    committed_at_ms: 20,
    status: "committed",
    ...overrides
  });
}

function errorCodes(result) {
  return result.errors.map((error) => error.error_code);
}

test("valid AppendChunk passes", () => {
  assert.equal(validateOperation(appendChunk()).valid, true);
});

test("AppendChunk missing block_id fails closed", () => {
  const op = appendChunk();
  delete op.block_id;

  const result = validateOperation(op);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("AppendChunk negative append_offset fails closed", () => {
  const result = validateOperation(appendChunk({ append_offset: -1 }));

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-offset"));
});

test("AppendChunk append_offset rejects non-finite and fractional values", () => {
  for (const append_offset of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5]) {
    const result = validateOperation(appendChunk({ append_offset }));

    assert.equal(result.valid, false);
    assert.ok(result.reasons.includes("invalid-offset"));
  }
});

test("AppendChunk missing parent_action_id fails closed", () => {
  const op = appendChunk();
  delete op.parent_action_id;

  const result = validateOperation(op);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("valid SealBlock passes", () => {
  assert.equal(validateOperation(sealBlock()).valid, true);
});

test("SealBlock negative final_length fails closed", () => {
  const result = validateOperation(sealBlock({ final_length: -1 }));

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-offset"));
});

test("SealBlock final_length rejects non-finite values", () => {
  for (const final_length of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const result = validateOperation(sealBlock({ final_length }));

    assert.equal(result.valid, false);
    assert.ok(result.reasons.includes("invalid-offset"));
  }
});

test("valid PatchRange passes", () => {
  assert.equal(validateOperation(patchRange()).valid, true);
});

test("PatchRange with end_offset before start_offset fails closed", () => {
  const result = validateOperation(patchRange({ start_offset: 5, end_offset: 2 }));

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-offset"));
});

test("PatchRange offsets reject non-finite and fractional values", () => {
  const cases = [
    patchRange({ start_offset: Number.NaN }),
    patchRange({ end_offset: Number.POSITIVE_INFINITY }),
    patchRange({ start_offset: Number.NEGATIVE_INFINITY }),
    patchRange({ end_offset: 2.5 })
  ];

  for (const op of cases) {
    const result = validateOperation(op);

    assert.equal(result.valid, false);
    assert.ok(result.reasons.includes("invalid-offset"));
  }
});

test("valid AddMessage passes", () => {
  assert.equal(validateOperation(addMessage()).valid, true);
});

test("AddMessage with empty block_ids fails closed", () => {
  const result = validateOperation(addMessage({ block_ids: [] }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("AddMessage with duplicate block_ids fails closed", () => {
  const result = validateOperation(addMessage({ block_ids: ["block-1", "block-1"] }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("AddMessage created_at_ms rejects non-finite values", () => {
  for (const created_at_ms of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const result = validateOperation(addMessage({ created_at_ms }));

    assert.equal(result.valid, false);
    assert.ok(result.reasons.includes("invalid-timestamp"));
  }
});

test("valid SetViewport passes", () => {
  assert.equal(validateOperation(setViewport()).valid, true);
});

test("SetViewport missing visible_range fails closed", () => {
  const op = setViewport();
  delete op.visible_range;

  const result = validateOperation(op);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("SetViewport viewport_version rejects fractional values", () => {
  const result = validateOperation(setViewport({ viewport_version: 1.5 }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("valid RequestProjection passes", () => {
  assert.equal(validateOperation(requestProjection()).valid, true);
});

test("RequestProjection missing priority fails closed", () => {
  const op = requestProjection();
  delete op.priority;

  const result = validateOperation(op);

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-priority"));
});

test("RequestProjection deadline_ms rejects non-finite values", () => {
  for (const deadline_ms of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const result = validateOperation(requestProjection({ deadline_ms }));

    assert.equal(result.valid, false);
    assert.ok(errorCodes(result).includes("MissingRequiredField"));
  }
});

test("valid CancelTransaction passes", () => {
  assert.equal(validateOperation(cancelTransaction()).valid, true);
});

test("CancelTransaction missing txn_id fails closed", () => {
  const op = cancelTransaction();
  delete op.txn_id;

  const result = validateOperation(op);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("valid CommitProjectionAck passes", () => {
  assert.equal(validateOperation(commitProjectionAck()).valid, true);
});

test("CommitProjectionAck missing projection_id fails closed", () => {
  const op = commitProjectionAck();
  delete op.projection_id;

  const result = validateOperation(op);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("CommitProjectionAck result_version and committed_at_ms reject non-finite values", () => {
  const cases = [
    commitProjectionAck({ result_version: Number.NaN }),
    commitProjectionAck({ result_version: Number.POSITIVE_INFINITY }),
    commitProjectionAck({ committed_at_ms: Number.NaN }),
    commitProjectionAck({ committed_at_ms: Number.POSITIVE_INFINITY })
  ];

  for (const op of cases) {
    const result = validateOperation(op);

    assert.equal(result.valid, false);
    assert.ok(errorCodes(result).includes("MissingRequiredField"));
  }
});

test("CommitProjectionAck missing parent_action_id fails closed", () => {
  const op = commitProjectionAck();
  delete op.parent_action_id;

  const result = validateOperation(op);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("unknown op type fails closed", () => {
  const result = validateOperation(base({ op_type: "UnknownOp" }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("UnknownMessageType"));
});

test("missing checksum fails closed where required", () => {
  const op = appendChunk();
  delete op.checksum;

  const result = validateOperation(op);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("InvalidChecksum"));
});

test("non-finite numeric checksum fails closed where required", () => {
  const result = validateOperation(appendChunk({ checksum: Number.NaN }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("InvalidChecksum"));
});

test("operation session_version rejects fractional values", () => {
  const result = validateOperation(appendChunk({ session_version: 3.5 }));

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-session-version"));
});

test("bounded payload byte_length rejects fractional values", () => {
  const result = validateOperation(
    patchRange({
      replacement_ref: {
        ref_id: "replacement-1",
        byte_length: 12.5,
        checksum: "replacement-checksum-1"
      }
    })
  );

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-payload"));
});

test("AppendChunk inline ASCII payload at exactly max_inline_payload_bytes passes", () => {
  const op = appendChunk({ text_bytes_or_ref: "a".repeat(8) });

  const result = validateOperation(op, { max_inline_payload_bytes: 8 });

  assert.equal(result.valid, true);
});

test("AppendChunk inline ASCII payload above max_inline_payload_bytes fails closed", () => {
  const op = appendChunk({ text_bytes_or_ref: "a".repeat(9) });

  const result = validateOperation(op, { max_inline_payload_bytes: 8 });

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-payload"));
});

test("AppendChunk inline multi-byte UTF-8 payload is sized in bytes not UTF-16 code units (fail-closed regression)", () => {
  // Each "你" is 3 UTF-8 bytes. ten copies = 30 UTF-8 bytes, but value.length = 10.
  // Bug regression: the previous implementation used String.length and would
  // incorrectly accept this payload under a 12-byte limit because 10 <= 12.
  const op = appendChunk({ text_bytes_or_ref: "你".repeat(10) });

  const result = validateOperation(op, { max_inline_payload_bytes: 12 });

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-payload"));
});

test("AppendChunk inline emoji payload is sized in bytes not UTF-16 code units (fail-closed regression)", () => {
  // "😀" is 4 UTF-8 bytes and 2 UTF-16 code units. five copies = 20 UTF-8 bytes
  // but value.length = 10. Under a 12-byte limit the previous implementation
  // would incorrectly accept it because 10 <= 12.
  const op = appendChunk({ text_bytes_or_ref: "😀".repeat(5) });

  const result = validateOperation(op, { max_inline_payload_bytes: 12 });

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("invalid-payload"));
});

test("AppendChunk inline multi-byte UTF-8 payload at exactly max_inline_payload_bytes passes", () => {
  // five copies of "你" = 15 UTF-8 bytes; the limit is set exactly to 15.
  const op = appendChunk({ text_bytes_or_ref: "你".repeat(5) });

  const result = validateOperation(op, { max_inline_payload_bytes: 15 });

  assert.equal(result.valid, true);
});

test("AppendChunk without max_inline_payload_bytes option does not enforce a byte limit", () => {
  const op = appendChunk({ text_bytes_or_ref: "你".repeat(1000) });

  const result = validateOperation(op);

  assert.equal(result.valid, true);
});

test("source does not import or use browser runtime APIs", () => {
  const source = readFileSync(new URL("../../runtime/core/op-validation.ts", import.meta.url), "utf8");
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
