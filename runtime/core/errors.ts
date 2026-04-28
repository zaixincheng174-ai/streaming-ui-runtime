export const RUNTIME_ERROR_CODES = [
  "ProtocolVersionUnsupported",
  "MissingRequiredField",
  "InvalidChecksum",
  "StaleProjectionRejected",
  "WorkerCrashed",
  "WorkerTimeout",
  "TransactionCanceled",
  "ProjectionTooLarge",
  "BackpressureLimitExceeded",
  "AdmissionRejected",
  "EquivalenceMismatch",
  "UnknownMessageType",
  "DuplicateMessageId",
  "DuplicateOperationId"
] as const;

export type RuntimeErrorCode = (typeof RUNTIME_ERROR_CODES)[number];

export type RuntimeRecoverability = "recoverable" | "retryable" | "fatal";

export type RuntimeSafeFallback =
  | "reject-message"
  | "reject-projection"
  | "cancel-transaction"
  | "surface-error"
  | "shutdown-runtime";

export interface RuntimeErrorShape {
  error_code: RuntimeErrorCode;
  message_id?: string;
  txn_id?: string;
  parent_action_id?: string;
  recoverability: RuntimeRecoverability;
  safe_fallback: RuntimeSafeFallback;
  trace_context?: unknown;
  detail?: string;
}

export function createRuntimeError(
  error_code: RuntimeErrorCode,
  options: Omit<Partial<RuntimeErrorShape>, "error_code"> = {}
): RuntimeErrorShape {
  return {
    error_code,
    recoverability: options.recoverability ?? "recoverable",
    safe_fallback: options.safe_fallback ?? "reject-message",
    ...options
  };
}
