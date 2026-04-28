// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { CURRENT_PROTOCOL_VERSION, validateMessageEnvelope } from "../../runtime/core/protocol.ts";
import { comparePriority, isPreemptibleBy } from "../../runtime/core/priorities.ts";

function validEnvelope(overrides = {}) {
  return {
    protocol_version: CURRENT_PROTOCOL_VERSION,
    message_id: "msg-1",
    message_type: "operation",
    parent_action_id: "action-1",
    session_id: "session-1",
    session_version: 1,
    created_at_ms: 1,
    priority: "visible-projection",
    source: "main",
    target: "worker",
    payload: {},
    checksum: "checksum-1",
    trace_context: {},
    ...overrides
  };
}

function errorCodes(result) {
  return result.errors.map((error) => error.error_code);
}

test("missing protocol_version fails closed", () => {
  const message = validEnvelope();
  delete message.protocol_version;

  const result = validateMessageEnvelope(message);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("unsupported protocol_version fails closed", () => {
  const result = validateMessageEnvelope(validEnvelope({ protocol_version: "p2.future" }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("ProtocolVersionUnsupported"));
});

test("missing message_id fails closed", () => {
  const message = validEnvelope();
  delete message.message_id;

  const result = validateMessageEnvelope(message);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("missing parent_action_id fails closed", () => {
  const message = validEnvelope();
  delete message.parent_action_id;

  const result = validateMessageEnvelope(message);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("unknown message_type fails closed", () => {
  const result = validateMessageEnvelope(validEnvelope({ message_type: "unknown" }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("UnknownMessageType"));
});

test("missing checksum fails closed", () => {
  const message = validEnvelope();
  delete message.checksum;

  const result = validateMessageEnvelope(message);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("InvalidChecksum"));
});

test("non-finite numeric checksum fails closed", () => {
  const result = validateMessageEnvelope(validEnvelope({ checksum: Number.POSITIVE_INFINITY }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("InvalidChecksum"));
});

test("missing source fails closed", () => {
  const message = validEnvelope();
  delete message.source;

  const result = validateMessageEnvelope(message);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("invalid source fails closed", () => {
  const result = validateMessageEnvelope(validEnvelope({ source: "browser" }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("invalid envelope preserves available message lineage", () => {
  const traceContext = { trace_id: "trace-lineage", span_id: "span-lineage" };
  const result = validateMessageEnvelope(validEnvelope({
    source: "browser",
    message_id: "msg-lineage",
    parent_action_id: "action-lineage",
    trace_context: traceContext
  }));

  assert.equal(result.valid, false);
  assert.equal(result.errors[0].message_id, "msg-lineage");
  assert.equal(result.errors[0].parent_action_id, "action-lineage");
  assert.equal(result.errors[0].trace_context, traceContext);
});

test("missing target fails closed", () => {
  const message = validEnvelope();
  delete message.target;

  const result = validateMessageEnvelope(message);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("invalid target fails closed", () => {
  const result = validateMessageEnvelope(validEnvelope({ target: "browser" }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("missing session_version fails closed", () => {
  const message = validEnvelope();
  delete message.session_version;

  const result = validateMessageEnvelope(message);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("non-numeric session_version fails closed", () => {
  const result = validateMessageEnvelope(validEnvelope({ session_version: "1" }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("fractional session_version fails closed", () => {
  const result = validateMessageEnvelope(validEnvelope({ session_version: 1.5 }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
  assert.match(result.errors[0].detail, /finite non-negative integer/);
});

test("missing created_at_ms fails closed", () => {
  const message = validEnvelope();
  delete message.created_at_ms;

  const result = validateMessageEnvelope(message);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("non-numeric created_at_ms fails closed", () => {
  const result = validateMessageEnvelope(validEnvelope({ created_at_ms: "1" }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("missing trace_context fails closed", () => {
  const message = validEnvelope();
  delete message.trace_context;

  const result = validateMessageEnvelope(message);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("invalid trace_context fails closed", () => {
  const result = validateMessageEnvelope(validEnvelope({ trace_context: null }));

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("valid minimal envelope passes", () => {
  const result = validateMessageEnvelope(validEnvelope());

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("envelope with non-serializable payload fails closed when payload serialization validation is enabled", () => {
  const traceContext = { trace_id: "trace-serialization" };
  const result = validateMessageEnvelope(validEnvelope({
    payload: () => "no",
    message_id: "msg-serialization",
    parent_action_id: "action-serialization",
    trace_context: traceContext
  }), {
    validate_payload_serializable: true
  });

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
  assert.equal(result.errors[0].message_id, "msg-serialization");
  assert.equal(result.errors[0].parent_action_id, "action-serialization");
  assert.equal(result.errors[0].trace_context, traceContext);
});

test("envelope with serializable payload passes when payload serialization validation is enabled", () => {
  const result = validateMessageEnvelope(validEnvelope({ payload: { ok: true, values: [1, "two"] } }), {
    validate_payload_serializable: true
  });

  assert.equal(result.valid, true);
});

test("envelope with cyclic payload fails closed when payload serialization validation is enabled", () => {
  const payload = { id: "payload-1" };
  payload.self = payload;

  const result = validateMessageEnvelope(validEnvelope({ payload }), {
    validate_payload_serializable: true
  });

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("duplicate message_id policy is explicit", () => {
  const seen = new Set(["msg-1"]);

  const rejected = validateMessageEnvelope(validEnvelope(), {
    seen_message_ids: seen,
    duplicate_message_id_policy: "reject"
  });
  assert.equal(rejected.valid, false);
  assert.ok(errorCodes(rejected).includes("DuplicateMessageId"));
  assert.equal(rejected.duplicate_message_id, true);

  const idempotent = validateMessageEnvelope(validEnvelope(), {
    seen_message_ids: seen,
    duplicate_message_id_policy: "idempotent"
  });
  assert.equal(idempotent.valid, true);
  assert.equal(idempotent.duplicate_message_id, true);
});

test("priority ordering matches P2 lane contract", () => {
  assert.ok(comparePriority("urgent-input", "visible-projection") > 0);
  assert.ok(comparePriority("visible-projection", "stream-update") > 0);
  assert.ok(comparePriority("stream-update", "background-indexing") > 0);
});

test("priority preemption helper stays pure and ordered", () => {
  assert.equal(isPreemptibleBy("background-indexing", "urgent-input"), true);
  assert.equal(isPreemptibleBy("urgent-input", "background-indexing"), false);
});
