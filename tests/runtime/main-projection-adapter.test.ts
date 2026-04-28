// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluateMainProjection,
  MAIN_PROJECTION_SERIALIZATION_OPTIONS
} from "../../runtime/main/main-projection-adapter.ts";

const projectionBounds = {
  max_blocks: 2,
  max_result_bytes: 128,
  require_checksum: true,
  allow_stale_compatible: false
};

function visibleRange() {
  return {
    start_block_id: "block-1",
    end_block_id: "block-1"
  };
}

function projection(overrides = {}) {
  return {
    projection_id: "projection-1",
    txn_id: "txn-1",
    session_version: 3,
    result_version: 3,
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

function evaluate(overrides = {}, inputOverrides = {}) {
  return evaluateMainProjection({
    projection_result: projection(overrides),
    current_session_version: 3,
    projection_bounds: projectionBounds,
    ...inputOverrides
  });
}

test("valid projection returns should_commit true", () => {
  const decision = evaluate();

  assert.equal(decision.should_commit, true);
  assert.equal(decision.metrics.projection_evaluated, true);
  assert.equal(decision.metrics.should_commit_projection, true);
});

test("valid serializable projection still returns should_commit true", () => {
  const decision = evaluate({
    blocks: [
      {
        block_id: "block-1",
        estimated_bytes: 32,
        text: "serializable"
      }
    ]
  });

  assert.equal(decision.should_commit, true);
  assert.equal(decision.metrics.projection_evaluated, true);
});

test("projection with function fails closed before commit policy", () => {
  const decision = evaluate({ computed: () => "no" });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.reason, "projection serialization validation failed");
  assert.equal(decision.metrics.projection_evaluated, false);
  assert.equal(decision.error.error_code, "MissingRequiredField");
});

test("projection with cyclic object fails closed before commit policy", () => {
  const candidate = projection();
  candidate.self = candidate;

  const decision = evaluateMainProjection({
    projection_result: candidate,
    current_session_version: 3,
    projection_bounds: projectionBounds
  });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.reason, "projection serialization validation failed");
  assert.equal(decision.metrics.projection_evaluated, false);
  assert.match(decision.error.detail, /cyclic/);
});

test("projection with bigint symbol or undefined fails closed", () => {
  const values = [1n, Symbol("no"), undefined];

  for (const value of values) {
    const decision = evaluate({ non_serializable: value });

    assert.equal(decision.should_commit, false);
    assert.equal(decision.reason, "projection serialization validation failed");
    assert.equal(decision.metrics.projection_evaluated, false);
  }
});

test("projection with NaN or Infinity fails closed", () => {
  const values = [Number.NaN, Number.POSITIVE_INFINITY];

  for (const value of values) {
    const decision = evaluate({ non_finite: value });

    assert.equal(decision.should_commit, false);
    assert.equal(decision.reason, "projection serialization validation failed");
    assert.match(decision.error.detail, /finite/);
  }
});

test("projection with Date Map Set RegExp or Error fails closed", () => {
  const values = [new Date(), new Map(), new Set(), /no/, new Error("no")];

  for (const value of values) {
    const decision = evaluate({ non_plain: value });

    assert.equal(decision.should_commit, false);
    assert.equal(decision.reason, "projection serialization validation failed");
    assert.match(decision.error.detail, /plain objects/);
  }
});

test("projection with oversized CJK string fails by UTF-8 bytes", () => {
  const text = "你".repeat(Math.floor(MAIN_PROJECTION_SERIALIZATION_OPTIONS.max_string_bytes / 3) + 1);
  assert.ok(text.length < MAIN_PROJECTION_SERIALIZATION_OPTIONS.max_string_bytes);

  const decision = evaluate({ label: text });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.reason, "projection serialization validation failed");
  assert.match(decision.error.detail, /max_string_bytes/);
});

test("projection with oversized emoji string fails by UTF-8 bytes", () => {
  const text = "😀".repeat(Math.floor(MAIN_PROJECTION_SERIALIZATION_OPTIONS.max_string_bytes / 4) + 1);
  assert.ok(text.length < MAIN_PROJECTION_SERIALIZATION_OPTIONS.max_string_bytes);

  const decision = evaluate({ label: text });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.reason, "projection serialization validation failed");
  assert.match(decision.error.detail, /max_string_bytes/);
});

