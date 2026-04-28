// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createInitialCoreContext, processRuntimeMessage } from "../../runtime/core/core-engine.ts";
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

function pressureContext() {
  return createInitialCoreContext({
    backpressure_snapshot: {
      pending_transactions: 2,
      pending_bytes: 0,
      largest_pending_projection_bytes: 0,
      uncommitted_projection_count: 0,
      background_queue_depth: 0,
      stream_update_queue_depth: 0
    },
    backpressure_limits: {
      max_pending_transactions: 2,
      max_pending_bytes: 1024,
      max_projection_result_bytes: 256,
      max_uncommitted_projection_count: 1
    }
  });
}

const projectionBounds = {
  max_blocks: 2,
  max_result_bytes: 128,
  require_checksum: true,
  allow_stale_compatible: false
};

function projection(overrides = {}) {
  return {
    projection_id: "projection-1",
    txn_id: "txn:op-1",
    session_version: 1,
    result_version: 1,
    visible_range: {
      start_block_id: "block-1",
      end_block_id: "block-1"
    },
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

function currentContext() {
  return createInitialCoreContext({
    current_session_version: 1
  });
}

function assertNormalizedRejection(result) {
  assert.equal(result.accepted, false);
  assert.ok(result.decision.decision_type);
  assert.ok(result.decision.error);
  assert.ok(result.decision.errors.length > 0);
  assert.ok(result.errors.length > 0);
}

test("valid envelope and valid op produces accepted result and updated context", () => {
  const context = createInitialCoreContext();
  const result = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation()
  });

  assert.equal(result.accepted, true);
  assert.equal(result.context.op_log.operations.length, 1);
  assert.deepEqual(result.context.processed_message_ids, ["msg-1"]);
  assert.equal(context.op_log.operations.length, 0);
  assert.deepEqual(context.processed_message_ids, []);
});

test("accepted transaction records envelope trace_context", () => {
  const traceContext = { trace_id: "trace-core-engine" };
  const result = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: envelope({ trace_context: traceContext }),
    operation: operation()
  });

  assert.equal(result.accepted, true);
  assert.equal(result.transaction_record.transaction.trace_context, traceContext);
});

test("invalid envelope rejects and context is unchanged", () => {
  const context = createInitialCoreContext();
  const invalidEnvelope = envelope();
  delete invalidEnvelope.checksum;

  const result = processRuntimeMessage(context, {
    message_envelope: invalidEnvelope,
    operation: operation()
  });

  assert.equal(result.accepted, false);
  assert.equal(result.context, context);
  assert.equal(result.decision.decision_type, "reject-envelope");
  assertNormalizedRejection(result);
});

test("invalid op rejects and context is unchanged", () => {
  const context = createInitialCoreContext();
  const invalidOperation = operation();
  delete invalidOperation.block_id;

  const result = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: invalidOperation
  });

  assert.equal(result.accepted, false);
  assert.equal(result.context, context);
  assert.equal(result.decision.decision_type, "reject-operation");
  assertNormalizedRejection(result);
});

test("operation missing parent_action_id rejects and context is unchanged", () => {
  const context = createInitialCoreContext();
  const invalidOperation = operation();
  delete invalidOperation.parent_action_id;

  const result = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: invalidOperation
  });

  assert.equal(result.accepted, false);
  assert.equal(result.context, context);
  assert.equal(result.decision.decision_type, "reject-operation");
  assert.equal(result.decision.error.error_code, "MissingRequiredField");
});

test("operation parent_action_id mismatch with envelope rejects and preserves context", () => {
  const context = createInitialCoreContext();
  const traceContext = { trace_id: "trace-engine-lineage" };

  const result = processRuntimeMessage(context, {
    message_envelope: envelope({ trace_context: traceContext }),
    operation: operation({ parent_action_id: "different-action" })
  });

  assert.equal(result.accepted, false);
  assert.equal(result.context, context);
  assert.equal(result.context.op_log.operations.length, 0);
  assert.equal(result.decision.decision_type, "reject-operation");
  assert.equal(result.decision.error.error_code, "AdmissionRejected");
  assert.equal(result.decision.error.message_id, "msg-1");
  assert.equal(result.decision.error.parent_action_id, "action-1");
  assert.equal(result.decision.error.trace_context, traceContext);
  assert.match(result.decision.error.detail, /operation\.parent_action_id/);
});

test("operation session_version mismatch with envelope rejects and preserves context", () => {
  const context = createInitialCoreContext();
  const traceContext = { trace_id: "trace-engine-session" };

  const result = processRuntimeMessage(context, {
    message_envelope: envelope({ session_version: 2, trace_context: traceContext }),
    operation: operation({ session_version: 1 })
  });

  assert.equal(result.accepted, false);
  assert.equal(result.context, context);
  assert.equal(result.context.op_log.operations.length, 0);
  assert.equal(result.decision.decision_type, "reject-operation");
  assert.equal(result.decision.error.error_code, "AdmissionRejected");
  assert.equal(result.decision.error.message_id, "msg-1");
  assert.equal(result.decision.error.parent_action_id, "action-1");
  assert.equal(result.decision.error.trace_context, traceContext);
  assert.match(result.decision.error.detail, /operation\.session_version/);
});

