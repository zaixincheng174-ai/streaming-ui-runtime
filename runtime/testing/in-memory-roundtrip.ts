import type { ProjectionBounds, ProjectionResultShape } from "../core/projection-policy.ts";
import {
  evaluateMainProjection,
  type MainProjectionAdapterDecision
} from "../main/main-projection-adapter.ts";
import type { WorkerAdapterContext } from "../worker/worker-context.ts";
import {
  handleWorkerAdapterMessage,
  type WorkerAdapterInput,
  type WorkerAdapterOutput
} from "../worker/worker-message-handler.ts";

export type ProjectionFactory = (
  workerOutput: WorkerAdapterOutput,
  nextContext: WorkerAdapterContext
) => Partial<ProjectionResultShape> | null | undefined;

export interface InMemoryRoundtripInput {
  worker_context: WorkerAdapterContext;
  worker_input: WorkerAdapterInput;
  projection_factory?: ProjectionFactory;
  current_session_version: number;
  projection_bounds: ProjectionBounds;
  trace_context?: unknown;
}

export interface InMemoryRoundtripSummary {
  worker_accepted: boolean;
  main_evaluated: boolean;
  main_should_commit?: boolean;
  accepted: boolean;
}

export interface InMemoryRoundtripResult {
  worker_output: WorkerAdapterOutput;
  main_decision: MainProjectionAdapterDecision | null;
  next_context: WorkerAdapterContext;
  projection_result?: Partial<ProjectionResultShape> | null;
  summary: InMemoryRoundtripSummary;
}

export function runInMemoryWorkerMainRoundtrip(input: InMemoryRoundtripInput): InMemoryRoundtripResult {
  const workerOutput = handleWorkerAdapterMessage(input.worker_context, input.worker_input);

  if (!workerOutput.accepted) {
    return {
      worker_output: workerOutput,
      main_decision: null,
      next_context: workerOutput.next_context,
      summary: {
        worker_accepted: false,
        main_evaluated: false,
        accepted: false
      }
    };
  }

  if (input.projection_factory == null) {
    return {
      worker_output: workerOutput,
      main_decision: null,
      next_context: workerOutput.next_context,
      summary: {
        worker_accepted: true,
        main_evaluated: false,
        accepted: true
      }
    };
  }

  const projectionResult = input.projection_factory(workerOutput, workerOutput.next_context);
  const mainDecision = evaluateMainProjection({
    projection_result: projectionResult,
    current_session_version: input.current_session_version,
    projection_bounds: input.projection_bounds,
    trace_context: input.trace_context
  });

  return {
    worker_output: workerOutput,
    main_decision: mainDecision,
    next_context: workerOutput.next_context,
    projection_result: projectionResult,
    summary: {
      worker_accepted: true,
      main_evaluated: true,
      main_should_commit: mainDecision.should_commit,
      accepted: mainDecision.should_commit
    }
  };
}
