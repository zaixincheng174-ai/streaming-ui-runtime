import {
  processRuntimeMessage,
  type CoreEngineInput
} from "../core/core-engine.ts";
import type { CoreDecision } from "../core/core-decision.ts";
import { createRuntimeError, type RuntimeErrorShape } from "../core/errors.ts";
import {
  createCoreMetricsSnapshot,
  summarizeDecisionMetrics,
  type CoreMetricsSnapshot
} from "../core/metrics-snapshot.ts";
import { validateMessageEnvelope } from "../core/protocol.ts";
import {
  createRecoveryPolicyDecision,
  type RecoveryPolicyDecision,
  type RecoveryPolicyInput
} from "../core/recovery-policy.ts";
import {
  updateWorkerAdapterContext,
  type WorkerAdapterContext
} from "./worker-context.ts";

export type WorkerAdapterInput = CoreEngineInput;

export type WorkerAdapterResponseType = "accepted" | "rejected" | "error";

export const WORKER_ADAPTER_SERIALIZATION_OPTIONS = {
  max_depth: 12,
  max_array_length: 4096,
  max_object_keys: 512,
  max_string_bytes: 64 * 1024,
  max_total_bytes: 256 * 1024
} as const;

export interface WorkerAdapterOutput {
  next_context: WorkerAdapterContext;
  accepted: boolean;
  core_decision: CoreDecision;
  recovery_decision?: RecoveryPolicyDecision;
  metrics_snapshot?: CoreMetricsSnapshot;
  response_type: WorkerAdapterResponseType;
  error?: RuntimeErrorShape;
}

export function handleWorkerAdapterMessage(
  context: WorkerAdapterContext,
  input: WorkerAdapterInput
): WorkerAdapterOutput {
  const envelopeValidation = validateMessageEnvelope(input.message_envelope, {
    validate_payload_serializable: true,
    payload_serialization_options: WORKER_ADAPTER_SERIALIZATION_OPTIONS
  });
  if (!envelopeValidation.valid) {
    return rejectBeforeCore(context, "reject-envelope", envelopeValidation.errors);
  }

  const coreResult = processRuntimeMessage(context.core_context, input);
  const recoveryDecision =
    coreResult.accepted || coreResult.decision.error == null
      ? undefined
      : createRecoveryPolicyDecision({
          error: coreResult.decision.error,
          context: recoveryContextForDecision(coreResult.decision.decision_type)
        });
  const nextContext = updateWorkerAdapterContext(context, coreResult, recoveryDecision);

  return {
    next_context: nextContext,
    accepted: coreResult.accepted,
    core_decision: coreResult.decision,
    recovery_decision: recoveryDecision,
    metrics_snapshot: coreResult.metrics_snapshot,
    response_type: coreResult.accepted ? "accepted" : "rejected",
    error: coreResult.decision.error
  };
}

function rejectBeforeCore(
  context: WorkerAdapterContext,
  decisionType: CoreDecision["decision_type"],
  errors: RuntimeErrorShape[]
): WorkerAdapterOutput {
  const normalizedErrors =
    errors.length > 0
      ? errors
      : [
          createRuntimeError("AdmissionRejected", {
            detail: "worker adapter rejected before core without explicit error"
          })
        ];
  const primaryError = normalizedErrors[0] ?? createRuntimeError("AdmissionRejected");
  const decision: CoreDecision = {
    accepted: false,
    decision_type: decisionType,
    reasons: normalizedErrors.map((error) => error.detail ?? error.error_code),
    error: primaryError,
    errors: normalizedErrors
  };
  const recoveryDecision = createRecoveryPolicyDecision({
    error: primaryError,
    context: recoveryContextForDecision(decision.decision_type)
  });
  const metricsSnapshot = createCoreMetricsSnapshot(context.core_context, decision);
  const nextContext: WorkerAdapterContext = {
    ...context,
    last_decision_summary: summarizeDecisionMetrics(decision),
    last_recovery_decision: recoveryDecision,
    metrics_snapshot: metricsSnapshot,
    processed_message_count: context.processed_message_count + 1,
    rejected_message_count: context.rejected_message_count + 1
  };

  return {
    next_context: nextContext,
    accepted: false,
    core_decision: decision,
    recovery_decision: recoveryDecision,
    metrics_snapshot: metricsSnapshot,
    response_type: "rejected",
    error: decision.error
  };
}

function recoveryContextForDecision(decisionType: CoreDecision["decision_type"]): RecoveryPolicyInput["context"] {
  switch (decisionType) {
    case "reject-projection":
      return "projection";
    case "reject-backpressure":
      return "backpressure";
    case "reject-transaction":
    case "defer-transaction":
      return "transaction";
    case "reject-envelope":
    case "reject-operation":
    case "accept":
    case "preempt-transaction":
      return "message";
  }
}
