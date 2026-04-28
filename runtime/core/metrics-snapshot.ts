import type { CoreDecision } from "./core-decision.ts";
import type { CoreRuntimeContext } from "./core-engine.ts";
import type { DecisionTrace } from "./decision-trace.ts";
import type { RuntimeErrorCode } from "./errors.ts";
import type { PriorityLane } from "./priorities.ts";

export interface OpLogMetrics {
  op_log_count: number;
}

export interface ProjectionDecisionMetrics {
  projection_evaluated: boolean;
  should_commit_projection?: boolean;
}

export interface BackpressureDecisionMetrics {
  backpressure_rejected: boolean;
}

export interface CoreDecisionMetrics extends ProjectionDecisionMetrics, BackpressureDecisionMetrics {
  last_decision_type?: CoreDecision["decision_type"];
  last_decision_accepted?: boolean;
  first_failed_stage?: DecisionTrace["first_failed_stage"];
  error_codes: readonly RuntimeErrorCode[];
  selected_priority?: PriorityLane;
  should_preempt?: boolean;
  trace_step_count: number;
}

export interface CoreMetricsSnapshot extends CoreDecisionMetrics, OpLogMetrics {
  session_version: number;
  accepted_count: number;
  rejected_count: number;
}

export function createCoreMetricsSnapshot(
  context: CoreRuntimeContext,
  decision?: CoreDecision
): CoreMetricsSnapshot {
  return {
    session_version: context.current_session_version,
    op_log_count: context.op_log.operations.length,
    accepted_count: decision?.accepted === true ? 1 : 0,
    rejected_count: decision?.accepted === false ? 1 : 0,
    ...summarizeDecisionMetrics(decision)
  };
}

export function summarizeDecisionMetrics(decision?: CoreDecision): CoreDecisionMetrics {
  const trace = decision?.trace;
  const errorCodes =
    trace?.error_codes ??
    decision?.errors.map((error) => error.error_code) ??
    [];
  const projectionEvaluated = trace?.steps.some((step) => step.stage === "projection-policy") ?? false;
  const backpressureRejected =
    decision?.decision_type === "reject-backpressure" ||
    trace?.first_failed_stage === "backpressure-check";

  return {
    last_decision_type: decision?.decision_type,
    last_decision_accepted: decision?.accepted,
    first_failed_stage: trace?.first_failed_stage,
    error_codes: [...errorCodes],
    selected_priority: decision?.selected_priority,
    should_preempt: decision?.should_preempt,
    should_commit_projection: decision?.should_commit_projection,
    backpressure_rejected: backpressureRejected,
    projection_evaluated: projectionEvaluated,
    trace_step_count: trace?.steps.length ?? 0
  };
}

export function mergeCoreMetricsSnapshot(
  previous: CoreMetricsSnapshot,
  nextDecision: CoreDecision
): CoreMetricsSnapshot {
  const nextDecisionMetrics = summarizeDecisionMetrics(nextDecision);

  return {
    ...previous,
    ...nextDecisionMetrics,
    accepted_count: previous.accepted_count + (nextDecision.accepted ? 1 : 0),
    rejected_count: previous.rejected_count + (nextDecision.accepted ? 0 : 1)
  };
}
