// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CURRENT_PROTOCOL_VERSION } from "../../runtime/core/protocol.ts";
import { createInitialWorkerAdapterContext } from "../../runtime/worker/worker-context.ts";
import { runInMemorySessionScenario } from "../../runtime/testing/in-memory-session-scenario.ts";

const projectionBounds = {
  max_blocks: 2,
  max_result_bytes: 128,
  require_checksum: true,
  allow_stale_compatible: false
};

function envelope(index, overrides = {}) {
  return {
    protocol_version: CURRENT_PROTOCOL_VERSION,
    message_id: `msg-${index}`,
    message_type: "operation",
    parent_action_id: `action-${index}`,
    session_id: "session-1",
    session_version: index,
    created_at_ms: index,
    priority: "stream-update",
    source: "main",
    target: "worker",
    payload: {},
    checksum: `message-checksum-${index}`,
    trace_context: { trace_id: `trace-${index}` },
    ...overrides
  };
}

function operation(index, overrides = {}) {
  return {
    op_id: `op-${index}`,
    parent_action_id: `action-${index}`,
    session_version: index,
    checksum: `op-checksum-${index}`,
    op_type: "AppendChunk",
    block_id: `block-${index}`,
    chunk_id: `chunk-${index}`,
    text_bytes_or_ref: `hello-${index}`,
    append_offset: 0,
    ...overrides
  };
}

function workerInput(index, overrides = {}) {
  return {
    message_envelope: envelope(index),
    operation: operation(index),
    ...overrides
  };
}

function visibleRange(index = 1) {
  return {
    start_block_id: `block-${index}`,
    end_block_id: `block-${index}`
  };
}

function validProjection(index = 1, overrides = {}) {
  return (workerOutput) => ({
    projection_id: `projection-${index}`,
    txn_id: `txn:${workerOutput.next_context.core_context.op_log.operations.at(-1).op_id}`,
    session_version: workerOutput.next_context.core_context.current_session_version,
    result_version: workerOutput.next_context.core_context.current_session_version,
    visible_range: visibleRange(index),
    blocks: [
      {
        block_id: `block-${index}`,
        estimated_bytes: 32
      }
    ],
    checksum: `projection-checksum-${index}`,
    stale_status: "fresh",
    ...overrides
  });
}

function runScenario(overrides = {}) {
  return runInMemorySessionScenario({
    initial_worker_context: createInitialWorkerAdapterContext(),
    steps: [],
    projection_bounds: projectionBounds,
    current_session_version: 1,
    ...overrides
  });
}

test("two valid sequential operations increase final op_log count", () => {
  const result = runScenario({
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(1),
        projection_factory: validProjection(1),
        current_session_version: 1
      },
      {
        step_id: "step-2",
        worker_input: workerInput(2),
        projection_factory: validProjection(2),
        current_session_version: 2
      }
    ]
  });

  assert.equal(result.summary.step_count, 2);
  assert.equal(result.summary.accepted_worker_count, 2);
  assert.equal(result.summary.main_commit_allowed_count, 2);
  assert.equal(result.summary.final_op_log_count, 2);
  assert.equal(result.final_worker_context.core_context.op_log.operations.length, 2);
});

test("duplicate operation in second step rejects and does not increase op_log count", () => {
  const result = runScenario({
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(1),
        projection_factory: validProjection(1),
        current_session_version: 1
      },
      {
        step_id: "step-2",
        worker_input: workerInput(2, {
          operation: operation(2, {
            op_id: "op-1"
          })
        }),
        projection_factory: validProjection(2),
        current_session_version: 2
      }
    ]
  });

  assert.equal(result.summary.accepted_worker_count, 1);
  assert.equal(result.summary.rejected_worker_count, 1);
  assert.equal(result.summary.final_op_log_count, 1);
  assert.equal(result.summary.first_failed_step_id, "step-2");
});

test("stale operation after session_version advances rejects and leaves context unchanged", () => {
  const result = runScenario({
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(2),
        projection_factory: validProjection(2),
        current_session_version: 2
      },
      {
        step_id: "step-2",
        worker_input: workerInput(3, {
          operation: operation(3, {
            session_version: 1
          })
        }),
        projection_factory: validProjection(3),
        current_session_version: 2
      }
    ]
  });

  assert.equal(result.summary.accepted_worker_count, 1);
  assert.equal(result.summary.rejected_worker_count, 1);
  assert.equal(result.summary.final_op_log_count, 1);
  assert.equal(result.final_worker_context.core_context.current_session_version, 2);
});

