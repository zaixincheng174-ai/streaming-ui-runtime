// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CURRENT_PROTOCOL_VERSION } from "../../runtime/core/protocol.ts";
import { createInitialWorkerAdapterContext } from "../../runtime/worker/worker-context.ts";
import {
  handleWorkerAdapterMessage,
  WORKER_ADAPTER_SERIALIZATION_OPTIONS
} from "../../runtime/worker/worker-message-handler.ts";

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

test("initial worker adapter context has zero counts", () => {
  const context = createInitialWorkerAdapterContext();

  assert.equal(context.processed_message_count, 0);
  assert.equal(context.accepted_message_count, 0);
  assert.equal(context.rejected_message_count, 0);
  assert.equal(context.core_context.op_log.operations.length, 0);
});

test("valid input returns accepted output and increments accepted and processed counts", () => {
  const context = createInitialWorkerAdapterContext();
  const output = handleWorkerAdapterMessage(context, {
    message_envelope: envelope(),
    operation: operation()
  });

  assert.equal(output.accepted, true);
  assert.equal(output.response_type, "accepted");
  assert.equal(output.next_context.processed_message_count, 1);
  assert.equal(output.next_context.accepted_message_count, 1);
  assert.equal(output.next_context.rejected_message_count, 0);
  assert.equal(output.next_context.core_context.op_log.operations.length, 1);
});

test("valid serializable payload is accepted through worker adapter", () => {
  const output = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
    message_envelope: envelope({
      payload: {
        ok: true,
        values: [1, "two", null]
      }
    }),
    operation: operation()
  });

  assert.equal(output.accepted, true);
  assert.equal(output.response_type, "accepted");
});

test("invalid envelope returns rejected output and increments rejected and processed counts", () => {
  const context = createInitialWorkerAdapterContext();
  const invalidEnvelope = envelope();
  delete invalidEnvelope.checksum;

  const output = handleWorkerAdapterMessage(context, {
    message_envelope: invalidEnvelope,
    operation: operation()
  });

  assert.equal(output.accepted, false);
  assert.equal(output.response_type, "rejected");
  assert.equal(output.next_context.processed_message_count, 1);
  assert.equal(output.next_context.accepted_message_count, 0);
  assert.equal(output.next_context.rejected_message_count, 1);
  assert.equal(output.next_context.core_context.op_log.operations.length, 0);
});

test("function payload rejects before core admission", () => {
  const context = createInitialWorkerAdapterContext();
  const output = handleWorkerAdapterMessage(context, {
    message_envelope: envelope({ payload: () => "no" }),
    operation: operation()
  });

  assert.equal(output.accepted, false);
  assert.equal(output.core_decision.decision_type, "reject-envelope");
  assert.equal(output.next_context.processed_message_count, 1);
  assert.equal(output.next_context.accepted_message_count, 0);
  assert.equal(output.next_context.rejected_message_count, 1);
  assert.equal(output.next_context.core_context.op_log.operations.length, 0);
});

test("cyclic payload rejects before core admission", () => {
  const payload = { id: "payload-1" };
  payload.self = payload;

  const output = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
    message_envelope: envelope({ payload }),
    operation: operation()
  });

  assert.equal(output.accepted, false);
  assert.equal(output.core_decision.decision_type, "reject-envelope");
  assert.equal(output.next_context.core_context.op_log.operations.length, 0);
});

test("bigint symbol and undefined payloads reject before core admission", () => {
  const payloads = [1n, Symbol("no"), undefined];

  for (const payload of payloads) {
    const output = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
      message_envelope: envelope({ payload }),
      operation: operation()
    });

    assert.equal(output.accepted, false);
    assert.equal(output.core_decision.decision_type, "reject-envelope");
    assert.equal(output.next_context.accepted_message_count, 0);
    assert.equal(output.next_context.core_context.op_log.operations.length, 0);
  }
});

