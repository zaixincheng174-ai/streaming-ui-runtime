import type { RuntimeErrorCode } from "./errors.ts";

export type DecisionStage =
  | "envelope-validation"
  | "operation-validation"
  | "op-log-append"
  | "transaction-creation"
  | "transaction-validation"
  | "backpressure-check"
  | "scheduler-admission"
  | "projection-policy"
  | "final-decision";

export type DecisionTraceStepStatus = "pass" | "fail" | "skip";
export type DecisionTraceStatus = "pending" | "accepted" | "rejected";

export interface DecisionTraceStep {
  stage: DecisionStage;
  status: DecisionTraceStepStatus;
  reason: string;
  error_code?: RuntimeErrorCode;
  metadata?: Record<string, unknown>;
}

export interface DecisionTrace {
  steps: readonly DecisionTraceStep[];
  final_status: DecisionTraceStatus;
  first_failed_stage?: DecisionStage;
  error_codes: readonly RuntimeErrorCode[];
  accepted: boolean;
}

export function createDecisionTrace(): DecisionTrace {
  return {
    steps: [],
    final_status: "pending",
    error_codes: [],
    accepted: false
  };
}

export function addTraceStep(trace: DecisionTrace, step: DecisionTraceStep): DecisionTrace {
  return summarizeDecisionTrace({
    ...trace,
    steps: [...trace.steps, { ...step }]
  });
}

export function markTraceFailure(
  trace: DecisionTrace,
  stage: DecisionStage,
  reason: string,
  error_code?: RuntimeErrorCode
): DecisionTrace {
  return addTraceStep(trace, {
    stage,
    status: "fail",
    reason,
    error_code
  });
}

export function markTracePass(trace: DecisionTrace, stage: DecisionStage, reason = "passed"): DecisionTrace {
  return addTraceStep(trace, {
    stage,
    status: "pass",
    reason
  });
}

export function summarizeDecisionTrace(trace: DecisionTrace): DecisionTrace {
  const firstFailure = trace.steps.find((step) => step.status === "fail");
  const finalDecision = [...trace.steps].reverse().find((step) => step.stage === "final-decision");
  const accepted = firstFailure == null && finalDecision?.status === "pass";
  const errorCodes = trace.steps
    .map((step) => step.error_code)
    .filter((errorCode): errorCode is RuntimeErrorCode => errorCode != null);

  return {
    ...trace,
    final_status: firstFailure != null ? "rejected" : accepted ? "accepted" : "pending",
    first_failed_stage: firstFailure?.stage,
    error_codes: errorCodes,
    accepted
  };
}
