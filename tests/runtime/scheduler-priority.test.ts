// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canPreempt,
  shouldAdmitTransaction,
  shouldRejectStaleResult,
  validateSchedulerDecision
} from "../../runtime/core/scheduler-policy.ts";

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
    visible_range: {
      start_block_id: "block-1",
      end_block_id: "block-2"
    },
    dirty_ranges: [],
    required_work_units: 1,
    cancellation_policy: "required-before-visible-commit",
    stale_policy: "reject",
    result_version: 1,
    checksum: "checksum-1",
    projection_contract: {
      max_result_bytes: 4096,
      required_visible_range: {
        start_block_id: "block-1",
        end_block_id: "block-2"
      },
      require_projection_checksum: true,
      require_version_check: true
    },
    trace_context: { trace_id: "trace-1" },
    ...overrides
  };
}

function errorCodes(result) {
  return result.errors.map((error) => error.error_code);
}

test("urgent-input preempts visible-projection", () => {
  assert.equal(canPreempt("visible-projection", "urgent-input"), true);
});

test("visible-projection preempts stream-update", () => {
  assert.equal(canPreempt("stream-update", "visible-projection"), true);
});

test("stream-update preempts background-indexing", () => {
  assert.equal(canPreempt("background-indexing", "stream-update"), true);
});

test("background-indexing cannot preempt urgent-input", () => {
  assert.equal(canPreempt("urgent-input", "background-indexing"), false);
});

test("stale result is rejected when resultSessionVersion is older than currentSessionVersion", () => {
  assert.equal(shouldRejectStaleResult(2, 3), true);
});

test("current-version result is accepted", () => {
  assert.equal(shouldRejectStaleResult(3, 3), false);
});

test("valid transaction with trace_context admits when no active transaction exists", () => {
  const decision = shouldAdmitTransaction(transaction(), null);

  assert.equal(decision.decision, "admit");
  assert.equal(decision.txn_id, "txn-1");
});

test("valid urgent transaction still preempts lower-priority active transaction", () => {
  const decision = shouldAdmitTransaction(transaction({ priority: "urgent-input" }), {
    priority: "visible-projection",
    session_version: 3
  });

  assert.equal(decision.decision, "preempt");
  assert.equal(decision.reason, "candidate priority outranks active transaction");
});

test("scheduler decision fails closed if required transaction fields are missing", () => {
  const candidate = transaction();
  delete candidate.projection_contract;

  const decision = shouldAdmitTransaction(candidate, null);
  const validation = validateSchedulerDecision(decision);

  assert.equal(decision.decision, "reject");
  assert.equal(validation.valid, true);
  assert.match(decision.reason, /projection_contract is required/);
});

test("shouldAdmitTransaction rejects invalid transaction priority", () => {
  const decision = shouldAdmitTransaction(transaction({ priority: "not-a-priority" }), null);

  assert.equal(decision.decision, "reject");
  assert.match(decision.reason, /priority is missing or invalid/);
});

test("shouldAdmitTransaction rejects missing trace_context", () => {
  const candidate = transaction();
  delete candidate.trace_context;

  const decision = shouldAdmitTransaction(candidate, null);

  assert.equal(decision.decision, "reject");
  assert.match(decision.reason, /trace_context is missing or invalid/);
});

test("shouldAdmitTransaction rejects fractional session_version", () => {
  const decision = shouldAdmitTransaction(transaction({ session_version: 3.5 }), null);

  assert.equal(decision.decision, "reject");
  assert.match(decision.reason, /session_version must be a finite non-negative integer/);
});

test("shouldAdmitTransaction rejects fractional result_version", () => {
  const decision = shouldAdmitTransaction(transaction({ result_version: 1.5 }), null);

  assert.equal(decision.decision, "reject");
  assert.match(decision.reason, /result_version must be a finite non-negative integer/);
});

test("shouldAdmitTransaction rejects fractional required_work_units", () => {
  const decision = shouldAdmitTransaction(transaction({ required_work_units: 1.5 }), null);

  assert.equal(decision.decision, "reject");
  assert.match(decision.reason, /required_work_units must be a finite non-negative integer/);
});

test("scheduler decision validation fails closed for malformed decision", () => {
  const result = validateSchedulerDecision({ decision: "admit" });

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("MissingRequiredField"));
});

test("helpers do not import DOM Worker or React APIs", () => {
  const source = readFileSync(new URL("../../runtime/core/scheduler-policy.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\bfrom\s+["']react["']|\bimport\s+React\b|\brequire\(["']react["']\)/);
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b/);
  assert.doesNotMatch(source, /\bnew\s+Worker\s*\(/);
});