test("NaN and Infinity payloads reject before core admission", () => {
  const payloads = [Number.NaN, Number.POSITIVE_INFINITY];

  for (const payload of payloads) {
    const output = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
      message_envelope: envelope({ payload }),
      operation: operation()
    });

    assert.equal(output.accepted, false);
    assert.equal(output.core_decision.decision_type, "reject-envelope");
    assert.equal(output.next_context.core_context.op_log.operations.length, 0);
  }
});

test("CJK oversized payload rejects by UTF-8 bytes not UTF-16 length", () => {
  const payload = "你".repeat(Math.floor(WORKER_ADAPTER_SERIALIZATION_OPTIONS.max_string_bytes / 3) + 1);
  assert.ok(payload.length < WORKER_ADAPTER_SERIALIZATION_OPTIONS.max_string_bytes);

  const output = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
    message_envelope: envelope({ payload }),
    operation: operation()
  });

  assert.equal(output.accepted, false);
  assert.equal(output.core_decision.decision_type, "reject-envelope");
  assert.match(output.error.detail, /max_string_bytes/);
});

test("emoji oversized payload rejects by UTF-8 bytes not UTF-16 length", () => {
  const payload = "😀".repeat(Math.floor(WORKER_ADAPTER_SERIALIZATION_OPTIONS.max_string_bytes / 4) + 1);
  assert.ok(payload.length < WORKER_ADAPTER_SERIALIZATION_OPTIONS.max_string_bytes);

  const output = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
    message_envelope: envelope({ payload }),
    operation: operation()
  });

  assert.equal(output.accepted, false);
  assert.equal(output.core_decision.decision_type, "reject-envelope");
  assert.match(output.error.detail, /max_string_bytes/);
});

test("oversized total payload rejects before core admission", () => {
  const output = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
    message_envelope: envelope({
      payload: {
        payload: "a".repeat(WORKER_ADAPTER_SERIALIZATION_OPTIONS.max_total_bytes + 1)
      }
    }),
    operation: operation()
  });

  assert.equal(output.accepted, false);
  assert.equal(output.core_decision.decision_type, "reject-envelope");
  assert.match(output.error.detail, /max_string_bytes|max_total_bytes/);
});

test("rejected serialization path includes recovery decision and keeps accepted count unchanged", () => {
  const context = createInitialWorkerAdapterContext();
  const output = handleWorkerAdapterMessage(context, {
    message_envelope: envelope({ payload: () => "no" }),
    operation: operation()
  });

  assert.equal(output.accepted, false);
  assert.ok(output.recovery_decision);
  assert.equal(output.recovery_decision.action, "reject-message");
  assert.equal(output.next_context.accepted_message_count, 0);
  assert.equal(output.next_context.rejected_message_count, 1);
  assert.equal(output.next_context.core_context, context.core_context);
});

test("rejected serialization path preserves envelope lineage", () => {
  const traceContext = { trace_id: "trace-worker-serialization", span_id: "span-worker-serialization" };
  const output = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
    message_envelope: envelope({
      payload: () => "no",
      message_id: "msg-worker-lineage",
      parent_action_id: "action-worker-lineage",
      trace_context: traceContext
    }),
    operation: operation()
  });

  assert.equal(output.accepted, false);
  assert.equal(output.error.message_id, "msg-worker-lineage");
  assert.equal(output.error.parent_action_id, "action-worker-lineage");
  assert.equal(output.error.trace_context, traceContext);
  assert.equal(output.core_decision.error.message_id, "msg-worker-lineage");
  assert.equal(output.recovery_decision.error_code, output.error.error_code);
});

test("invalid op returns rejected output and context does not accept op", () => {
  const context = createInitialWorkerAdapterContext();
  const invalidOperation = operation();
  delete invalidOperation.block_id;

  const output = handleWorkerAdapterMessage(context, {
    message_envelope: envelope(),
    operation: invalidOperation
  });

  assert.equal(output.accepted, false);
  assert.equal(output.core_decision.decision_type, "reject-operation");
  assert.equal(output.next_context.core_context.op_log.operations.length, 0);
});

