// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createInitialCoreContext, processRuntimeMessage } from "../../runtime/core/core-engine.ts";
import { getBlock, getMessage } from "../../runtime/core/state-store.ts";
import { CURRENT_PROTOCOL_VERSION } from "../../runtime/core/protocol.ts";

function envelope(overrides = {}) {
  return {
    protocol_version: CURRENT_PROTOCOL_VERSION,
    message_id: "msg-1",
    message_type: "operation",
    parent_action_id: "action-1",
    session_id: "session-1",
    session_version: 1,
    created_at_ms: 1,
    priority: "stream-update",
    source: "main",
    target: "worker",
    payload: {},
    checksum: "message-checksum-1",
    trace_context: {},
    ...overrides
  };
}

function appendChunk(overrides = {}) {
  return {
    op_id: "op-append-1",
    parent_action_id: "action-1",
    session_version: 1,
    checksum: "append-checksum-1",
    op_type: "AppendChunk",
    block_id: "block-1",
    chunk_id: "chunk-1",
    text_bytes_or_ref: "hello",
    append_offset: 0,
    ...overrides
  };
}

function sealBlock(overrides = {}) {
  return {
    op_id: "op-seal-1",
    parent_action_id: "action-1",
    session_version: 2,
    checksum: "seal-checksum-1",
    op_type: "SealBlock",
    block_id: "block-1",
    final_length: 5,
    ...overrides
  };
}

function addMessage(overrides = {}) {
  return {
    op_id: "op-message-1",
    parent_action_id: "action-1",
    session_version: 2,
    checksum: "message-checksum-1",
    op_type: "AddMessage",
    message_id: "message-1",
    role: "assistant",
    block_ids: ["block-1"],
    created_at_ms: 1,
    ...overrides
  };
}

function requestProjection(overrides = {}) {
  return {
    op_id: "op-projection-1",
    parent_action_id: "action-1",
    session_version: 1,
    checksum: "projection-request-checksum-1",
    op_type: "RequestProjection",
    visible_range: {
      start_block_id: "block-1",
      end_block_id: "block-1"
    },
    priority: "visible-projection",
    deadline_ms: 16,
    reason: "input",
    ...overrides
  };
}

function run(context, operation, envelopeOverrides = {}) {
  return processRuntimeMessage(context, {
    message_envelope: envelope({
      message_id: `msg:${operation.op_id}`,
      session_version: operation.session_version,
      priority: operation.priority ?? "stream-update",
      ...envelopeOverrides
    }),
    operation
  });
}

test("initial context contains empty session_state and empty op_log", () => {
  const context = createInitialCoreContext();

  assert.equal(context.session_version, 0);
  assert.equal(context.current_session_version, 0);
  assert.equal(context.session_state.session_version, 0);
  assert.equal(context.op_log.operations.length, 0);
  assert.deepEqual(context.session_state.blocks, {});
  assert.deepEqual(context.session_state.messages, {});
});

test("accepted AppendChunk updates op-log and creates block in session_state", () => {
  const context = createInitialCoreContext();
  const result = run(context, appendChunk());

  assert.equal(result.accepted, true);
  assert.equal(result.context.op_log.operations.length, 1);
  assert.equal(getBlock(result.context.session_state, "block-1").text, "hello");
  assert.equal(result.context.session_version, 1);
  assert.equal(result.context.current_session_version, 1);
  assert.equal(result.context.session_state.session_version, 1);
  assert.equal(context.op_log.operations.length, 0);
  assert.equal(getBlock(context.session_state, "block-1"), undefined);
});

test("accepted second AppendChunk appends to existing block and increments op-log count", () => {
  const first = run(createInitialCoreContext(), appendChunk());
  const second = run(first.context, appendChunk({
    op_id: "op-append-2",
    chunk_id: "chunk-2",
    text_bytes_or_ref: " world",
    append_offset: 5,
    session_version: 2
  }));

  assert.equal(second.accepted, true);
  assert.equal(second.context.op_log.operations.length, 2);
  assert.equal(getBlock(second.context.session_state, "block-1").text, "hello world");
});

test("invalid AppendChunk offset rejects and leaves op-log and session_state unchanged", () => {
  const first = run(createInitialCoreContext(), appendChunk());
  const result = run(first.context, appendChunk({
    op_id: "op-append-2",
    chunk_id: "chunk-2",
    append_offset: 0,
    session_version: 2
  }));

  assert.equal(result.accepted, false);
  assert.equal(result.context, first.context);
  assert.equal(result.context.op_log.operations.length, 1);
  assert.equal(getBlock(result.context.session_state, "block-1").text, "hello");
});

