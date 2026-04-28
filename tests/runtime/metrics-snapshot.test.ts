// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createInitialCoreContext, processRuntimeMessage } from "../../runtime/core/core-engine.ts";
import {
  createCoreMetricsSnapshot,
  mergeCoreMetricsSnapshot,
  summarizeDecisionMetrics
} from "../../runtime/core/metrics-snapshot.ts";
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

test("creates snapshot from initial context", () => {
  const snapshot = createCoreMetricsSnapshot(createInitialCoreContext());

  assert.equal(snapshot.session_version, 0);
  assert.equal(snapshot.op_log_count, 0);
  assert.equal(snapshot.trace_step_count, 0);
  assert.equal(snapshot.accepted_count, 0);
  assert.equal(snapshot.rejected_count, 0);
  assert.deepEqual(snapshot.error_codes, []);
});

test("reports op_log_count after accepted operation", () => {
  const result = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: envelope(),
    operation: operation()
  });
  const snapshot = createCoreMetricsSnapshot(result.context, result.decision);

  assert.equal(result.accepted, true);
  assert.equal(snapshot.op_log_count, 1);
  assert.equal(result.metrics_snapshot.op_log_count, 1);
});

test("summarizes accepted decision", () => {
  const result = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: envelope(),
    operation: operation()
  });
  const decisionMetrics = summarizeDecisionMetrics(result.decision);

  assert.equal(decisionMetrics.last_decision_type, "accept");
  assert.equal(decisionMetrics.last_decision_accepted, true);
  assert.equal(decisionMetrics.selected_priority, "stream-update");
  assert.equal(decisionMetrics.backpressure_rejected, false);
});

test("summarizes rejected decision with first_failed_stage", () => {
  const invalidEnvelope = envelope();
  delete invalidEnvelope.checksum;
  const result = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: invalidEnvelope,
    operation: operation()
  });
  const decisionMetrics = summarizeDecisionMetrics(result.decision);

  assert.equal(result.accepted, false);
  assert.equal(decisionMetrics.last_decision_type, "reject-envelope");
  assert.equal(decisionMetrics.first_failed_stage, "envelope-validation");
  assert.equal(decisionMetrics.last_decision_accepted, false);
});

test("includes error codes from decision trace", () => {
  const result = processRuntimeMessage(pressureContext(), {
    message_envelope: envelope(),
    operation: operation()
  });

  assert.deepEqual(result.metrics_snapshot.error_codes, ["BackpressureLimitExceeded"]);
  assert.equal(result.metrics_snapshot.backpressure_rejected, true);
});

test("indicates projection_evaluated when projection policy ran", () => {
  const result = processRuntimeMessage(
    createInitialCoreContext({
      current_session_version: 1
    }),
    {
      message_envelope: envelope(),
      operation: operation(),
      projection_result: projection(),
      projection_bounds: projectionBounds
    }
  );

  assert.equal(result.accepted, true);
  assert.equal(result.metrics_snapshot.projection_evaluated, true);
  assert.equal(result.metrics_snapshot.should_commit_projection, true);
});

test("mergeCoreMetricsSnapshot increments accepted and rejected counts", () => {
  const accepted = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: envelope(),
    operation: operation()
  });
  const rejectedEnvelope = envelope();
  delete rejectedEnvelope.checksum;
  const rejected = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: rejectedEnvelope,
    operation: operation()
  });

  const initial = createCoreMetricsSnapshot(createInitialCoreContext());
  const afterAccepted = mergeCoreMetricsSnapshot(initial, accepted.decision);
  const afterRejected = mergeCoreMetricsSnapshot(afterAccepted, rejected.decision);

  assert.equal(afterAccepted.accepted_count, 1);
  assert.equal(afterAccepted.rejected_count, 0);
  assert.equal(afterRejected.accepted_count, 1);
  assert.equal(afterRejected.rejected_count, 1);
});

test("mergeCoreMetricsSnapshot does not mutate previous snapshot", () => {
  const result = processRuntimeMessage(createInitialCoreContext(), {
    message_envelope: envelope(),
    operation: operation()
  });
  const previous = createCoreMetricsSnapshot(createInitialCoreContext());
  const next = mergeCoreMetricsSnapshot(previous, result.decision);

  assert.equal(previous.accepted_count, 0);
  assert.equal(next.accepted_count, 1);
  assert.notEqual(previous, next);
});

test("source does not import or use blocked browser APIs", () => {
  const source = readFileSync(new URL("../../runtime/core/metrics-snapshot.ts", import.meta.url), "utf8");
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
