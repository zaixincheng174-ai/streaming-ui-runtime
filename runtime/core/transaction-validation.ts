import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";
import type { VisibleRange } from "./ops.ts";
import { isPriorityLane } from "./priorities.ts";
import type {
  CancellationPolicy,
  DirtyRange,
  ProjectionContract,
  StalePolicy,
  Transaction,
  TransactionType
} from "./transactions.ts";

export type TransactionValidationErrorReason =
  | "missing-required-field"
  | "invalid-checksum"
  | "invalid-priority"
  | "invalid-transaction-type"
  | "invalid-session-version"
  | "invalid-range"
  | "invalid-work-units";

export type TransactionValidationResult =
  | { valid: true; errors: []; reasons: [] }
  | { valid: false; errors: RuntimeErrorShape[]; reasons: TransactionValidationErrorReason[] };

export function validateTransaction(
  txn: Partial<Transaction> | Record<string, unknown> | null | undefined
): TransactionValidationResult {
  if (!isRecord(txn)) {
    return invalid("transaction must be an object", "missing-required-field");
  }

  const errors = new TransactionValidationCollector();

  errors.requireNonEmptyString(txn.txn_id, "txn_id");
  errors.requireNonEmptyString(txn.parent_action_id, "parent_action_id");
  if (!Array.isArray(txn.op_ids) || txn.op_ids.length === 0 || !txn.op_ids.every(isNonEmptyString)) {
    errors.add("op_ids must be a non-empty string array", "missing-required-field");
  }
  if (!isTransactionType(txn.transaction_type)) {
    errors.add("transaction_type is missing or invalid", "invalid-transaction-type");
  }
  if (!isPriorityLane(txn.priority)) {
    errors.add("priority is missing or invalid", "invalid-priority");
  }
  errors.requireNonNegativeFiniteNumber(txn.deadline_ms, "deadline_ms", "missing-required-field");
  errors.requireNonNegativeFiniteNumber(txn.budget_ms, "budget_ms", "missing-required-field");
  errors.requireNonNegativeInteger(txn.session_version, "session_version", "invalid-session-version");
  errors.requireVisibleRange(txn.visible_range, "visible_range");
  errors.requireDirtyRanges(txn.dirty_ranges);
  errors.requireNonNegativeInteger(txn.required_work_units, "required_work_units", "invalid-work-units");
  if (!isCancellationPolicy(txn.cancellation_policy)) {
    errors.add("cancellation_policy is missing or invalid", "missing-required-field");
  }
  if (!isStalePolicy(txn.stale_policy)) {
    errors.add("stale_policy is missing or invalid", "missing-required-field");
  }
  errors.requireNonNegativeInteger(txn.result_version, "result_version", "missing-required-field");
  errors.requireChecksum(txn.checksum, "checksum");
  errors.requireProjectionContract(txn.projection_contract);
  errors.requireTraceContext(txn.trace_context);

  return errors.result(isRecord(txn.trace_context) ? txn.trace_context : undefined);
}

class TransactionValidationCollector {
  private readonly errors: RuntimeErrorShape[] = [];
  private readonly reasons: TransactionValidationErrorReason[] = [];

  add(
    detail: string,
    reason: TransactionValidationErrorReason,
    errorCode: "MissingRequiredField" | "InvalidChecksum" = "MissingRequiredField"
  ): void {
    this.errors.push(
      createRuntimeError(errorCode, {
        detail
      })
    );
    this.reasons.push(reason);
  }

  requireNonEmptyString(value: unknown, fieldName: string): void {
    if (!isNonEmptyString(value)) {
      this.add(`${fieldName} is required`, "missing-required-field");
    }
  }

  requireNonNegativeFiniteNumber(value: unknown, fieldName: string, reason: TransactionValidationErrorReason): void {
    if (!isNonNegativeFiniteNumber(value)) {
      this.add(`${fieldName} must be a finite non-negative number`, reason);
    }
  }

