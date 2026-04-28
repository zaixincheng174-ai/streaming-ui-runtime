// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { decideCoreAdmission } from "../../runtime/core/core-decision.ts";
import { CURRENT_PROTOCOL_VERSION } from "../../runtime/core/protocol.ts";

function visibleRange() {
  return {
    start_block_id: "block-1",
    end_block_id: "block-2"
  };
}

function envelope(overrides = {}) {
  return {
    protocol_version: CURRENT_PROTOCOL_VERSION,
    message_id: "msg-1",
    message_type: "operation",
    parent_action_id: "action-1",
    session_id: "session-1",
    session_version: 3,
    created_at_ms: 1,
    priority: "visible-projection",
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
    session_version: 3,
    checksum: "op-checksum-1",
    op_type: "AppendChunk",
    block_id: "block-1",
    chunk_id: "chunk-1",
    text_bytes_or_ref: "hello",
    append_offset: 0,
    ...overrides
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
    trace_context: {},
    projection_contract: {
      max_result_bytes: 4096,
      required_visible_range: visibleRange(),
      require_projection_checksum: true,
      require_version_check: true
    },
    ...overrides
  };
}

function snapshot(overrides = {}) {
  return {
    pending_transactions: 1,
    pending_bytes: 128,
    largest_pending_projection_bytes: 64,
    uncommitted_projection_count: 0,
    background_queue_depth: 0,
    stream_update_queue_depth: 0,
    ...overrides
  };
}

const limits = {
  max_pending_transactions: 4,
  max_pending_bytes: 1024,
  max_projection_result_bytes: 256,
  max_uncommitted_projection_count: 2
};

const projectionBounds = {
  max_blocks: 2,
  max_result_bytes: 256,
  require_checksum: true,
  allow_stale_compatible: false
};

function projection(overrides = {}) {
  return {
    projection_id: "projection-1",
    txn_id: "txn-1",
    session_version: 3,
    result_version: 1,
    visible_range: visibleRange(),
    blocks: [
      {
        block_id: "block-1",
        estimated_bytes: 32
      },
      {
        block_id: "block-2",
        estimated_bytes: 32
      }
    ],
    checksum: "projection-checksum-1",
    stale_status: "fresh",
    ...overrides
  };
}

function decisionInput(overrides = {}) {
  return {
    message_envelope: envelope(),
    operation: operation(),
    transaction: transaction(),
    backpressure_snapshot: snapshot(),
    backpressure_limits: limits,
    current_session_version: 3,
    ...overrides
  };
}

test("valid envelope, op, transaction, and healthy backpressure is accepted", () => {
  const decision = decideCoreAdmission(decisionInput());

  assert.equal(decision.accepted, true);
  assert.equal(decision.decision_type, "accept");
});

test("invalid envelope rejects", () => {
  const invalidEnvelope = envelope();
  delete invalidEnvelope.checksum;

  const decision = decideCoreAdmission(decisionInput({ message_envelope: invalidEnvelope }));

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-envelope");
});

test("transaction with stale session_version is rejected (version monotonicity)", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      message_envelope: envelope({ session_version: 1 }),
      operation: operation({ session_version: 1 }),
      transaction: transaction({ session_version: 1 }),
      current_session_version: 5
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-transaction");
  assert.equal(decision.error.error_code, "AdmissionRejected");
  assert.match(decision.error.detail, /older than current_session_version/);
});

test("transaction with equal session_version is accepted (boundary)", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      operation: operation({ session_version: 3 }),
      transaction: transaction({ session_version: 3 }),
      current_session_version: 3
    })
  );

  assert.equal(decision.accepted, true);
});

test("transaction with newer session_version is accepted (advances session)", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      message_envelope: envelope({ session_version: 7 }),
      operation: operation({ session_version: 7 }),
      transaction: transaction({ session_version: 7 }),
      current_session_version: 3
    })
  );

  assert.equal(decision.accepted, true);
});

test("non-finite current_session_version fails closed", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      current_session_version: Number.NaN
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-transaction");
  assert.equal(decision.error.error_code, "AdmissionRejected");
  assert.match(decision.error.detail, /current_session_version=NaN is invalid/);
});

test("negative current_session_version fails closed", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      current_session_version: -1
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-transaction");
  assert.equal(decision.error.error_code, "AdmissionRejected");
});

test("fractional current_session_version fails closed", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      current_session_version: 1.5
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-transaction");
  assert.equal(decision.error.error_code, "AdmissionRejected");
  assert.match(decision.error.detail, /current_session_version=1.5 is invalid/);
});

test("invalid op rejects", () => {
  const invalidOperation = operation();
  delete invalidOperation.block_id;

  const decision = decideCoreAdmission(decisionInput({ operation: invalidOperation }));

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-operation");
});

