// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyOperationToState,
  applyOperationsToState,
  createEmptySessionState,
  getBlock,
  getMessage,
  summarizeSessionState
} from "../../runtime/core/state-store.ts";

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
    session_version: 1,
    checksum: "seal-checksum-1",
    op_type: "SealBlock",
    block_id: "block-1",
    final_length: 5,
    ...overrides
  };
}

function patchRange(overrides = {}) {
  return {
    op_id: "op-patch-1",
    parent_action_id: "action-1",
    session_version: 2,
    checksum: "patch-checksum-1",
    op_type: "PatchRange",
    block_id: "block-1",
    start_offset: 1,
    end_offset: 4,
    replacement_ref: "i",
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

function setViewport(overrides = {}) {
  return {
    op_id: "op-viewport-1",
    parent_action_id: "action-1",
    session_version: 2,
    checksum: "viewport-checksum-1",
    op_type: "SetViewport",
    visible_range: {
      start_block_id: "block-1",
      end_block_id: "block-1"
    },
    anchor: "block-1",
    viewport_version: 1,
    ...overrides
  };
}

function requestProjection(overrides = {}) {
  return {
    op_id: "op-projection-1",
    parent_action_id: "action-1",
    session_version: 2,
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

function stateWithBlock() {
  const state = createEmptySessionState();
  const decision = applyOperationToState(state, appendChunk());
  assert.equal(decision.accepted, true);
  return decision.state;
}

function stateWithSealedBlock() {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, sealBlock());
  assert.equal(decision.accepted, true);
  return decision.state;
}

test("createEmptySessionState returns empty state with session_version 0 by default", () => {
  const state = createEmptySessionState();

  assert.equal(state.session_version, 0);
  assert.deepEqual(state.blocks, {});
  assert.deepEqual(state.messages, {});
});

test("createEmptySessionState rejects fractional initial session_version", () => {
  assert.throws(
    () => createEmptySessionState(1.5),
    /initialVersion must be a finite non-negative integer/
  );
});

test("AppendChunk creates block and appends text", () => {
  const state = createEmptySessionState();
  const decision = applyOperationToState(state, appendChunk());

  assert.equal(decision.accepted, true);
  assert.equal(decision.state.session_version, 1);
  assert.equal(getBlock(decision.state, "block-1").text, "hello");
  assert.equal(getBlock(decision.state, "block-1").length, 5);
  assert.equal(getBlock(decision.state, "block-1").sealed, false);
  assert.deepEqual(getBlock(decision.state, "block-1").applied_chunk_ids, ["chunk-1"]);
});

test("AppendChunk rejects invalid append_offset", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, appendChunk({
    op_id: "op-append-2",
    chunk_id: "chunk-2",
    append_offset: 0
  }));

  assert.equal(decision.accepted, false);
  assert.equal(decision.state, state);
  assert.equal(getBlock(decision.state, "block-1").text, "hello");
});

test("AppendChunk rejects duplicate chunk_id for the same block and preserves state", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, appendChunk({
    op_id: "op-append-duplicate-chunk",
    session_version: 2,
    append_offset: 5,
    text_bytes_or_ref: " world",
    checksum: "append-checksum-duplicate-chunk"
  }));

  assert.equal(decision.accepted, false);
  assert.equal(decision.state, state);
  assert.equal(getBlock(decision.state, "block-1").text, "hello");
  assert.equal(getBlock(decision.state, "block-1").length, 5);
  assert.deepEqual(getBlock(decision.state, "block-1").applied_chunk_ids, ["chunk-1"]);
  assert.equal(decision.state.session_version, 1);
});

test("AppendChunk accepts same chunk_id on a different block under block-local contract", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, appendChunk({
    op_id: "op-append-block-2",
    block_id: "block-2",
    append_offset: 0,
    text_bytes_or_ref: "second",
    checksum: "append-checksum-block-2"
  }));

  assert.equal(decision.accepted, true);
  assert.equal(getBlock(decision.state, "block-1").text, "hello");
  assert.equal(getBlock(decision.state, "block-2").text, "second");
  assert.deepEqual(getBlock(decision.state, "block-2").applied_chunk_ids, ["chunk-1"]);
});

