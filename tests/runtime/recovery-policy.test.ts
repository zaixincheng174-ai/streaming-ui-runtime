// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createRuntimeError } from "../../runtime/core/errors.ts";
import {
  classifyRuntimeError,
  createRecoveryPolicyDecision,
  getRecoveryAction,
  shouldQuarantineResult,
  shouldRetry
} from "../../runtime/core/recovery-policy.ts";

test("MissingRequiredField maps to reject-message", () => {
  const decision = createRecoveryPolicyDecision("MissingRequiredField");

  assert.equal(decision.action, "reject-message");
  assert.equal(decision.safe_fallback, "reject-message");
  assert.equal(decision.retry, false);
});

test("StaleProjectionRejected maps to request-fresh-projection", () => {
  assert.equal(getRecoveryAction("StaleProjectionRejected"), "request-fresh-projection");
  assert.equal(shouldRetry("StaleProjectionRejected"), true);
});

test("WorkerCrashed maps to reinitialize-worker and recoverable", () => {
  const decision = createRecoveryPolicyDecision("WorkerCrashed");

  assert.equal(decision.action, "reinitialize-worker");
  assert.equal(decision.severity, "recoverable");
  assert.equal(decision.retry, true);
});

test("WorkerTimeout maps to cancel-transaction or reinitialize-worker by context", () => {
  assert.equal(getRecoveryAction("WorkerTimeout"), "cancel-transaction");
  assert.equal(getRecoveryAction({ error: "WorkerTimeout", context: "worker" }), "reinitialize-worker");
  assert.equal(shouldRetry("WorkerTimeout"), false);
  assert.equal(shouldRetry({ error: "WorkerTimeout", context: "worker" }), true);
});

test("BackpressureLimitExceeded maps to throttle-background", () => {
  const decision = createRecoveryPolicyDecision("BackpressureLimitExceeded");

  assert.equal(decision.action, "throttle-background");
  assert.equal(decision.retry, true);
});

test("EquivalenceMismatch quarantines result", () => {
  const decision = createRecoveryPolicyDecision("EquivalenceMismatch");

  assert.equal(decision.action, "quarantine-result");
  assert.equal(decision.quarantine_result, true);
  assert.equal(shouldQuarantineResult("EquivalenceMismatch"), true);
});

test("ProjectionTooLarge rejects or requests smaller fresh projection", () => {
  assert.equal(getRecoveryAction("ProjectionTooLarge"), "reject-projection");
  assert.equal(getRecoveryAction({ error: "ProjectionTooLarge", context: "projection" }), "request-fresh-projection");
  assert.equal(shouldRetry({ error: "ProjectionTooLarge", context: "projection" }), true);
});

test("TransactionCanceled does not retry", () => {
  const decision = createRecoveryPolicyDecision("TransactionCanceled");

  assert.equal(decision.severity, "info");
  assert.equal(decision.retry, false);
});

test("UnknownMessageType rejects message", () => {
  const decision = createRecoveryPolicyDecision("UnknownMessageType");

  assert.equal(decision.action, "reject-message");
  assert.equal(decision.retry, false);
});

test("DuplicateMessageId returns idempotent-safe decision", () => {
  const decision = createRecoveryPolicyDecision("DuplicateMessageId");

  assert.equal(decision.action, "idempotent-ack");
  assert.equal(decision.severity, "info");
  assert.equal(decision.retry, false);
});

test("DuplicateOperationId returns safe reject decision", () => {
  const decision = createRecoveryPolicyDecision("DuplicateOperationId");

  assert.equal(decision.action, "reject-message");
  assert.equal(decision.severity, "warning");
  assert.equal(decision.retry, false);
  assert.equal(decision.quarantine_result, false);
});

test("InvalidChecksum uses projection context for projection rejection", () => {
  const messageDecision = createRecoveryPolicyDecision("InvalidChecksum");
  const projectionDecision = createRecoveryPolicyDecision({
    error: createRuntimeError("InvalidChecksum"),
    context: "projection"
  });

  assert.equal(messageDecision.action, "reject-message");
  assert.equal(projectionDecision.action, "reject-projection");
});

test("createRecoveryPolicyDecision returns stable shape with severity action retry and quarantine fields", () => {
  const decision = createRecoveryPolicyDecision("WorkerCrashed");

  assert.equal(typeof decision.error_code, "string");
  assert.equal(typeof decision.severity, "string");
  assert.equal(typeof decision.action, "string");
  assert.equal(typeof decision.retry, "boolean");
  assert.equal(typeof decision.quarantine_result, "boolean");
  assert.equal(typeof decision.safe_fallback, "string");
  assert.equal(classifyRuntimeError("ProtocolVersionUnsupported"), "fatal");
});

test("createRecoveryPolicyDecision preserves error lineage", () => {
  const trace_context = { trace_id: "trace-1" };
  const decision = createRecoveryPolicyDecision(
    createRuntimeError("AdmissionRejected", {
      message_id: "msg-1",
      parent_action_id: "action-1",
      txn_id: "txn-1",
      trace_context
    })
  );

  assert.equal(decision.error_code, "AdmissionRejected");
  assert.equal(decision.message_id, "msg-1");
  assert.equal(decision.parent_action_id, "action-1");
  assert.equal(decision.txn_id, "txn-1");
  assert.equal(decision.trace_context, trace_context);
});

test("source does not import or use blocked browser APIs", () => {
  const source = readFileSync(new URL("../../runtime/core/recovery-policy.ts", import.meta.url), "utf8");
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