test("projection exceeding max_total_bytes fails closed", () => {
  const decision = evaluate({
    payload: Array.from(
      { length: MAIN_PROJECTION_SERIALIZATION_OPTIONS.max_array_length },
      () => "a".repeat(70)
    )
  });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.reason, "projection serialization validation failed");
  assert.match(decision.error.detail, /max_total_bytes/);
});

test("serialization rejection includes normalized error and recovery decision", () => {
  const traceContext = { trace_id: "trace-serialization" };
  const decision = evaluate({ computed: () => "no" }, { trace_context: traceContext });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.error.safe_fallback, "reject-projection");
  assert.equal(decision.error.trace_context, traceContext);
  assert.ok(decision.recovery_decision);
  assert.equal(decision.metrics.error_code, decision.error.error_code);
});

test("serialization rejection does not perform or imply rendering or commit behavior", () => {
  const decision = evaluate({ computed: () => "no" });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.metrics.should_commit_projection, false);
  assert.equal("rendered_output" in decision, false);
  assert.equal("committed_projection" in decision, false);
  assert.equal("side_effect" in decision, false);
});

test("stale projection rejects", () => {
  const decision = evaluate({ session_version: 2, stale_status: "stale" });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.error.error_code, "StaleProjectionRejected");
  assert.equal(decision.recovery_decision.action, "request-fresh-projection");
});

test("future projection rejects by default", () => {
  const decision = evaluate({ session_version: 4 });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.error.error_code, "StaleProjectionRejected");
});

test("fractional projection session_version rejects", () => {
  const decision = evaluate({ session_version: 3.5 }, { current_session_version: 3.5 });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.error.error_code, "StaleProjectionRejected");
});

test("missing checksum rejects when required", () => {
  const candidate = projection();
  delete candidate.checksum;

  const decision = evaluateMainProjection({
    projection_result: candidate,
    current_session_version: 3,
    projection_bounds: projectionBounds
  });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.error.error_code, "InvalidChecksum");
  assert.equal(decision.recovery_decision.action, "reject-projection");
});

test("oversized projection rejects", () => {
  const decision = evaluate({
    blocks: [
      {
        block_id: "block-1",
        estimated_bytes: projectionBounds.max_result_bytes + 1
      }
    ]
  });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.error.error_code, "ProjectionTooLarge");
  assert.equal(decision.recovery_decision.action, "request-fresh-projection");
});

test("missing projection_id rejects", () => {
  const candidate = projection();
  delete candidate.projection_id;

  const decision = evaluateMainProjection({
    projection_result: candidate,
    current_session_version: 3,
    projection_bounds: projectionBounds
  });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.error.error_code, "MissingRequiredField");
});

test("missing txn_id rejects", () => {
  const candidate = projection();
  delete candidate.txn_id;

  const decision = evaluateMainProjection({
    projection_result: candidate,
    current_session_version: 3,
    projection_bounds: projectionBounds
  });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.error.error_code, "MissingRequiredField");
});

test("rejected decision includes normalized error and recovery decision", () => {
  const traceContext = { trace_id: "trace-1" };
  const decision = evaluate({ session_version: 2, stale_status: "stale" }, { trace_context: traceContext });

  assert.equal(decision.should_commit, false);
  assert.equal(decision.error.safe_fallback, "reject-projection");
  assert.equal(decision.error.trace_context, traceContext);
  assert.equal(decision.metrics.error_code, decision.error.error_code);
  assert.equal(decision.recovery_decision.error_code, decision.error.error_code);
});

test("valid decision does not perform rendering or commit behavior", () => {
  const decision = evaluate();

  assert.equal(decision.should_commit, true);
  assert.equal("rendered_output" in decision, false);
  assert.equal("committed_projection" in decision, false);
  assert.equal("side_effect" in decision, false);
});

test("source does not import or use blocked browser APIs", () => {
  const source = readFileSync(new URL("../../runtime/main/main-projection-adapter.ts", import.meta.url), "utf8");
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