test("duplicate op rejects and context is unchanged", () => {
  const context = createInitialCoreContext();
  const first = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation()
  });
  assert.equal(first.accepted, true);

  const second = processRuntimeMessage(first.context, {
    message_envelope: envelope({ message_id: "msg-2" }),
    operation: operation()
  });

  assert.equal(second.accepted, false);
  assert.equal(second.context, first.context);
  assert.equal(second.context.op_log.operations.length, 1);
  assert.equal(Object.keys(second.context.session_state.blocks).length, 1);
  assert.equal(second.decision.decision_type, "reject-operation");
  assert.equal(second.decision.error.error_code, "DuplicateOperationId");
  assertNormalizedRejection(second);
});

test("duplicate message_id with same op_id rejects before mutating context", () => {
  const context = createInitialCoreContext();
  const first = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation()
  });
  assert.equal(first.accepted, true);

  const traceContext = { trace_id: "trace-duplicate-message" };
  const second = processRuntimeMessage(first.context, {
    message_envelope: envelope({ trace_context: traceContext }),
    operation: operation()
  });

  assert.equal(second.accepted, false);
  assert.equal(second.context, first.context);
  assert.equal(second.context.op_log.operations.length, 1);
  assert.equal(Object.keys(second.context.session_state.blocks).length, 1);
  assert.deepEqual(second.context.processed_message_ids, ["msg-1"]);
  assert.equal(second.decision.decision_type, "reject-envelope");
  assert.equal(second.decision.error.error_code, "DuplicateMessageId");
  assert.equal(second.decision.error.message_id, "msg-1");
  assert.equal(second.decision.error.parent_action_id, "action-1");
  assert.equal(second.decision.error.trace_context, traceContext);
});

test("duplicate message_id with different op_id rejects before mutating context", () => {
  const context = createInitialCoreContext();
  const first = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation()
  });
  assert.equal(first.accepted, true);

  const second = processRuntimeMessage(first.context, {
    message_envelope: envelope(),
    operation: operation({ op_id: "op-2", chunk_id: "chunk-2", append_offset: 5 })
  });

  assert.equal(second.accepted, false);
  assert.equal(second.context, first.context);
  assert.equal(second.context.op_log.operations.length, 1);
  assert.deepEqual(second.context.processed_message_ids, ["msg-1"]);
  assert.equal(second.decision.decision_type, "reject-envelope");
  assert.equal(second.decision.error.error_code, "DuplicateMessageId");
});

test("different message_id with different op_id remains accepted", () => {
  const context = createInitialCoreContext();
  const first = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation()
  });
  assert.equal(first.accepted, true);

  const second = processRuntimeMessage(first.context, {
    message_envelope: envelope({ message_id: "msg-2" }),
    operation: operation({ op_id: "op-2", chunk_id: "chunk-2", append_offset: 5 })
  });

  assert.equal(second.accepted, true);
  assert.equal(second.context.op_log.operations.length, 2);
  assert.deepEqual(second.context.processed_message_ids, ["msg-1", "msg-2"]);
});

test("backpressure pressure rejects non-urgent work and context is unchanged", () => {
  const context = pressureContext();

  const result = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation()
  });

  assert.equal(result.accepted, false);
  assert.equal(result.context, context);
  assert.equal(result.decision.decision_type, "reject-backpressure");
  assertNormalizedRejection(result);
});

test("urgent work can be accepted under pressure if policy allows", () => {
  const context = pressureContext();

  const result = processRuntimeMessage(context, {
    message_envelope: envelope({ priority: "urgent-input" }),
    operation: operation({ priority: "urgent-input" }),
    transaction_options: {
      transaction_type: "urgent-input"
    }
  });

  assert.equal(result.accepted, true);
  assert.equal(result.decision.selected_priority, "urgent-input");
});

test("accepted decision includes selected priority", () => {
  const result = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: envelope(),
    operation: operation()
  });

  assert.equal(result.accepted, true);
  assert.equal(result.decision.selected_priority, "stream-update");
});

test("rejected decision includes error shape or reason", () => {
  const invalidOperation = operation();
  delete invalidOperation.block_id;

  const result = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: envelope(),
    operation: invalidOperation
  });

  assert.equal(result.accepted, false);
  assert.ok(result.decision.error || result.decision.reasons.length > 0);
});

test("valid projection with current session version and checksum allows commit decision", () => {
  const result = processRuntimeMessage(currentContext(), {
    message_envelope: envelope(),
    operation: operation(),
    projection_result: projection(),
    projection_bounds: projectionBounds
  });

  assert.equal(result.accepted, true);
  assert.equal(result.decision.should_commit_projection, true);
});

test("stale projection rejects and context remains unchanged", () => {
  const context = currentContext();
  const result = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation(),
    projection_result: projection({ session_version: 0, stale_status: "stale" }),
    projection_bounds: projectionBounds
  });

  assert.equal(result.context, context);
  assert.equal(result.decision.decision_type, "reject-projection");
  assert.equal(result.decision.should_commit_projection, false);
  assertNormalizedRejection(result);
});

