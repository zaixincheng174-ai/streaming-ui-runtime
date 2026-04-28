import {
  canAdmitTransaction,
  type BackpressureLimits,
  type BackpressureSnapshot
} from "./backpressure-policy.ts";
import type { DecisionTrace } from "./decision-trace.ts";
import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";
import { validateOperation } from "./op-validation.ts";
import type { RuntimeOperation } from "./ops.ts";
import {
  shouldCommitProjection,
  type ProjectionBounds,
  type ProjectionResultShape
} from "./projection-policy.ts";
import { validateMessageEnvelope, type ValidationResult } from "./protocol.ts";
import type { PriorityLane } from "./priorities.ts";
import { shouldAdmitTransaction } from "./scheduler-policy.ts";
import type { Transaction } from "./transactions.ts";
import { validateTransaction } from "./transaction-validation.ts";

export type CoreDecisionType =
  | "accept"
  | "reject-envelope"
  | "reject-operation"
  | "reject-transaction"
  | "reject-backpressure"
  | "defer-transaction"
  | "preempt-transaction"
  | "reject-projection";

export interface CoreDecisionInput {
  message_envelope?: unknown;
  message_envelope_validation?: ValidationResult;
  operation?: Partial<RuntimeOperation> | Record<string, unknown> | null;
  transaction?: Partial<Transaction> | Record<string, unknown> | null;
  backpressure_snapshot?: BackpressureSnapshot;
  backpressure_limits?: BackpressureLimits;
  active_transaction_priority?: PriorityLane;
  current_session_version: number;
  projection_result?: Partial<ProjectionResultShape> | null;
  projection_bounds?: ProjectionBounds;
}

export interface CoreDecision {
  accepted: boolean;
  decision_type: CoreDecisionType;
  reasons: string[];
  error?: RuntimeErrorShape;
  errors: RuntimeErrorShape[];
  selected_priority?: PriorityLane;
  should_preempt?: boolean;
  should_commit_projection?: boolean;
  trace?: DecisionTrace;
}

export function decideCoreAdmission(input: CoreDecisionInput): CoreDecision {
  const envelopeValidation = input.message_envelope_validation ?? validateEnvelopeFromInput(input.message_envelope);
  if (!envelopeValidation.valid) {
    return reject("reject-envelope", envelopeValidation.errors);
  }

  const operationValidation = validateOperation(input.operation);
  if (!operationValidation.valid) {
    return reject("reject-operation", operationValidation.errors);
  }

  const transactionValidation = validateTransaction(input.transaction);
  if (!transactionValidation.valid) {
    return reject("reject-transaction", transactionValidation.errors);
  }

  const operation = input.operation as RuntimeOperation;
  const transaction = input.transaction as Transaction;
  const identityConsistency = validateIdentityConsistency(input, operation, transaction);
  if (identityConsistency != null) {
    return reject(identityConsistency.decision_type, [identityConsistency.error], {
      selected_priority: transaction.priority,
      should_preempt: false
    });
  }

  // Version monotonicity invariant: session and projection versions must only
  // advance through accepted transactions. Reject transactions that operate
  // against an outdated session view, and fail closed if the current session
  // version itself is not a valid non-negative finite integer.
  const currentSessionVersion = input.current_session_version;
  if (!isNonNegativeInteger(currentSessionVersion)) {
    return reject(
      "reject-transaction",
      [
        createRuntimeError("AdmissionRejected", {
          txn_id: transaction.txn_id,
          detail: `current_session_version=${String(currentSessionVersion)} is invalid`
        })
      ],
      {
        selected_priority: transaction.priority,
        should_preempt: false
      }
    );
  }
  if (transaction.session_version < currentSessionVersion) {
    return reject(
      "reject-transaction",
      [
        createRuntimeError("AdmissionRejected", {
          txn_id: transaction.txn_id,
          detail: `transaction.session_version=${transaction.session_version} is older than current_session_version=${currentSessionVersion}`
        })
      ],
      {
        selected_priority: transaction.priority,
        should_preempt: false
      }
    );
  }

  const backpressureSnapshot = input.backpressure_snapshot;
  const backpressureLimits = input.backpressure_limits;
  if (backpressureSnapshot == null || backpressureLimits == null) {
    return reject("reject-backpressure", [
      createRuntimeError("BackpressureLimitExceeded", {
        detail: "backpressure snapshot and limits are required"
      })
    ]);
  }

  const backpressureDecision = canAdmitTransaction(
    {
      priority: transaction.priority
    },
    backpressureSnapshot,
    backpressureLimits
  );
  if (!backpressureDecision.admit) {
    return reject("reject-backpressure", backpressureDecision.errors, {
      selected_priority: transaction.priority,
      should_preempt: false
    });
  }

  const active =
    input.active_transaction_priority == null
      ? null
      : {
          priority: input.active_transaction_priority,
          session_version: transaction.session_version
        };
  const schedulerDecision = shouldAdmitTransaction(transaction, active);
  if (schedulerDecision.decision === "defer") {
    return reject(
      "defer-transaction",
      [
        createRuntimeError("AdmissionRejected", {
          detail: schedulerDecision.reason
        })
      ],
      {
        selected_priority: transaction.priority,
        should_preempt: false
      }
    );
  }

  if (schedulerDecision.decision === "reject") {
    return reject(
      "reject-transaction",
      [
        createRuntimeError("MissingRequiredField", {
          detail: schedulerDecision.reason
        })
      ],
      {
        selected_priority: transaction.priority,
        should_preempt: false
      }
    );
  }

  let shouldCommit = undefined as boolean | undefined;
  if (input.projection_result != null) {
    if (input.projection_bounds == null) {
      return reject("reject-projection", [
        createRuntimeError("MissingRequiredField", {
          safe_fallback: "reject-projection",
          detail: "projection_bounds are required when projection_result is present"
        })
      ]);
    }

    const projectionDecision = shouldCommitProjection(
      input.projection_result,
      input.current_session_version,
      input.projection_bounds
    );
    shouldCommit = projectionDecision.commit;
    if (!projectionDecision.commit) {
      return reject("reject-projection", projectionDecision.errors, {
        selected_priority: transaction.priority,
        should_preempt: schedulerDecision.decision === "preempt",
        should_commit_projection: false
      });
    }
  }

  return {
    accepted: true,
    decision_type: schedulerDecision.decision === "preempt" ? "preempt-transaction" : "accept",
    reasons: [
      "envelope accepted",
      "operation accepted",
      "transaction accepted",
      backpressureDecision.reason,
      schedulerDecision.reason
    ],
    errors: [],
    selected_priority: transaction.priority,
    should_preempt: schedulerDecision.decision === "preempt",
    should_commit_projection: shouldCommit
  };
}

