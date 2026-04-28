import type { BackpressureLimits, BackpressureSnapshot } from "./backpressure-policy.ts";
import { decideCoreAdmission, type CoreDecision } from "./core-decision.ts";
import {
  createDecisionTrace,
  markTraceFailure,
  markTracePass,
  type DecisionTrace
} from "./decision-trace.ts";
import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";
import { createCoreMetricsSnapshot, type CoreMetricsSnapshot } from "./metrics-snapshot.ts";
import { appendOperation, createEmptyOpLog, type OpLog } from "./op-log.ts";
import { validateOperation } from "./op-validation.ts";
import type { RuntimeOperation } from "./ops.ts";
import type { ProjectionBounds, ProjectionResultShape } from "./projection-policy.ts";
import { validateMessageEnvelope, type TraceContext } from "./protocol.ts";
import type { PriorityLane } from "./priorities.ts";
import {
  applyOperationToState,
  createEmptySessionState,
  type SessionState
} from "./state-store.ts";
import {
  createTransactionFromOperation,
  markTransactionAccepted,
  type CreateTransactionFromOperationOptions,
  type TransactionLifecycleRecord
} from "./transaction-lifecycle.ts";
import { validateTransaction } from "./transaction-validation.ts";

export interface CoreRuntimeContext {
  op_log: OpLog;
  session_state: SessionState;
  session_version: number;
  current_session_version: number;
  backpressure_snapshot: BackpressureSnapshot;
  backpressure_limits: BackpressureLimits;
  active_transaction_priority?: PriorityLane;
  processed_message_ids: readonly string[];
}

export interface CoreEngineInput {
  message_envelope: unknown;
  operation: Partial<RuntimeOperation> | Record<string, unknown>;
  transaction_options?: CreateTransactionFromOperationOptions;
  backpressure_snapshot?: BackpressureSnapshot;
  backpressure_limits?: BackpressureLimits;
  active_transaction_priority?: PriorityLane;
  projection_result?: Partial<ProjectionResultShape> | null;
  projection_bounds?: ProjectionBounds;
}

export interface CoreEngineResult {
  accepted: boolean;
  context: CoreRuntimeContext;
  decision: CoreDecision;
  trace: DecisionTrace;
  metrics_snapshot: CoreMetricsSnapshot;
  transaction_record?: TransactionLifecycleRecord;
  errors: RuntimeErrorShape[];
}

const defaultBackpressureSnapshot: BackpressureSnapshot = {
  pending_transactions: 0,
  pending_bytes: 0,
  largest_pending_projection_bytes: 0,
  uncommitted_projection_count: 0,
  background_queue_depth: 0,
  stream_update_queue_depth: 0
};

const defaultBackpressureLimits: BackpressureLimits = {
  max_pending_transactions: 16,
  max_pending_bytes: 1024 * 1024,
  max_projection_result_bytes: 64 * 1024,
  max_uncommitted_projection_count: 4
};

export function createInitialCoreContext(overrides: Partial<CoreRuntimeContext> = {}): CoreRuntimeContext {
  const sessionVersion = resolveInitialSessionVersion(overrides);
  const baseSessionState = overrides.session_state ?? createEmptySessionState(sessionVersion);
  const normalizedSessionVersion = Math.max(sessionVersion, baseSessionState.session_version);
  const sessionState =
    baseSessionState.session_version === normalizedSessionVersion
      ? baseSessionState
      : {
          ...baseSessionState,
          session_version: normalizedSessionVersion
        };

  return {
    op_log: overrides.op_log ?? createEmptyOpLog(),
    session_state: sessionState,
    session_version: normalizedSessionVersion,
    current_session_version: normalizedSessionVersion,
    backpressure_snapshot: overrides.backpressure_snapshot ?? defaultBackpressureSnapshot,
    backpressure_limits: overrides.backpressure_limits ?? defaultBackpressureLimits,
    active_transaction_priority: overrides.active_transaction_priority,
    processed_message_ids: overrides.processed_message_ids ?? []
  };
}

