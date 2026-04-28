import type { RuntimeErrorCode, RuntimeErrorShape } from "./errors.ts";

export type RecoveryAction =
  | "reject-message"
  | "reject-projection"
  | "request-fresh-projection"
  | "cancel-transaction"
  | "throttle-background"
  | "reinitialize-worker"
  | "enter-safe-mode"
  | "surface-error"
  | "quarantine-result"
  | "idempotent-ack";

export type RecoverySeverity = "info" | "warning" | "recoverable" | "fatal";

export interface RecoveryPolicyInput {
  error: RuntimeErrorShape | RuntimeErrorCode;
  context?: "message" | "projection" | "transaction" | "worker" | "backpressure" | "result";
}

export interface RecoveryPolicyDecision {
  error_code: RuntimeErrorCode;
  message_id?: string;
  parent_action_id?: string;
  txn_id?: string;
  trace_context?: unknown;
  severity: RecoverySeverity;
  action: RecoveryAction;
  retry: boolean;
  quarantine_result: boolean;
  safe_fallback: RecoveryAction;
}

export function classifyRuntimeError(error: RuntimeErrorShape | RuntimeErrorCode): RecoverySeverity {
  switch (toErrorCode(error)) {
    case "ProtocolVersionUnsupported":
      return "fatal";
    case "WorkerCrashed":
    case "WorkerTimeout":
      return "recoverable";
    case "MissingRequiredField":
    case "InvalidChecksum":
    case "StaleProjectionRejected":
    case "ProjectionTooLarge":
    case "BackpressureLimitExceeded":
    case "AdmissionRejected":
    case "EquivalenceMismatch":
    case "UnknownMessageType":
    case "DuplicateOperationId":
      return "warning";
    case "TransactionCanceled":
    case "DuplicateMessageId":
      return "info";
  }
}

export function getRecoveryAction(input: RuntimeErrorShape | RuntimeErrorCode | RecoveryPolicyInput): RecoveryAction {
  const error = unwrapError(input);
  const context = typeof input === "object" && "error" in input ? input.context : undefined;

  switch (toErrorCode(error)) {
    case "ProtocolVersionUnsupported":
      return "reject-message";
    case "MissingRequiredField":
      return "reject-message";
    case "InvalidChecksum":
      return context === "projection" || context === "result" ? "reject-projection" : "reject-message";
    case "StaleProjectionRejected":
      return "request-fresh-projection";
    case "WorkerCrashed":
      return "reinitialize-worker";
    case "WorkerTimeout":
      return context === "worker" ? "reinitialize-worker" : "cancel-transaction";
    case "TransactionCanceled":
      return "cancel-transaction";
    case "ProjectionTooLarge":
      return context === "projection" ? "request-fresh-projection" : "reject-projection";
    case "BackpressureLimitExceeded":
      return "throttle-background";
    case "AdmissionRejected":
    case "DuplicateOperationId":
      return "reject-message";
    case "EquivalenceMismatch":
      return "quarantine-result";
    case "UnknownMessageType":
      return "reject-message";
    case "DuplicateMessageId":
      return "idempotent-ack";
  }
}

export function shouldRetry(input: RuntimeErrorShape | RuntimeErrorCode | RecoveryPolicyInput): boolean {
  const error = unwrapError(input);
  const context = typeof input === "object" && "error" in input ? input.context : undefined;

  switch (toErrorCode(error)) {
    case "StaleProjectionRejected":
    case "ProjectionTooLarge":
    case "BackpressureLimitExceeded":
    case "WorkerCrashed":
      return true;
    case "WorkerTimeout":
      return context === "worker";
    case "ProtocolVersionUnsupported":
    case "MissingRequiredField":
    case "InvalidChecksum":
    case "TransactionCanceled":
    case "AdmissionRejected":
    case "DuplicateOperationId":
    case "EquivalenceMismatch":
    case "UnknownMessageType":
    case "DuplicateMessageId":
      return false;
  }
}

export function shouldQuarantineResult(input: RuntimeErrorShape | RuntimeErrorCode | RecoveryPolicyInput): boolean {
  const error = unwrapError(input);

  switch (toErrorCode(error)) {
    case "EquivalenceMismatch":
      return true;
    case "InvalidChecksum":
      return typeof input === "object" && "error" in input && input.context === "result";
    case "ProtocolVersionUnsupported":
    case "MissingRequiredField":
    case "StaleProjectionRejected":
    case "WorkerCrashed":
    case "WorkerTimeout":
    case "TransactionCanceled":
    case "ProjectionTooLarge":
    case "BackpressureLimitExceeded":
    case "AdmissionRejected":
    case "UnknownMessageType":
    case "DuplicateOperationId":
    case "DuplicateMessageId":
      return false;
  }
}

export function createRecoveryPolicyDecision(
  input: RuntimeErrorShape | RuntimeErrorCode | RecoveryPolicyInput
): RecoveryPolicyDecision {
  const error = unwrapError(input);
  const errorCode = toErrorCode(error);
  const action = getRecoveryAction(input);

  return {
    error_code: errorCode,
    ...getRecoveryLineage(error),
    severity: classifyRuntimeError(error),
    action,
    retry: shouldRetry(input),
    quarantine_result: shouldQuarantineResult(input),
    safe_fallback: action
  };
}

function unwrapError(input: RuntimeErrorShape | RuntimeErrorCode | RecoveryPolicyInput): RuntimeErrorShape | RuntimeErrorCode {
  return typeof input === "object" && "error" in input ? input.error : input;
}

function toErrorCode(error: RuntimeErrorShape | RuntimeErrorCode): RuntimeErrorCode {
  return typeof error === "string" ? error : error.error_code;
}

function getRecoveryLineage(error: RuntimeErrorShape | RuntimeErrorCode): Pick<
  RecoveryPolicyDecision,
  "message_id" | "parent_action_id" | "txn_id" | "trace_context"
> {
  if (typeof error === "string") {
    return {};
  }

  return {
    message_id: error.message_id,
    parent_action_id: error.parent_action_id,
    txn_id: error.txn_id,
    trace_context: error.trace_context
  };
}