function validateEnvelopeFromInput(message: unknown): ValidationResult {
  if (message == null) {
    return {
      valid: false,
      errors: [
        createRuntimeError("MissingRequiredField", {
          detail: "message envelope or envelope validation result is required"
        })
      ]
    };
  }

  return validateMessageEnvelope(message);
}

type IdentityConsistencyFailure = {
  decision_type: "reject-operation" | "reject-transaction";
  error: RuntimeErrorShape;
};

function validateIdentityConsistency(
  input: CoreDecisionInput,
  operation: RuntimeOperation,
  transaction: Transaction
): IdentityConsistencyFailure | undefined {
  const envelopeLineage = extractEnvelopeLineage(input.message_envelope);
  const envelopeParentActionId = envelopeLineage.parent_action_id;
  const envelopeSessionVersion = extractEnvelopeSessionVersion(input.message_envelope);
  if (envelopeParentActionId != null && operation.parent_action_id !== envelopeParentActionId) {
    return {
      decision_type: "reject-operation",
      error: createRuntimeError("AdmissionRejected", {
        ...envelopeLineage,
        detail: `operation.parent_action_id=${operation.parent_action_id} does not match envelope.parent_action_id=${envelopeParentActionId}`
      })
    };
  }

  if (envelopeSessionVersion != null && operation.session_version !== envelopeSessionVersion) {
    return {
      decision_type: "reject-operation",
      error: createRuntimeError("AdmissionRejected", {
        ...envelopeLineage,
        detail: `operation.session_version=${operation.session_version} does not match envelope.session_version=${envelopeSessionVersion}`
      })
    };
  }

  if (transaction.parent_action_id !== operation.parent_action_id) {
    return {
      decision_type: "reject-transaction",
      error: createRuntimeError("AdmissionRejected", {
        ...envelopeLineage,
        txn_id: transaction.txn_id,
        parent_action_id: operation.parent_action_id,
        detail: `transaction.parent_action_id=${transaction.parent_action_id} does not match operation.parent_action_id=${operation.parent_action_id}`
      })
    };
  }

  if (transaction.session_version !== operation.session_version) {
    return {
      decision_type: "reject-transaction",
      error: createRuntimeError("AdmissionRejected", {
        ...envelopeLineage,
        txn_id: transaction.txn_id,
        parent_action_id: operation.parent_action_id,
        detail: `transaction.session_version=${transaction.session_version} does not match operation.session_version=${operation.session_version}`
      })
    };
  }

  if (!transaction.op_ids.includes(operation.op_id)) {
    return {
      decision_type: "reject-transaction",
      error: createRuntimeError("AdmissionRejected", {
        ...envelopeLineage,
        txn_id: transaction.txn_id,
        parent_action_id: operation.parent_action_id,
        detail: `transaction.op_ids does not include active operation op_id=${operation.op_id}`
      })
    };
  }

  return undefined;
}

function extractEnvelopeLineage(message: unknown): Pick<
  RuntimeErrorShape,
  "message_id" | "parent_action_id" | "trace_context"
> {
  if (!isRecord(message)) {
    return {};
  }

  return {
    ...(typeof message.message_id === "string" && message.message_id.length > 0
      ? { message_id: message.message_id }
      : {}),
    ...(typeof message.parent_action_id === "string" && message.parent_action_id.length > 0
      ? { parent_action_id: message.parent_action_id }
      : {}),
    ...(isRecord(message.trace_context) ? { trace_context: message.trace_context } : {})
  };
}

function extractEnvelopeSessionVersion(message: unknown): number | undefined {
  if (!isRecord(message) || typeof message.session_version !== "number") {
    return undefined;
  }

  return message.session_version;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function reject(
  decision_type: Exclude<CoreDecisionType, "accept" | "preempt-transaction">,
  errors: RuntimeErrorShape[],
  extra: Pick<CoreDecision, "selected_priority" | "should_preempt" | "should_commit_projection"> = {}
): CoreDecision {
  const normalizedErrors =
    errors.length > 0
      ? errors
      : [
          createRuntimeError("AdmissionRejected", {
            detail: "core decision rejected without explicit error"
          })
        ];

  return {
    accepted: false,
    decision_type,
    reasons: normalizedErrors.map((error) => error.detail ?? error.error_code),
    error: normalizedErrors[0],
    errors: normalizedErrors,
    ...extra
  };
}