test("duplicate op returns rejected output", () => {
  const context = createInitialWorkerAdapterContext();
  const first = handleWorkerAdapterMessage(context, {
    message_envelope: envelope(),
    operation: operation()
  });
  const second = handleWorkerAdapterMessage(first.next_context, {
    message_envelope: envelope({ message_id: "msg-2" }),
    operation: operation()
  });

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(second.core_decision.decision_type, "reject-operation");
  assert.equal(second.next_context.processed_message_count, 2);
  assert.equal(second.next_context.accepted_message_count, 1);
  assert.equal(second.next_context.rejected_message_count, 1);
});

test("duplicate message_id rejects and does not increment accepted count", () => {
  const context = createInitialWorkerAdapterContext();
  const first = handleWorkerAdapterMessage(context, {
    message_envelope: envelope(),
    operation: operation()
  });
  const second = handleWorkerAdapterMessage(first.next_context, {
    message_envelope: envelope(),
    operation: operation({ op_id: "op-2", chunk_id: "chunk-2", append_offset: 5 })
  });

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(second.core_decision.decision_type, "reject-envelope");
  assert.equal(second.error.error_code, "DuplicateMessageId");
  assert.equal(second.error.message_id, "msg-1");
  assert.equal(second.error.parent_action_id, "action-1");
  assert.equal(second.next_context.processed_message_count, 2);
  assert.equal(second.next_context.accepted_message_count, 1);
  assert.equal(second.next_context.rejected_message_count, 1);
  assert.equal(second.next_context.core_context, first.next_context.core_context);
  assert.equal(second.next_context.core_context.op_log.operations.length, 1);
  assert.deepEqual(second.next_context.core_context.processed_message_ids, ["msg-1"]);
});

test("rejection includes recovery decision", () => {
  const invalidEnvelope = envelope();
  delete invalidEnvelope.checksum;

  const output = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
    message_envelope: invalidEnvelope,
    operation: operation()
  });

  assert.equal(output.accepted, false);
  assert.ok(output.recovery_decision);
  assert.equal(output.recovery_decision.action, "reject-message");
  assert.equal(output.next_context.last_recovery_decision, output.recovery_decision);
});

test("accepted output includes metrics snapshot", () => {
  const output = handleWorkerAdapterMessage(createInitialWorkerAdapterContext(), {
    message_envelope: envelope(),
    operation: operation()
  });

  assert.equal(output.accepted, true);
  assert.ok(output.metrics_snapshot);
  assert.equal(output.metrics_snapshot.op_log_count, 1);
  assert.equal(output.next_context.metrics_snapshot, output.metrics_snapshot);
});

test("context updates are immutable", () => {
  const context = createInitialWorkerAdapterContext();
  const output = handleWorkerAdapterMessage(context, {
    message_envelope: envelope(),
    operation: operation()
  });

  assert.notEqual(output.next_context, context);
  assert.notEqual(output.next_context.core_context, context.core_context);
  assert.equal(context.processed_message_count, 0);
  assert.equal(context.core_context.op_log.operations.length, 0);
});

test("serialization rejection keeps context immutable", () => {
  const context = createInitialWorkerAdapterContext();
  const output = handleWorkerAdapterMessage(context, {
    message_envelope: envelope({ payload: () => "no" }),
    operation: operation()
  });

  assert.notEqual(output.next_context, context);
  assert.equal(output.next_context.core_context, context.core_context);
  assert.equal(context.processed_message_count, 0);
  assert.equal(context.accepted_message_count, 0);
  assert.equal(context.rejected_message_count, 0);
});

test("source does not import or use blocked runtime APIs", () => {
  const workerContextSource = readFileSync(
    new URL("../../runtime/worker/worker-context.ts", import.meta.url),
    "utf8"
  );
  const handlerSource = readFileSync(
    new URL("../../runtime/worker/worker-message-handler.ts", import.meta.url),
    "utf8"
  );
  const source = `${workerContextSource}\n${handlerSource}`;
  const forbiddenTokens = [
    "docu" + "ment",
    "win" + "dow",
    "new " + "Worker" + "(",
    "self" + ".onmessage",
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
    assert.equal(source.includes(token), false);
  }
});