test("duplicate op rejects and leaves op-log and session_state unchanged", () => {
  const first = run(createInitialCoreContext(), appendChunk());
  const result = run(first.context, appendChunk());

  assert.equal(result.accepted, false);
  assert.equal(result.context, first.context);
  assert.equal(result.context.op_log.operations.length, 1);
  assert.equal(getBlock(result.context.session_state, "block-1").text, "hello");
});

test("SealBlock after append marks block sealed", () => {
  const first = run(createInitialCoreContext(), appendChunk());
  const result = run(first.context, sealBlock());

  assert.equal(result.accepted, true);
  assert.equal(result.context.op_log.operations.length, 2);
  assert.equal(getBlock(result.context.session_state, "block-1").sealed, true);
});

test("AppendChunk after SealBlock rejects and leaves context unchanged", () => {
  const first = run(createInitialCoreContext(), appendChunk());
  const sealed = run(first.context, sealBlock());
  const result = run(sealed.context, appendChunk({
    op_id: "op-append-2",
    chunk_id: "chunk-2",
    append_offset: 5,
    session_version: 3
  }));

  assert.equal(result.accepted, false);
  assert.equal(result.context, sealed.context);
  assert.equal(result.context.op_log.operations.length, 2);
  assert.equal(getBlock(result.context.session_state, "block-1").text, "hello");
});

test("AddMessage referencing existing block adds message", () => {
  const first = run(createInitialCoreContext(), appendChunk());
  const result = run(first.context, addMessage());

  assert.equal(result.accepted, true);
  assert.equal(result.context.op_log.operations.length, 2);
  assert.equal(getMessage(result.context.session_state, "message-1").message_id, "message-1");
});

test("AddMessage referencing missing block rejects and leaves context unchanged", () => {
  const context = createInitialCoreContext();
  const result = run(context, addMessage());

  assert.equal(result.accepted, false);
  assert.equal(result.context, context);
  assert.equal(result.context.op_log.operations.length, 0);
  assert.equal(getMessage(result.context.session_state, "message-1"), undefined);
});

test("RequestProjection accepted as state no-op and records op-log entry", () => {
  const context = createInitialCoreContext();
  const result = run(context, requestProjection(), { priority: "visible-projection" });

  assert.equal(result.accepted, true);
  assert.equal(result.context.op_log.operations.length, 1);
  assert.deepEqual(result.context.session_state.blocks, {});
  assert.deepEqual(result.context.session_state.messages, {});
});

test("state-store failure after admission does not leave op-log polluted", () => {
  const first = run(createInitialCoreContext(), appendChunk());
  const sealed = run(first.context, sealBlock());
  const result = run(sealed.context, appendChunk({
    op_id: "op-append-2",
    chunk_id: "chunk-2",
    append_offset: 5,
    session_version: 3
  }));

  assert.equal(result.accepted, false);
  assert.equal(result.context, sealed.context);
  assert.equal(result.context.op_log.operations.length, 2);
  assert.equal(result.trace.first_failed_stage, "final-decision");
});

test("accepted newer session_version advances context and session_state version together", () => {
  const context = createInitialCoreContext({ current_session_version: 2 });
  const result = run(context, appendChunk({
    session_version: 5
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.context.session_version, 5);
  assert.equal(result.context.current_session_version, 5);
  assert.equal(result.context.session_state.session_version, 5);
});

test("stale operation rejects and keeps context and session_state unchanged", () => {
  const context = createInitialCoreContext({ current_session_version: 5 });
  const result = run(context, appendChunk({
    session_version: 1
  }));

  assert.equal(result.accepted, false);
  assert.equal(result.context, context);
  assert.equal(result.context.op_log.operations.length, 0);
  assert.equal(result.context.session_version, 5);
  assert.equal(result.context.current_session_version, 5);
  assert.equal(result.context.session_state.session_version, 5);
});

test("source does not import or use blocked runtime APIs", () => {
  const source = readFileSync(new URL("../../runtime/core/core-engine.ts", import.meta.url), "utf8");
  const stateSource = readFileSync(new URL("../../runtime/core/state-store.ts", import.meta.url), "utf8");
  const joinedSource = `${source}\n${stateSource}`;
  const forbiddenTokens = [
    "docu" + "ment",
    "win" + "dow",
    "new " + "Worker" + "(",
    "self" + ".on" + "message",
    "post" + "Message",
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
    assert.equal(joinedSource.includes(token), false);
  }
});
