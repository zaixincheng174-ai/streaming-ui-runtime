import type { RuntimeErrorShape } from "../core/errors.ts";
import type { ProjectionBounds } from "../core/projection-policy.ts";
import type { WorkerAdapterContext } from "../worker/worker-context.ts";
import type { WorkerAdapterInput } from "../worker/worker-message-handler.ts";
import {
  runInMemoryWorkerMainRoundtrip,
  type InMemoryRoundtripResult,
  type ProjectionFactory
} from "./in-memory-roundtrip.ts";

export interface InMemorySessionScenarioStep {
  step_id: string;
  worker_input: WorkerAdapterInput;
  projection_factory?: ProjectionFactory;
  current_session_version?: number;
  projection_bounds?: ProjectionBounds;
  trace_context?: unknown;
}

export interface InMemorySessionScenarioInput {
  initial_worker_context: WorkerAdapterContext;
  steps: readonly InMemorySessionScenarioStep[];
  projection_bounds: ProjectionBounds;
  current_session_version: number;
  stop_on_reject?: boolean;
}

export interface InMemorySessionScenarioStepResult {
  step_id: string;
  roundtrip_result: InMemoryRoundtripResult;
  worker_accepted: boolean;
  main_evaluated: boolean;
  main_should_commit?: boolean;
  rejected: boolean;
  error_codes: RuntimeErrorShape["error_code"][];
}

export interface InMemorySessionScenarioSummary {
  step_count: number;
  accepted_worker_count: number;
  rejected_worker_count: number;
  main_commit_allowed_count: number;
  main_commit_rejected_count: number;
  first_failed_step_id?: string;
  error_codes: RuntimeErrorShape["error_code"][];
  final_op_log_count: number;
}

export interface InMemorySessionScenarioResult {
  final_worker_context: WorkerAdapterContext;
  step_results: InMemorySessionScenarioStepResult[];
  summary: InMemorySessionScenarioSummary;
}

export function runInMemorySessionScenario(
  input: InMemorySessionScenarioInput
): InMemorySessionScenarioResult {
  const stopOnReject = input.stop_on_reject === true;
  let currentContext = input.initial_worker_context;
  const stepResults: InMemorySessionScenarioStepResult[] = [];

  for (const step of input.steps) {
    const roundtripResult = runInMemoryWorkerMainRoundtrip({
      worker_context: currentContext,
      worker_input: step.worker_input,
      projection_factory: step.projection_factory,
      current_session_version: step.current_session_version ?? input.current_session_version,
      projection_bounds: step.projection_bounds ?? input.projection_bounds,
      trace_context: step.trace_context
    });
    const stepResult = summarizeStepResult(step.step_id, roundtripResult);

    stepResults.push(stepResult);
    currentContext = roundtripResult.next_context;

    if (stopOnReject && stepResult.rejected) {
      break;
    }
  }

  return {
    final_worker_context: currentContext,
    step_results: stepResults,
    summary: summarizeScenario(stepResults, currentContext)
  };
}

function summarizeStepResult(
  stepId: string,
  roundtripResult: InMemoryRoundtripResult
): InMemorySessionScenarioStepResult {
  const workerAccepted = roundtripResult.worker_output.accepted;
  const mainEvaluated = roundtripResult.main_decision != null;
  const mainShouldCommit = roundtripResult.main_decision?.should_commit;
  const rejected = !workerAccepted || mainShouldCommit === false;
  const errorCodes = collectStepErrorCodes(roundtripResult);

  return {
    step_id: stepId,
    roundtrip_result: roundtripResult,
    worker_accepted: workerAccepted,
    main_evaluated: mainEvaluated,
    main_should_commit: mainShouldCommit,
    rejected,
    error_codes: errorCodes
  };
}

function summarizeScenario(
  stepResults: readonly InMemorySessionScenarioStepResult[],
  finalWorkerContext: WorkerAdapterContext
): InMemorySessionScenarioSummary {
  const errorCodes = stepResults.flatMap((step) => step.error_codes);
  const firstFailedStep = stepResults.find((step) => step.rejected);

  return {
    step_count: stepResults.length,
    accepted_worker_count: stepResults.filter((step) => step.worker_accepted).length,
    rejected_worker_count: stepResults.filter((step) => !step.worker_accepted).length,
    main_commit_allowed_count: stepResults.filter((step) => step.main_should_commit === true).length,
    main_commit_rejected_count: stepResults.filter((step) => step.main_should_commit === false).length,
    first_failed_step_id: firstFailedStep?.step_id,
    error_codes: errorCodes,
    final_op_log_count: finalWorkerContext.core_context.op_log.operations.length
  };
}

function collectStepErrorCodes(roundtripResult: InMemoryRoundtripResult): RuntimeErrorShape["error_code"][] {
  const workerErrorCodes = roundtripResult.worker_output.core_decision.errors.map((error) => error.error_code);
  const mainErrorCodes = roundtripResult.main_decision?.errors.map((error) => error.error_code) ?? [];
  return [...workerErrorCodes, ...mainErrorCodes];
}