test("AppendChunk with different chunk_id and correct append_offset still appends", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, appendChunk({
    op_id: "op-append-2",
    chunk_id: "chunk-2",
    session_version: 2,
    append_offset: 5,
    text_bytes_or_ref: " world",
    checksum: "append-checksum-2"
  }));

  assert.equal(decision.accepted, true);
  assert.equal(getBlock(decision.state, "block-1").text, "hello world");
  assert.equal(getBlock(decision.state, "block-1").length, 11);
  assert.deepEqual(getBlock(decision.state, "block-1").applied_chunk_ids, ["chunk-1", "chunk-2"]);
});

test("AppendChunk rejects append to sealed block", () => {
  const state = stateWithSealedBlock();
  const decision = applyOperationToState(state, appendChunk({
    op_id: "op-append-2",
    chunk_id: "chunk-2",
    append_offset: 5
  }));

  assert.equal(decision.accepted, false);
  assert.equal(decision.state, state);
});

test("SealBlock marks block sealed when final_length matches", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, sealBlock());

  assert.equal(decision.accepted, true);
  assert.equal(getBlock(decision.state, "block-1").sealed, true);
});

test("SealBlock rejects final_length mismatch", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, sealBlock({ final_length: 4 }));

  assert.equal(decision.accepted, false);
  assert.equal(decision.state, state);
  assert.equal(getBlock(decision.state, "block-1").sealed, false);
});

test("PatchRange replaces text in unsealed block", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, patchRange());

  assert.equal(decision.accepted, true);
  assert.equal(getBlock(decision.state, "block-1").text, "hio");
  assert.equal(getBlock(decision.state, "block-1").length, 3);
});

test("AppendChunk uses UTF-16 code unit offsets for CJK and emoji text", () => {
  const state = createEmptySessionState();
  const first = applyOperationToState(state, appendChunk({
    text_bytes_or_ref: "你😀",
    checksum: "append-checksum-unicode-1"
  }));

  assert.equal(first.accepted, true);
  assert.equal(getBlock(first.state, "block-1").length, 3);

  const byteOffset = applyOperationToState(first.state, appendChunk({
    op_id: "op-append-byte-offset",
    chunk_id: "chunk-byte-offset",
    append_offset: 7,
    text_bytes_or_ref: "!",
    checksum: "append-checksum-unicode-2"
  }));
  assert.equal(byteOffset.accepted, false);
  assert.equal(byteOffset.state, first.state);

  const codeUnitOffset = applyOperationToState(first.state, appendChunk({
    op_id: "op-append-code-unit-offset",
    chunk_id: "chunk-code-unit-offset",
    append_offset: 3,
    text_bytes_or_ref: "!",
    checksum: "append-checksum-unicode-3"
  }));
  assert.equal(codeUnitOffset.accepted, true);
  assert.equal(getBlock(codeUnitOffset.state, "block-1").text, "你😀!");
  assert.equal(getBlock(codeUnitOffset.state, "block-1").length, 4);
});

test("SealBlock final_length uses UTF-16 code units", () => {
  const state = createEmptySessionState();
  const append = applyOperationToState(state, appendChunk({
    text_bytes_or_ref: "a😀",
    checksum: "append-checksum-emoji"
  }));

  assert.equal(append.accepted, true);
  assert.equal(getBlock(append.state, "block-1").length, 3);

  const codePointLength = applyOperationToState(append.state, sealBlock({
    final_length: 2,
    checksum: "seal-checksum-code-point"
  }));
  assert.equal(codePointLength.accepted, false);
  assert.equal(codePointLength.state, append.state);

  const codeUnitLength = applyOperationToState(append.state, sealBlock({
    final_length: 3,
    checksum: "seal-checksum-code-unit"
  }));
  assert.equal(codeUnitLength.accepted, true);
  assert.equal(getBlock(codeUnitLength.state, "block-1").sealed, true);
});

