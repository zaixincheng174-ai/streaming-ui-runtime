// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CURRENT_PROTOCOL_VERSION } from "../../runtime/core/protocol.ts";
import { createInitialWorkerAdapterContext } from "../../runtime/worker/worker-context.ts";
import { runInMemoryWorkerMainRoundtrip } from "../../runtime/testing/in-memory-roundtrip.ts";

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

function workerInput(overrides = {}) {
  return {
    message_envelope: envelope(),
    operation: operation(),
    ...overrides
  };
}

function visibleRange() {
  return {
    start_block_id: "block-1",
    end_block_id: "block-1"
  };
}

function validProjection(workerOutput, overrides = {}) {
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

function run(overrides = {}) {
  return runInMemoryWorkerMainRoundtrip({
    worker_context: createInitialWorkerAdapterContext(),
    worker_input: workerInput(),
    projection_factory: (workerOutput) => validProjection(workerOutput),
    current_session_version: 1,
    projection_bounds: projectionBounds,
    trace_context: { trace_id: "trace-1" },
    ...overrides
  });
}

test("valid worker input and valid projection produces worker accepted and main commit decision", () => {
  const result = run();

  assert.equal(result.worker_output.accepted, true);
  assert.equal(result.main_decision.should_commit, true);
  assert.equal(result.summary.worker_accepted, true);
  assert.equal(result.summary.main_evaluated, true);
  assert.equal(result.summary.accepted, true);
  assert.equal(result.next_context.core_context.op_log.operations.length, 1);
});

test("invalid worker envelope rejects and projection factory is not called", () => {
  let factoryCalled = false;
  const invalidEnvelope = envelope();
  delete invalidEnvelope.checksum;

  const result = run({
    worker_input: workerInput({ message_envelope: invalidEnvelope }),
    projection_factory: () => {
      factoryCalled = true;
      return null;
    }
  });

  assert.equal(result.worker_output.accepted, false);
  assert.equal(result.main_decision, null);
  assert.equal(result.summary.main_evaluated, false);
  assert.equal(factoryCalled, false);
});

test("invalid worker payload serialization rejects and projection factory is not called", () => {
  let factoryCalled = false;

  const result = run({
    worker_input: workerInput({ message_envelope: envelope({ payload: () => "no" }) }),
    projection_factory: () => {
      factoryCalled = true;
      return null;
    }
  });

  assert.equal(result.worker_output.accepted, false);
  assert.equal(result.worker_output.core_decision.decision_type, "reject-envelope");
  assert.equal(result.main_decision, null);
  assert.equal(factoryCalled, false);
});

test("stale projection from projection factory is rejected by main adapter", () => {
  const result = run({
    current_session_version: 2,
    projection_factory: (workerOutput) =>
      validProjection(workerOutput, {
        session_version: 1,
        stale_status: "stale"
      })
  });

  assert.equal(result.worker_output.accepted, true);
  assert.equal(result.main_decision.should_commit, false);
  assert.equal(result.main_decision.error.error_code, "StaleProjectionRejected");
  assert.equal(result.summary.accepted, false);
});

test("missing checksum projection is rejected by main adapter", () => {
  const result = run({
    projection_factory: (workerOutput) => {
      const projection = validProjection(workerOutput);
      delete projection.checksum;
      return projection;
    }
  });

  assert.equal(result.worker_output.accepted, true);
  assert.equal(result.main_decision.should_commit, false);
  assert.equal(result.main_decision.error.error_code, "InvalidChecksum");
});

test("cyclic projection result is rejected by main adapter serialization guard", () => {
  const result = run({
    projection_factory: (workerOutput) => {
      const projection = validProjection(workerOutput);
      projection.self = projection;
      return projection;
    }
  });

  assert.equal(result.worker_output.accepted, true);
  assert.equal(result.main_decision.should_commit, false);
  assert.equal(result.main_decision.reason, "projection serialization validation failed");
  assert.equal(result.main_decision.metrics.projection_evaluated, false);
});

test("oversized projection result is rejected by main adapter", () => {
  const result = run({
    projection_factory: (workerOutput) =>
      validProjection(workerOutput, {
        blocks: [
          {
            block_id: "block-1",
            estimated_bytes: projectionBounds.max_result_bytes + 1
          }
        ]
      })
  });

  assert.equal(result.worker_output.accepted, true);
  assert.equal(result.main_decision.should_commit, false);
  assert.equal(result.main_decision.error.error_code, "ProjectionTooLarge");
});

test("rejected worker path includes recovery decision or normalized error", () => {
  const invalidEnvelope = envelope();
  delete invalidEnvelope.checksum;

  const result = run({
    worker_input: workerInput({ message_envelope: invalidEnvelope })
  });

  assert.equal(result.worker_output.accepted, false);
  assert.ok(result.worker_output.recovery_decision ?? result.worker_output.error);
  assert.equal(result.main_decision, null);
});

test("accepted worker path includes metrics snapshot", () => {
  const result = run();

  assert.equal(result.worker_output.accepted, true);
  assert.ok(result.worker_output.metrics_snapshot);
});

test("roundtrip does not mutate original worker context", () => {
  const context = createInitialWorkerAdapterContext();
  const result = run({ worker_context: context });

  assert.notEqual(result.next_context, context);
  assert.equal(context.processed_message_count, 0);
  assert.equal(context.accepted_message_count, 0);
  assert.equal(context.rejected_message_count, 0);
  assert.equal(context.core_context.op_log.operations.length, 0);
});

test("source does not import or use blocked runtime APIs", () => {
  const sources = [
    readFileSync(new URL("../../runtime/testing/in-memory-roundtrip.ts", import.meta.url), "utf8"),
    readFileSync(new URL("./in-memory-roundtrip.test.ts", import.meta.url), "utf8")
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