function resolveInitialSessionVersion(overrides: Partial<CoreRuntimeContext>): number {
  const candidates = [
    validateInitialSessionVersion(overrides.session_version, "session_version"),
    validateInitialSessionVersion(overrides.current_session_version, "current_session_version"),
    validateInitialSessionVersion(overrides.session_state?.session_version, "session_state.session_version")
  ].filter((value): value is number => value != null);

  return candidates.length === 0 ? 0 : Math.max(...candidates);
}

function validateInitialSessionVersion(value: number | undefined, fieldName: string): number | undefined {
  if (value == null) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} must be a finite non-negative integer`);
  }

  return value;
}

export function processRuntimeMessage(context: CoreRuntimeContext, input: CoreEngineInput): CoreEngineResult {
  let trace = createDecisionTrace();
  const envelopeValidation = validateMessageEnvelope(input.message_envelope, {
    seen_message_ids: new Set(context.processed_message_ids),
    duplicate_message_id_policy: "reject"
  });
  if (!envelopeValidation.valid) {
    trace = markTraceFailure(
      trace,
      "envelope-validation",
      "message envelope validation failed",
      envelopeValidation.errors[0]?.error_code
    );
    return rejected(context, "reject-envelope", envelopeValidation.errors, trace);
  }
  trace = markTracePass(trace, "envelope-validation", "message envelope accepted");
  const messageId = getEnvelopeMessageId(input.message_envelope);

  const operationValidation = validateOperation(input.operation);
  if (!operationValidation.valid) {
    trace = markTraceFailure(
      trace,
      "operation-validation",
      "operation validation failed",
      operationValidation.errors[0]?.error_code
    );
    return rejected(context, "reject-operation", operationValidation.errors, trace);
  }
  trace = markTracePass(trace, "operation-validation", "operation accepted");

  const appendResult = appendOperation(context.op_log, input.operation);
  if (!appendResult.accepted) {
    trace = markTraceFailure(trace, "op-log-append", "operation append failed", appendResult.errors[0]?.error_code);
    return rejected(context, "reject-operation", appendResult.errors, trace);
  }
  trace = markTracePass(trace, "op-log-append", "operation appended");

  const transactionResult = createTransactionFromOperation(appendResult.operation, {
    ...input.transaction_options,
    trace_context: getEnvelopeTraceContext(input.message_envelope) ?? input.transaction_options?.trace_context
  });
  if (!transactionResult.ok) {
    trace = markTraceFailure(
      trace,
      "transaction-creation",
      "transaction creation failed",
      transactionResult.errors[0]?.error_code
    );
    return rejected(context, "reject-transaction", transactionResult.errors, trace);
  }
  trace = markTracePass(trace, "transaction-creation", "transaction created");

  const transactionValidation = validateTransaction(transactionResult.record.transaction);
  if (!transactionValidation.valid) {
    trace = markTraceFailure(
      trace,
      "transaction-validation",
      "transaction validation failed",
      transactionValidation.errors[0]?.error_code
    );
    return rejected(context, "reject-transaction", transactionValidation.errors, trace);
  }
  trace = markTracePass(trace, "transaction-validation", "transaction accepted");

  const decision = decideCoreAdmission({
    message_envelope: input.message_envelope,
    message_envelope_validation: envelopeValidation,
    operation: appendResult.operation,
    transaction: transactionResult.record.transaction,
    backpressure_snapshot: input.backpressure_snapshot ?? context.backpressure_snapshot,
    backpressure_limits: input.backpressure_limits ?? context.backpressure_limits,
    active_transaction_priority: input.active_transaction_priority ?? context.active_transaction_priority,
    current_session_version: context.current_session_version,
    projection_result: input.projection_result,
    projection_bounds: input.projection_bounds
  });

  if (!decision.accepted) {
    trace = traceCoreDecisionRejection(trace, decision);
    const tracedDecision = withTrace(decision, trace);
    return {
      accepted: false,
      context,
      decision: tracedDecision,
      trace,
      transaction_record: transactionResult.record,
      metrics_snapshot: createCoreMetricsSnapshot(context, tracedDecision),
      errors: decision.errors
    };
  }

  const acceptedTransaction = markTransactionAccepted(transactionResult.record);
  if (!acceptedTransaction.ok) {
    trace = markTraceFailure(
      trace,
      "transaction-validation",
      "transaction acceptance transition failed",
      acceptedTransaction.errors[0]?.error_code
    );
    return rejected(context, "reject-transaction", acceptedTransaction.errors, trace);
  }

  const stateResult = applyOperationToState(context.session_state, appendResult.operation);
  if (!stateResult.accepted) {
    trace = markTraceFailure(
      trace,
      "final-decision",
      "state-store application failed",
      stateResult.errors[0]?.error_code
    );
    return rejected(context, "reject-operation", stateResult.errors, trace);
  }

  trace = markTracePass(trace, "backpressure-check", "backpressure accepted");
  trace = markTracePass(trace, "scheduler-admission", decision.should_preempt ? "transaction preempted" : "transaction admitted");
  if (input.projection_result != null) {
    trace = markTracePass(trace, "projection-policy", "projection accepted");
  }
  trace = markTracePass(trace, "final-decision", "core decision accepted");

  const nextContext = {
    ...context,
    op_log: appendResult.log,
    session_state: stateResult.state,
    session_version: stateResult.state.session_version,
    current_session_version: stateResult.state.session_version,
    processed_message_ids: appendProcessedMessageId(context.processed_message_ids, messageId)
  };
  const tracedDecision = withTrace(decision, trace);

  return {
    accepted: true,
    context: nextContext,
    decision: tracedDecision,
    trace,
    metrics_snapshot: createCoreMetricsSnapshot(nextContext, tracedDecision),
    transaction_record: acceptedTransaction.record,
    errors: []
  };
}

function rejected(
  context: CoreRuntimeContext,
  decisionType: CoreDecision["decision_type"],
  errors: RuntimeErrorShape[],
  trace: DecisionTrace
): CoreEngineResult {
  const normalizedErrors =
    errors.length > 0
      ? errors
      : [
          createRuntimeError("AdmissionRejected", {
            detail: "core engine rejected without explicit error"
          })
        ];

  return {
    accepted: false,
    context,
    decision: {
      accepted: false,
      decision_type: decisionType,
      reasons: normalizedErrors.map((error) => error.detail ?? error.error_code),
      error: normalizedErrors[0],
      errors: normalizedErrors,
      trace
    },
    trace,
    metrics_snapshot: createCoreMetricsSnapshot(context, {
      accepted: false,
      decision_type: decisionType,
      reasons: normalizedErrors.map((error) => error.detail ?? error.error_code),
      error: normalizedErrors[0],
      errors: normalizedErrors,
      trace
    }),
    errors: normalizedErrors
  };
}

function traceCoreDecisionRejection(trace: DecisionTrace, decision: CoreDecision): DecisionTrace {
  const errorCode = decision.error?.error_code;
  const reason = decision.reasons[0] ?? decision.decision_type;

  if (decision.decision_type === "reject-backpressure") {
    return markTraceFailure(trace, "backpressure-check", reason, errorCode);
  }

  trace = markTracePass(trace, "backpressure-check", "backpressure accepted");

  if (decision.decision_type === "defer-transaction") {
    return markTraceFailure(trace, "scheduler-admission", reason, errorCode);
  }

  if (decision.decision_type === "reject-projection") {
    trace = markTracePass(trace, "scheduler-admission", "transaction admitted");
    return markTraceFailure(trace, "projection-policy", reason, errorCode);
  }

  return markTraceFailure(trace, "scheduler-admission", reason, errorCode);
}

function withTrace(decision: CoreDecision, trace: DecisionTrace): CoreDecision {
  return {
    ...decision,
    trace
  };
}

function getEnvelopeMessageId(message: unknown): string {
  if (isRecord(message) && typeof message.message_id === "string") {
    return message.message_id;
  }

  return "";
}

function getEnvelopeTraceContext(message: unknown): TraceContext | undefined {
  if (isRecord(message) && isRecord(message.trace_context)) {
    return message.trace_context as TraceContext;
  }

  return undefined;
}

function appendProcessedMessageId(processedMessageIds: readonly string[], messageId: string): readonly string[] {
  if (messageId === "" || processedMessageIds.includes(messageId)) {
    return processedMessageIds;
  }

  return [...processedMessageIds, messageId];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