test("future-version projection rejects by default and context remains unchanged", () => {
  const context = currentContext();
  const result = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation(),
    projection_result: projection({ session_version: 2 }),
    projection_bounds: projectionBounds
  });

  assert.equal(result.context, context);
  assert.equal(result.decision.decision_type, "reject-projection");
  assert.equal(result.decision.should_commit_projection, false);
  assertNormalizedRejection(result);
});

test("missing projection checksum rejects when checksum is required", () => {
  const context = currentContext();
  const invalidProjection = projection();
  delete invalidProjection.checksum;

  const result = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation(),
    projection_result: invalidProjection,
    projection_bounds: projectionBounds
  });

  assert.equal(result.context, context);
  assert.equal(result.decision.decision_type, "reject-projection");
  assert.equal(result.decision.error.error_code, "InvalidChecksum");
});

test("oversized projection rejects", () => {
  const context = currentContext();
  const result = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation(),
    projection_result: projection({
      blocks: [{ block_id: "block-1", estimated_bytes: projectionBounds.max_result_bytes + 1 }]
    }),
    projection_bounds: projectionBounds
  });

  assert.equal(result.context, context);
  assert.equal(result.decision.decision_type, "reject-projection");
  assert.equal(result.decision.error.error_code, "ProjectionTooLarge");
});

test("missing projection_id rejects", () => {
  const context = currentContext();
  const invalidProjection = projection();
  delete invalidProjection.projection_id;

  const result = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation(),
    projection_result: invalidProjection,
    projection_bounds: projectionBounds
  });

  assert.equal(result.context, context);
  assert.equal(result.decision.decision_type, "reject-projection");
  assert.equal(result.decision.error.error_code, "MissingRequiredField");
});

test("missing txn_id rejects", () => {
  const context = currentContext();
  const invalidProjection = projection();
  delete invalidProjection.txn_id;

  const result = processRuntimeMessage(context, {
    message_envelope: envelope(),
    operation: operation(),
    projection_result: invalidProjection,
    projection_bounds: projectionBounds
  });

  assert.equal(result.context, context);
  assert.equal(result.decision.decision_type, "reject-projection");
  assert.equal(result.decision.error.error_code, "MissingRequiredField");
});

test("accepted projection decision does not perform rendering or commit behavior", () => {
  const result = processRuntimeMessage(currentContext(), {
    message_envelope: envelope(),
    operation: operation(),
    projection_result: projection(),
    projection_bounds: projectionBounds
  });

  assert.equal(result.accepted, true);
  assert.equal(result.decision.should_commit_projection, true);
  assert.equal("projection" in result.context, false);
  assert.equal("committed_projection" in result.context, false);
});

test("stale operation against advanced session is rejected and op_log/session_version remain unchanged (version monotonicity regression)", () => {
  const context = createInitialCoreContext({ current_session_version: 5 });

  const result = processRuntimeMessage(context, {
    message_envelope: envelope({ session_version: 1 }),
    operation: operation({ session_version: 1 })
  });

  assert.equal(result.accepted, false);
  assert.equal(result.decision.decision_type, "reject-transaction");
  assert.equal(result.decision.error.error_code, "AdmissionRejected");
  assert.match(result.decision.error.detail, /older than current_session_version/);
  // pipeline must not pollute op_log or advance the session on rejection
  assert.equal(result.context, context);
  assert.equal(result.context.op_log.operations.length, 0);
  assert.equal(result.context.current_session_version, 5);
});

test("operation at equal session_version is accepted (boundary regression)", () => {
  const context = createInitialCoreContext({ current_session_version: 1 });

  const result = processRuntimeMessage(context, {
    message_envelope: envelope({ session_version: 1 }),
    operation: operation({ session_version: 1 })
  });

  assert.equal(result.accepted, true);
  assert.equal(result.context.current_session_version, 1);
  assert.equal(result.context.op_log.operations.length, 1);
});

test("operation that advances session_version is accepted and session_version monotonically advances", () => {
  const context = createInitialCoreContext({ current_session_version: 2 });

  const result = processRuntimeMessage(context, {
    message_envelope: envelope({ session_version: 5 }),
    operation: operation({ session_version: 5 })
  });

  assert.equal(result.accepted, true);
  assert.equal(result.context.current_session_version, 5);
  assert.equal(result.context.op_log.operations.length, 1);
});

test("fractional initial core session override fails closed", () => {
  assert.throws(
    () => createInitialCoreContext({ current_session_version: 1.5 }),
    /current_session_version must be a finite non-negative integer/
  );
  assert.throws(
    () => createInitialCoreContext({ session_version: 1.5 }),
    /session_version must be a finite non-negative integer/
  );
  assert.throws(
    () => createInitialCoreContext({
      session_state: {
        session_version: 1.5,
        blocks: {},
        messages: {}
      }
    }),
    /session_state\.session_version must be a finite non-negative integer/
  );
});

test("core engine source does not import blocked browser runtime APIs", () => {
  const source = readFileSync(new URL("../../runtime/core/core-engine.ts", import.meta.url), "utf8");
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