test("worker rejection prevents projection factory from being called", () => {
  let factoryCalled = false;
  const invalidEnvelope = envelope(1);
  delete invalidEnvelope.checksum;

  const result = runScenario({
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(1, {
          message_envelope: invalidEnvelope
        }),
        projection_factory: () => {
          factoryCalled = true;
          return null;
        }
      }
    ]
  });

  assert.equal(result.summary.rejected_worker_count, 1);
  assert.equal(result.step_results[0].main_evaluated, false);
  assert.equal(factoryCalled, false);
});

test("accepted worker output with valid projection increments main_commit_allowed_count", () => {
  const result = runScenario({
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(1),
        projection_factory: validProjection(1),
        current_session_version: 1
      }
    ]
  });

  assert.equal(result.summary.accepted_worker_count, 1);
  assert.equal(result.summary.main_commit_allowed_count, 1);
  assert.equal(result.summary.main_commit_rejected_count, 0);
});

test("accepted worker output with stale projection increments main_commit_rejected_count", () => {
  const result = runScenario({
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(1),
        projection_factory: validProjection(1, {
          session_version: 1,
          stale_status: "stale"
        }),
        current_session_version: 2
      }
    ]
  });

  assert.equal(result.summary.accepted_worker_count, 1);
  assert.equal(result.summary.main_commit_allowed_count, 0);
  assert.equal(result.summary.main_commit_rejected_count, 1);
  assert.equal(result.summary.first_failed_step_id, "step-1");
  assert.deepEqual(result.summary.error_codes, ["StaleProjectionRejected"]);
});

test("accepted worker output without projection factory leaves main decision absent", () => {
  const result = runScenario({
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(1),
        current_session_version: 1
      }
    ]
  });

  assert.equal(result.summary.accepted_worker_count, 1);
  assert.equal(result.summary.main_commit_allowed_count, 0);
  assert.equal(result.summary.main_commit_rejected_count, 0);
  assert.equal(result.step_results[0].main_evaluated, false);
  assert.equal(result.step_results[0].roundtrip_result.main_decision, null);
});

test("stop_on_reject true stops after first rejected step", () => {
  const invalidEnvelope = envelope(1);
  delete invalidEnvelope.checksum;

  const result = runScenario({
    stop_on_reject: true,
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(1, {
          message_envelope: invalidEnvelope
        }),
        projection_factory: validProjection(1)
      },
      {
        step_id: "step-2",
        worker_input: workerInput(2),
        projection_factory: validProjection(2),
        current_session_version: 2
      }
    ]
  });

  assert.equal(result.summary.step_count, 1);
  assert.equal(result.summary.first_failed_step_id, "step-1");
  assert.equal(result.summary.final_op_log_count, 0);
});

test("stop_on_reject false continues after rejected step", () => {
  const invalidEnvelope = envelope(1);
  delete invalidEnvelope.checksum;

  const result = runScenario({
    stop_on_reject: false,
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(1, {
          message_envelope: invalidEnvelope
        }),
        projection_factory: validProjection(1)
      },
      {
        step_id: "step-2",
        worker_input: workerInput(2),
        projection_factory: validProjection(2),
        current_session_version: 2
      }
    ]
  });

  assert.equal(result.summary.step_count, 2);
  assert.equal(result.summary.rejected_worker_count, 1);
  assert.equal(result.summary.accepted_worker_count, 1);
  assert.equal(result.summary.final_op_log_count, 1);
});

test("summary records first_failed_step_id and error_codes", () => {
  const invalidEnvelope = envelope(1);
  delete invalidEnvelope.checksum;

  const result = runScenario({
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(1, {
          message_envelope: invalidEnvelope
        })
      },
      {
        step_id: "step-2",
        worker_input: workerInput(2),
        projection_factory: validProjection(2),
        current_session_version: 2
      }
    ]
  });

  assert.equal(result.summary.first_failed_step_id, "step-1");
  assert.ok(result.summary.error_codes.includes("InvalidChecksum"));
});

test("scenario does not mutate initial worker context", () => {
  const initialContext = createInitialWorkerAdapterContext();
  const result = runScenario({
    initial_worker_context: initialContext,
    steps: [
      {
        step_id: "step-1",
        worker_input: workerInput(1),
        projection_factory: validProjection(1),
        current_session_version: 1
      }
    ]
  });

  assert.notEqual(result.final_worker_context, initialContext);
  assert.equal(initialContext.processed_message_count, 0);
  assert.equal(initialContext.accepted_message_count, 0);
  assert.equal(initialContext.rejected_message_count, 0);
  assert.equal(initialContext.core_context.op_log.operations.length, 0);
});

test("source does not import or use blocked runtime APIs", () => {
  const sources = [
    readFileSync(new URL("../../runtime/testing/in-memory-session-scenario.ts", import.meta.url), "utf8"),
    readFileSync(new URL("./in-memory-session-scenario.test.ts", import.meta.url), "utf8")
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
