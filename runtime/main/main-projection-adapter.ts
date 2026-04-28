import type { RuntimeErrorShape } from "../core/errors.ts";
import { validateMessagePayloadForTransfer } from "../core/message-serialization.ts";
import type { ProjectionBounds, ProjectionResultShape } from "../core/projection-policy.ts";
import { shouldCommitProjection } from "../core/projection-policy.ts";
import { createRecoveryPolicyDecision, type RecoveryPolicyDecision } from "../core/recovery-policy.ts";

export interface MainProjectionAdapterInput {
  projection_result: Partial<ProjectionResultShape> | null | undefined;
  current_session_version: number;
  projection_bounds: ProjectionBounds;
  trace_context?: unknown;
}

export interface MainProjectionAdapterMetrics {
  projection_evaluated: boolean;
  should_commit_projection: boolean;
  rejected_reason?: string;
  error_code?: RuntimeErrorShape["error_code"];
}

export type MainProjectionAdapterDecision =
  | {
      should_commit: true;
      reason: string;
      projection_result: ProjectionResultShape;
      errors: [];
      recovery_decision?: undefined;
      metrics: MainProjectionAdapterMetrics;
    }
  | {
      should_commit: false;
      reason: string;
      errors: RuntimeErrorShape[];
      error: RuntimeErrorShape;
      recovery_decision: RecoveryPolicyDecision;
      metrics: MainProjectionAdapterMetrics;
    };

export const MAIN_PROJECTION_SERIALIZATION_OPTIONS = {
  max_depth: 12,
  max_array_length: 4096,
  max_object_keys: 512,
  max_string_bytes: 64 * 1024,
  max_total_bytes: 256 * 1024
} as const;

export function evaluateMainProjection(input: MainProjectionAdapterInput): MainProjectionAdapterDecision {
  const serializationValidation = validateMessagePayloadForTransfer(
    input.projection_result,
    MAIN_PROJECTION_SERIALIZATION_OPTIONS
  );
  if (!serializationValidation.valid) {
    return createRejectedProjectionDecision(
      "projection serialization validation failed",
      serializationValidation.errors,
      input.trace_context,
      false
    );
  }

  const decision = shouldCommitProjection(
    input.projection_result,
    input.current_session_version,
    input.projection_bounds
  );

  if (decision.commit) {
    return {
      should_commit: true,
      reason: decision.reason,
      projection_result: decision.result,
      errors: [],
      metrics: {
        projection_evaluated: true,
        should_commit_projection: true
      }
    };
  }

  return createRejectedProjectionDecision(decision.reason, decision.errors, input.trace_context, true);
}

function createRejectedProjectionDecision(
  reason: string,
  errors: readonly RuntimeErrorShape[],
  traceContext: unknown,
  projectionEvaluated: boolean
): MainProjectionAdapterDecision {
  const normalizedErrors = normalizeProjectionErrors(errors, traceContext);
  const error = normalizedErrors[0];

  return {
    should_commit: false,
    reason,
    errors: normalizedErrors,
    error,
    recovery_decision: createRecoveryPolicyDecision({ error, context: "projection" }),
    metrics: {
      projection_evaluated: projectionEvaluated,
      should_commit_projection: false,
      rejected_reason: reason,
      error_code: error.error_code
    }
  };
}

function normalizeProjectionErrors(errors: readonly RuntimeErrorShape[], traceContext: unknown): RuntimeErrorShape[] {
  return errors.map((error) => ({
    ...error,
    safe_fallback: "reject-projection",
    trace_context: error.trace_context ?? traceContext
  }));
}