test("invalid transaction rejects", () => {
  const invalidTransaction = transaction();
  delete invalidTransaction.txn_id;

  const decision = decideCoreAdmission(decisionInput({ transaction: invalidTransaction }));

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-transaction");
});

test("operation parent_action_id mismatch with envelope rejects with envelope lineage", () => {
  const traceContext = { trace_id: "trace-lineage-1" };
  const decision = decideCoreAdmission(
    decisionInput({
      message_envelope: envelope({ trace_context: traceContext }),
      operation: operation({ parent_action_id: "different-action" })
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-operation");
  assert.equal(decision.error.error_code, "AdmissionRejected");
  assert.equal(decision.error.message_id, "msg-1");
  assert.equal(decision.error.parent_action_id, "action-1");
  assert.equal(decision.error.trace_context, traceContext);
  assert.match(decision.error.detail, /operation\.parent_action_id/);
});

test("transaction parent_action_id mismatch with operation rejects", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      transaction: transaction({ parent_action_id: "different-action" })
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-transaction");
  assert.equal(decision.error.error_code, "AdmissionRejected");
  assert.equal(decision.error.txn_id, "txn-1");
  assert.equal(decision.error.parent_action_id, "action-1");
  assert.match(decision.error.detail, /transaction\.parent_action_id/);
});

test("transaction op_ids missing active operation rejects", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      transaction: transaction({ op_ids: ["op-other"] })
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-transaction");
  assert.equal(decision.error.error_code, "AdmissionRejected");
  assert.equal(decision.error.txn_id, "txn-1");
  assert.match(decision.error.detail, /transaction\.op_ids does not include active operation/);
});

test("operation session_version mismatch with envelope rejects with envelope lineage", () => {
  const traceContext = { trace_id: "trace-session-lineage-1" };
  const decision = decideCoreAdmission(
    decisionInput({
      message_envelope: envelope({ session_version: 4, trace_context: traceContext }),
      operation: operation({ session_version: 5 }),
      transaction: transaction({ session_version: 5 })
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-operation");
  assert.equal(decision.error.error_code, "AdmissionRejected");
  assert.equal(decision.error.message_id, "msg-1");
  assert.equal(decision.error.parent_action_id, "action-1");
  assert.equal(decision.error.trace_context, traceContext);
  assert.match(decision.error.detail, /operation\.session_version/);
});

test("transaction session_version mismatch with operation rejects", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      message_envelope: envelope({ session_version: 5 }),
      operation: operation({ session_version: 5 }),
      transaction: transaction({ session_version: 6 })
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-transaction");
  assert.equal(decision.error.error_code, "AdmissionRejected");
  assert.equal(decision.error.txn_id, "txn-1");
  assert.equal(decision.error.parent_action_id, "action-1");
  assert.match(decision.error.detail, /transaction\.session_version/);
});

test("backpressure pressure rejects non-urgent work", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      backpressure_snapshot: snapshot({ pending_transactions: limits.max_pending_transactions })
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-backpressure");
});

test("urgent work is not dropped under pressure", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      transaction: transaction({
        transaction_type: "urgent-input",
        priority: "urgent-input"
      }),
      backpressure_snapshot: snapshot({
        pending_transactions: limits.max_pending_transactions,
        pending_bytes: limits.max_pending_bytes + 1
      })
    })
  );

  assert.equal(decision.accepted, true);
  assert.equal(decision.selected_priority, "urgent-input");
});

test("stale projection rejects commit", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      projection_result: projection({ session_version: 2, stale_status: "stale" }),
      projection_bounds: projectionBounds
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "reject-projection");
  assert.equal(decision.should_commit_projection, false);
});

test("current valid projection can commit", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      projection_result: projection(),
      projection_bounds: projectionBounds
    })
  );

  assert.equal(decision.accepted, true);
  assert.equal(decision.should_commit_projection, true);
});

test("higher-priority incoming transaction can preempt lower-priority active transaction", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      transaction: transaction({
        transaction_type: "urgent-input",
        priority: "urgent-input"
      }),
      active_transaction_priority: "background-indexing"
    })
  );

  assert.equal(decision.accepted, true);
  assert.equal(decision.decision_type, "preempt-transaction");
  assert.equal(decision.should_preempt, true);
});

test("lower-priority incoming transaction cannot preempt urgent active transaction", () => {
  const decision = decideCoreAdmission(
    decisionInput({
      transaction: transaction({
        transaction_type: "background-indexing",
        priority: "background-indexing"
      }),
      active_transaction_priority: "urgent-input"
    })
  );

  assert.equal(decision.accepted, false);
  assert.equal(decision.decision_type, "defer-transaction");
  assert.equal(decision.should_preempt, false);
});
