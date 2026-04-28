// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CURRENT_PROTOCOL_VERSION } from "../../runtime/core/protocol.ts";
import { evaluateMainProjection } from "../../runtime/main/main-projection-adapter.ts";
import { createInitialWorkerAdapterContext } from "../../runtime/worker/worker-context.ts";
import { handleWorkerAdapterMessage } from "../../runtime/worker/worker-message-handler.ts";

const projectionBounds = {
  max_blocks: 2,
  max_result_bytes: 128,
  require_checksum: true,
  allow_stale_compatible: false
};

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
    trace_context: { trace_id: "trace-1" },
    ...overrides
  };
}

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

function visibleRange() {
  return {
    start_block_id: "block-1",
    end_block_id: "block-1"
  };
}

function projectionFromWorkerOutput(workerOutput, overrides = {}) {
  const acceptedOperation = workerOutput.next_context.core_context.op_log.operations[0];
  return {
    projection_id: "projection-1",
    txn_id: `txn:${acceptedOperation.op_id}`,
    session_version: workerOutput.next_context.core_context.current_session_version,
    result_version: workerOutput.next_context.core_context.current_session_version,
    visible_range: visibleRange(),
    blocks: [
      {
        block_id: "block-1",
        estimated_bytes: 32
      }
    ],
    checksum: "projection-checksum-1",
    stale_status: "fresh",
    ...overrides
  };
}

function acceptedWorkerOutput() {
  const workerOutput = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
    message_envelope: envelope(),
    operation: operation()
  });
  assert.equal(workerOutput.accepted, true);
  return workerOutput;
}

test("accepted worker-side flow can produce projection-like result that main adapter accepts", () => {
  const workerOutput = acceptedWorkerOutput();
  const projectionResult = projectionFromWorkerOutput(workerOutput);

  const mainDecision = evaluateMainProjection({
    projection_result: projectionResult,
    current_session_version: workerOutput.next_context.core_context.current_session_version,
    projection_bounds: projectionBounds,
    trace_context: envelope().trace_context
  });

  assert.equal(mainDecision.should_commit, true);
});

test("stale projection from worker-side context is rejected by main adapter", () => {
  const workerOutput = acceptedWorkerOutput();
  const projectionResult = projectionFromWorkerOutput(workerOutput, {
    session_version: 1,
    stale_status: "stale"
  });

  const mainDecision = evaluateMainProjection({
    projection_result: projectionResult,
    current_session_version: 2,
    projection_bounds: projectionBounds
  });

  assert.equal(mainDecision.should_commit, false);
  assert.equal(mainDecision.error.error_code, "StaleProjectionRejected");
  assert.ok(mainDecision.error);
});

test("missing checksum projection is rejected", () => {
  const workerOutput = acceptedWorkerOutput();
  const projectionResult = projectionFromWorkerOutput(workerOutput);
  delete projectionResult.checksum;

  const mainDecision = evaluateMainProjection({
    projection_result: projectionResult,
    current_session_version: workerOutput.next_context.core_context.current_session_version,
    projection_bounds: projectionBounds
  });

  assert.equal(mainDecision.should_commit, false);
  assert.equal(mainDecision.error.error_code, "InvalidChecksum");
});

test("oversized projection is rejected", () => {
  const workerOutput = acceptedWorkerOutput();
  const projectionResult = projectionFromWorkerOutput(workerOutput, {
    blocks: [
      {
        block_id: "block-1",
        estimated_bytes: projectionBounds.max_result_bytes + 1
      }
    ]
  });

  const mainDecision = evaluateMainProjection({
    projection_result: projectionResult,
    current_session_version: workerOutput.next_context.core_context.current_session_version,
    projection_bounds: projectionBounds
  });

  assert.equal(mainDecision.should_commit, false);
  assert.equal(mainDecision.error.error_code, "ProjectionTooLarge");
});

test("worker-side rejected input should not produce commit-eligible projection", () => {
  const invalidEnvelope = envelope();
  delete invalidEnvelope.checksum;

  const workerOutput = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
    message_envelope: invalidEnvelope,
    operation: operation()
  });

  assert.equal(workerOutput.accepted, false);

  const mainDecision = evaluateMainProjection({
    projection_result: null,
    current_session_version: workerOutput.next_context.core_context.current_session_version,
    projection_bounds: projectionBounds
  });

  assert.equal(mainDecision.should_commit, false);
  assert.equal(mainDecision.error.error_code, "MissingRequiredField");
});

test("contract test uses pure functions only", () => {
  const sources = [
    readFileSync(new URL("../../runtime/worker/worker-message-handler.ts", import.meta.url), "utf8"),
    readFileSync(new URL("../../runtime/main/main-projection-adapter.ts", import.meta.url), "utf8"),
    readFileSync(new URL("./worker-main-adapter-contract.test.ts", import.meta.url), "utf8")
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