test("PatchRange uses UTF-16 code unit offsets without splitting emoji surrogate pairs", () => {
  const state = createEmptySessionState();
  const append = applyOperationToState(state, appendChunk({
    text_bytes_or_ref: "a😀b",
    checksum: "append-checksum-emoji-range"
  }));

  assert.equal(append.accepted, true);
  assert.equal(getBlock(append.state, "block-1").length, 4);

  const splitEmoji = applyOperationToState(append.state, patchRange({
    start_offset: 1,
    end_offset: 2,
    replacement_ref: "X",
    checksum: "patch-checksum-split"
  }));
  assert.equal(splitEmoji.accepted, false);
  assert.equal(splitEmoji.state, append.state);
  assert.equal(getBlock(splitEmoji.state, "block-1").text, "a😀b");

  const fullEmoji = applyOperationToState(append.state, patchRange({
    start_offset: 1,
    end_offset: 3,
    replacement_ref: "X",
    checksum: "patch-checksum-full"
  }));
  assert.equal(fullEmoji.accepted, true);
  assert.equal(getBlock(fullEmoji.state, "block-1").text, "aXb");
  assert.equal(getBlock(fullEmoji.state, "block-1").length, 3);
});

test("AppendChunk and PatchRange reject malformed UTF-16 text", () => {
  const state = createEmptySessionState();
  const malformedAppend = applyOperationToState(state, appendChunk({
    text_bytes_or_ref: "\uD83D",
    checksum: "append-checksum-malformed"
  }));

  assert.equal(malformedAppend.accepted, false);
  assert.equal(malformedAppend.state, state);

  const validAppend = applyOperationToState(state, appendChunk({
    text_bytes_or_ref: "abc",
    checksum: "append-checksum-valid"
  }));
  assert.equal(validAppend.accepted, true);

  const malformedPatch = applyOperationToState(validAppend.state, patchRange({
    replacement_ref: "\uDE00",
    checksum: "patch-checksum-malformed"
  }));
  assert.equal(malformedPatch.accepted, false);
  assert.equal(malformedPatch.state, validAppend.state);
  assert.equal(getBlock(malformedPatch.state, "block-1").text, "abc");
});

test("PatchRange rejects sealed block", () => {
  const state = stateWithSealedBlock();
  const decision = applyOperationToState(state, patchRange());

  assert.equal(decision.accepted, false);
  assert.equal(decision.state, state);
  assert.equal(getBlock(decision.state, "block-1").text, "hello");
});

test("AddMessage adds message referencing existing block", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, addMessage());

  assert.equal(decision.accepted, true);
  assert.equal(getMessage(decision.state, "message-1").message_id, "message-1");
  assert.deepEqual(getMessage(decision.state, "message-1").block_ids, ["block-1"]);
});

test("AddMessage rejects missing block reference", () => {
  const state = createEmptySessionState();
  const decision = applyOperationToState(state, addMessage());

  assert.equal(decision.accepted, false);
  assert.equal(decision.state, state);
  assert.equal(getMessage(decision.state, "message-1"), undefined);
});

test("AddMessage rejects duplicate block_ids and preserves state", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, addMessage({
    session_version: 3,
    block_ids: ["block-1", "block-1"]
  }));

  assert.equal(decision.accepted, false);
  assert.equal(decision.state, state);
  assert.equal(getMessage(decision.state, "message-1"), undefined);
  assert.equal(decision.state.session_version, 1);
});

test("AddMessage rejects duplicate message_id", () => {
  const state = stateWithBlock();
  const first = applyOperationToState(state, addMessage());
  const second = applyOperationToState(first.state, addMessage({
    op_id: "op-message-2"
  }));

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(second.state, first.state);
  assert.equal(second.errors[0].error_code, "DuplicateMessageId");
});

test("SetViewport valid op is accepted but does not mutate blocks or messages", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, setViewport());

  assert.equal(decision.accepted, true);
  assert.equal(decision.state.blocks, state.blocks);
  assert.equal(decision.state.messages, state.messages);
  assert.equal(Object.keys(decision.state.blocks).length, 1);
  assert.equal(Object.keys(decision.state.messages).length, 0);
});

test("RequestProjection valid op is accepted but does not mutate blocks or messages", () => {
  const state = stateWithBlock();
  const decision = applyOperationToState(state, requestProjection());

  assert.equal(decision.accepted, true);
  assert.equal(decision.state.blocks, state.blocks);
  assert.equal(decision.state.messages, state.messages);
  assert.equal(Object.keys(decision.state.blocks).length, 1);
  assert.equal(Object.keys(decision.state.messages).length, 0);
});

test("equal session_version operation is accepted", () => {
  const state = createEmptySessionState(1);
  const decision = applyOperationToState(state, appendChunk({ session_version: 1 }));

  assert.equal(decision.accepted, true);
  assert.equal(decision.state.session_version, 1);
  assert.equal(getBlock(decision.state, "block-1").text, "hello");
});