  requireNonNegativeInteger(value: unknown, fieldName: string, reason: TransactionValidationErrorReason): void {
    if (!isNonNegativeInteger(value)) {
      this.add(`${fieldName} must be a finite non-negative integer`, reason);
    }
  }

  requireChecksum(value: unknown, fieldName: string): void {
    if (!isChecksumValue(value)) {
      this.add(`${fieldName} is missing or invalid`, "invalid-checksum", "InvalidChecksum");
    }
  }

  requireVisibleRange(value: unknown, fieldName: string): void {
    if (!isVisibleRange(value)) {
      this.add(`${fieldName} is missing or invalid`, "invalid-range");
    }
  }

  requireDirtyRanges(value: unknown): void {
    if (!Array.isArray(value)) {
      this.add("dirty_ranges must be an array", "missing-required-field");
      return;
    }

    for (const dirtyRange of value) {
      if (!isDirtyRange(dirtyRange)) {
        this.add("dirty_ranges contains an invalid range", "invalid-range");
        return;
      }
    }
  }

  requireProjectionContract(value: unknown): void {
    if (!isRecord(value)) {
      this.add("projection_contract is required", "missing-required-field");
      return;
    }

    const contract = value as Partial<ProjectionContract>;
    this.requireNonNegativeInteger(contract.max_result_bytes, "projection_contract.max_result_bytes", "invalid-range");
    this.requireVisibleRange(contract.required_visible_range, "projection_contract.required_visible_range");
    if (typeof contract.require_projection_checksum !== "boolean") {
      this.add("projection_contract.require_projection_checksum must be boolean", "missing-required-field");
    }
    if (typeof contract.require_version_check !== "boolean") {
      this.add("projection_contract.require_version_check must be boolean", "missing-required-field");
    }
  }

  requireTraceContext(value: unknown): void {
    if (!isRecord(value)) {
      this.add("trace_context is missing or invalid", "missing-required-field");
    }
  }

  result(traceContext?: Record<string, unknown>): TransactionValidationResult {
    if (this.errors.length === 0) {
      return { valid: true, errors: [], reasons: [] };
    }

    const errors =
      traceContext == null
        ? this.errors
        : this.errors.map((error) => ({
            ...error,
            trace_context: error.trace_context ?? traceContext
          }));

    return { valid: false, errors, reasons: this.reasons };
  }
}

function invalid(detail: string, reason: TransactionValidationErrorReason): TransactionValidationResult {
  return {
    valid: false,
    errors: [
      createRuntimeError("MissingRequiredField", {
        detail
      })
    ],
    reasons: [reason]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isChecksumValue(value: unknown): value is string | number {
  return (typeof value === "string" && value.length > 0) || (typeof value === "number" && Number.isFinite(value));
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isVisibleRange(value: unknown): value is VisibleRange {
  return (
    isRecord(value) &&
    isNonEmptyString(value.start_block_id) &&
    isNonEmptyString(value.end_block_id) &&
    (value.anchor_block_id == null || isNonEmptyString(value.anchor_block_id))
  );
}

function isDirtyRange(value: unknown): value is DirtyRange {
  return (
    isRecord(value) &&
    isNonEmptyString(value.block_id) &&
    isNonNegativeInteger(value.start_offset) &&
    isNonNegativeInteger(value.end_offset) &&
    value.end_offset >= value.start_offset
  );
}

function isTransactionType(value: unknown): value is TransactionType {
  return (
    value === "urgent-input" ||
    value === "visible-projection" ||
    value === "stream-update" ||
    value === "background-indexing" ||
    value === "hydration-reconstruction" ||
    value === "cleanup-compaction"
  );
}

function isCancellationPolicy(value: unknown): value is CancellationPolicy {
  return value === "none" || value === "best-effort" || value === "required-before-visible-commit";
}

function isStalePolicy(value: unknown): value is StalePolicy {
  return value === "reject" || value === "compatible-if-versioned";
}
