// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  addTraceStep,
  createDecisionTrace,
  markTraceFailure,
  markTracePass,
  summarizeDecisionTrace
} from "../../runtime/core/decision-trace.ts";
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
    blocks: [{ block_id: "block-1", estimated_bytes: 16 }],
    checksum: "projection-checksum-1",
    stale_status: "fresh",
    ...overrides
  };
}

const projectionBounds = {
  max_blocks: 2,
  max_result_bytes: 128,
  require_checksum: true,
  allow_stale_compatible: false
};

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

function traceStages(result) {
  return result.trace.steps.map((step) => step.stage);
}

function failedStep(result, stage) {
  return result.trace.steps.find((step) => step.stage === stage && step.status === "fail");
}

test("createDecisionTrace creates empty pending trace", () => {
  const trace = createDecisionTrace();

  assert.deepEqual(trace.steps, []);
  assert.equal(trace.final_status, "pending");
  assert.equal(trace.accepted, false);
  assert.deepEqual(trace.error_codes, []);
});

test("markTracePass records pass step without mutating previous trace", () => {
  const trace = createDecisionTrace();
  const next = markTracePass(trace, "envelope-validation", "accepted");

  assert.equal(trace.steps.length, 0);
  assert.equal(next.steps.length, 1);
  assert.equal(next.steps[0].status, "pass");
});

test("markTraceFailure records first_failed_stage and error code", () => {
  const trace = markTraceFailure(
    createDecisionTrace(),
    "operation-validation",
    "operation failed",
    "MissingRequiredField"
  );

  assert.equal(trace.final_status, "rejected");
  assert.equal(trace.first_failed_stage, "operation-validation");
  assert.deepEqual(trace.error_codes, ["MissingRequiredField"]);
});

test("summarizeDecisionTrace returns accepted false when any fail exists", () => {
  const trace = addTraceStep(
    markTracePass(createDecisionTrace(), "envelope-validation", "accepted"),
    {
      stage: "final-decision",
      status: "fail",
      reason: "rejected",
      error_code: "AdmissionRejected"
    }
  );
  const summary = summarizeDecisionTrace(trace);

  assert.equal(summary.accepted, false);
  assert.equal(summary.final_status, "rejected");
});

test("invalid envelope path includes envelope-validation failure", () => {
  const invalidEnvelope = envelope();
  delete invalidEnvelope.checksum;

  const result = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: invalidEnvelope,
    operation: operation()
  });

  assert.equal(result.accepted, false);
  assert.ok(failedStep(result, "envelope-validation"));
  assert.equal(result.trace.first_failed_stage, "envelope-validation");
});

test("invalid op path includes operation-validation failure", () => {
  const invalidOperation = operation();
  delete invalidOperation.block_id;

  const result = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: envelope(),
    operation: invalidOperation
  });

  assert.equal(result.accepted, false);
  assert.ok(failedStep(result, "operation-validation"));
  assert.equal(result.trace.first_failed_stage, "operation-validation");
});

test("duplicate op path includes op-log-append failure", () => {
  const first = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: envelope(),
    operation: operation()
  });

  const second = processRuntimeMessage(first.context, {
    message_envelope: envelope({ message_id: "msg-2" }),
    operation: operation()
  });

  assert.equal(second.accepted, false);
  assert.ok(failedStep(second, "op-log-append"));
});

test("backpressure rejection includes backpressure-check failure", () => {
  const result = processRuntimeMessage(pressureContext(), {
    message_envelope: envelope(),
    operation: operation()
  });

  assert.equal(result.accepted, false);
  assert.ok(failedStep(result, "backpressure-check"));
  assert.ok(traceStages(result).includes("transaction-validation"));
});

test("scheduler admission rejection includes scheduler-admission failure", () => {
  const result = processRuntimeMessage(
    createInitialCoreContext({
      active_transaction_priority: "urgent-input"
    }),
    {
      message_envelope: envelope(),
      operation: operation()
    }
  );

  assert.equal(result.accepted, false);
  assert.equal(result.decision.decision_type, "defer-transaction");
  assert.ok(failedStep(result, "scheduler-admission"));
  assert.ok(traceStages(result).includes("backpressure-check"));
});

test("stale projection includes projection-policy failure", () => {
  const result = processRuntimeMessage(
    createInitialCoreContext({
      current_session_version: 1
    }),
    {
      message_envelope: envelope(),
      operation: operation(),
      projection_result: projection({ session_version: 0, stale_status: "stale" }),
      projection_bounds: projectionBounds
    }
  );

  assert.equal(result.accepted, false);
  assert.ok(failedStep(result, "projection-policy"));
  assert.equal(result.decision.trace, result.trace);
});

test("valid accepted path includes final-decision pass", () => {
  const result = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: envelope(),
    operation: operation()
  });

  assert.equal(result.accepted, true);
  assert.equal(result.trace.accepted, true);
  assert.equal(result.trace.final_status, "accepted");
  assert.ok(result.trace.steps.some((step) => step.stage === "final-decision" && step.status === "pass"));
  assert.equal(result.decision.trace, result.trace);
});

test("source does not import or use blocked browser APIs", () => {
  const source = readFileSync(new URL("../../runtime/core/decision-trace.ts", import.meta.url), "utf8");
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