test("newer session_version operation advances session state", () => {
  const state = createEmptySessionState(1);
  const decision = applyOperationToState(state, appendChunk({ session_version: 2 }));

  assert.equal(decision.accepted, true);
  assert.equal(decision.state.session_version, 2);
});

test("stale session_version operation rejects before mutating state", () => {
  const state = stateWithBlock();
  const advanced = applyOperationToState(state, appendChunk({
    op_id: "op-append-2",
    chunk_id: "chunk-2",
    session_version: 2,
    append_offset: 5,
    text_bytes_or_ref: " world"
  }));
  assert.equal(advanced.accepted, true);

  const stale = applyOperationToState(advanced.state, appendChunk({
    op_id: "op-append-stale",
    chunk_id: "chunk-stale",
    session_version: 1,
    append_offset: 11,
    text_bytes_or_ref: "!"
  }));

  assert.equal(stale.accepted, false);
  assert.equal(stale.state, advanced.state);
  assert.equal(stale.reason.includes("older than state.session_version"), true);
  assert.equal(getBlock(stale.state, "block-1").text, "hello world");
  assert.equal(stale.state.session_version, 2);
});

test("stale session_version no-op state operation rejects", () => {
  const state = createEmptySessionState(2);
  const decision = applyOperationToState(state, requestProjection({
    session_version: 1
  }));

  assert.equal(decision.accepted, false);
  assert.equal(decision.state, state);
  assert.equal(decision.reason.includes("older than state.session_version"), true);
});

test("rejected operation returns original state", () => {
  const state = stateWithBlock();
  const invalid = appendChunk();
  delete invalid.block_id;

  const decision = applyOperationToState(state, invalid);

  assert.equal(decision.accepted, false);
  assert.equal(decision.state, state);
});

test("applyOperationsToState applies multiple valid operations sequentially", () => {
  const state = createEmptySessionState();
  const decision = applyOperationsToState(state, [
    appendChunk(),
    appendChunk({
      op_id: "op-append-2",
      chunk_id: "chunk-2",
      text_bytes_or_ref: " world",
      append_offset: 5,
      session_version: 2
    }),
    addMessage({
      session_version: 2
    })
  ]);

  assert.equal(decision.accepted, true);
  assert.equal(getBlock(decision.state, "block-1").text, "hello world");
  assert.equal(getMessage(decision.state, "message-1").role, "assistant");
  assert.equal(decision.state.session_version, 2);
});

test("applyOperationsToState stops on stale operation without applying it", () => {
  const state = createEmptySessionState();
  const decision = applyOperationsToState(state, [
    appendChunk(),
    appendChunk({
      op_id: "op-append-2",
      chunk_id: "chunk-2",
      text_bytes_or_ref: " world",
      append_offset: 5,
      session_version: 2
    }),
    appendChunk({
      op_id: "op-append-stale",
      chunk_id: "chunk-stale",
      text_bytes_or_ref: "!",
      append_offset: 11,
      session_version: 1
    })
  ]);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reason.includes("older than state.session_version"), true);
  assert.equal(getBlock(decision.state, "block-1").text, "hello world");
  assert.equal(decision.state.session_version, 2);
});

test("summarizeSessionState reports block message and sealed counts", () => {
  const state = stateWithSealedBlock();
  const messageDecision = applyOperationToState(state, addMessage());
  const summary = summarizeSessionState(messageDecision.state);

  assert.equal(summary.session_version, 2);
  assert.equal(summary.block_count, 1);
  assert.equal(summary.message_count, 1);
  assert.equal(summary.sealed_block_count, 1);
  assert.equal(summary.total_text_length, 5);
});

test("source does not import or use blocked runtime APIs", () => {
  const sources = [
    readFileSync(new URL("../../runtime/core/state-store.ts", import.meta.url), "utf8"),
    readFileSync(new URL("./state-store.test.ts", import.meta.url), "utf8")
  ].join("\n");
  const forbiddenTokens = [
    "new " + "Worker" + "(",
    "self" + ".onmessage",
    "post" + "Message",
    "docu" + "ment",
    "win" + "dow",
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
    assert.equal(sources.includes(token), false);
  }
});
