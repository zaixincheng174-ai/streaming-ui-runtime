import type { CoreDecision } from "../core/core-decision.ts";
import {
  createInitialCoreContext,
  type CoreEngineResult,
  type CoreRuntimeContext
} from "../core/core-engine.ts";
import type { CoreDecisionMetrics, CoreMetricsSnapshot } from "../core/metrics-snapshot.ts";
import { summarizeDecisionMetrics } from "../core/metrics-snapshot.ts";
import type { RecoveryPolicyDecision } from "../core/recovery-policy.ts";

export interface WorkerAdapterMetrics {
  processed_message_count: number;
  accepted_message_count: number;
  rejected_message_count: number;
}

export interface WorkerAdapterContext extends WorkerAdapterMetrics {
  core_context: CoreRuntimeContext;
  last_decision_summary?: CoreDecisionMetrics;
  last_recovery_decision?: RecoveryPolicyDecision;
  metrics_snapshot?: CoreMetricsSnapshot;
}

export function createInitialWorkerAdapterContext(
  core_context: CoreRuntimeContext = createInitialCoreContext()
): WorkerAdapterContext {
  return {
    core_context,
    processed_message_count: 0,
    accepted_message_count: 0,
    rejected_message_count: 0
  };
}

export function updateWorkerAdapterContext(
  context: WorkerAdapterContext,
  coreResult: CoreEngineResult,
  recoveryDecision?: RecoveryPolicyDecision
): WorkerAdapterContext {
  return {
    ...context,
    core_context: coreResult.context,
    last_decision_summary: summarizeWorkerDecision(coreResult.decision),
    last_recovery_decision: recoveryDecision,
    metrics_snapshot: coreResult.metrics_snapshot,
    processed_message_count: context.processed_message_count + 1,
    accepted_message_count: context.accepted_message_count + (coreResult.accepted ? 1 : 0),
    rejected_message_count: context.rejected_message_count + (coreResult.accepted ? 0 : 1)
  };
}

function summarizeWorkerDecision(decision: CoreDecision): CoreDecisionMetrics {
  return summarizeDecisionMetrics(decision);
}
