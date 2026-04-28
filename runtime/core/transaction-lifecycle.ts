import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";
import { validateOperation } from "./op-validation.ts";
import type { AddMessage, RuntimeOperation, VisibleRange } from "./ops.ts";
import type { TraceContext } from "./protocol.ts";
import type {
  DirtyRange,
  ProjectionContract,
  Transaction,
  TransactionStatus,
  TransactionType
} from "./transactions.ts";
import { validateTransaction } from "./transaction-validation.ts";

export interface CreateTransactionFromOperationOptions {
  txn_id?: string;
  transaction_type?: TransactionType;
  deadline_ms?: number;
  budget_ms?: number;
  visible_range?: VisibleRange;
  dirty_ranges?: readonly DirtyRange[];
  required_work_units?: number;
  result_version?: number;
  projection_contract?: ProjectionContract;
  trace_context?: TraceContext;
}

export interface TransactionLifecycleRecord {
  transaction: Transaction;
  status: TransactionStatus;
  reason?: string;
  result_version: number;
}

export type TransactionLifecycleResult =
  | { ok: true; record: TransactionLifecycleRecord; errors: [] }
  | { ok: false; record?: TransactionLifecycleRecord; errors: RuntimeErrorShape[] };

export type TransactionTransitionValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: RuntimeErrorShape[] };

export function createTransactionFromOperation(
  op: Partial<RuntimeOperation> | Record<string, unknown>,
  options: CreateTransactionFromOperationOptions = {}
): TransactionLifecycleResult {
  const opValidation = validateOperation(op);
  if (!opValidation.valid) {
    return {
      ok: false,
      errors: opValidation.errors
    };
  }

  const operation = op as RuntimeOperation;
  if (operation.parent_action_id == null || operation.parent_action_id === "") {
    return {
      ok: false,
      errors: [
        createRuntimeError("MissingRequiredField", {
          detail: "parent_action_id is required to create transaction"
        })
      ]
    };
  }

  const visibleRange = options.visible_range ?? deriveVisibleRange(operation);
  if (visibleRange == null) {
    return {
      ok: false,
      errors: [
        createRuntimeError("MissingRequiredField", {
          detail: "visible_range could not be derived"
        })
      ]
    };
  }

  const transactionType = options.transaction_type ?? deriveTransactionType(operation);
  const transaction: Transaction = {
    txn_id: options.txn_id ?? `txn:${operation.op_id}`,
    parent_action_id: operation.parent_action_id,
    op_ids: [operation.op_id],
    transaction_type: transactionType,
    priority: operation.priority ?? derivePriority(transactionType),
    deadline_ms: options.deadline_ms ?? 16,
    budget_ms: options.budget_ms ?? 4,
    session_version: operation.session_version,
    visible_range: visibleRange,
    dirty_ranges: options.dirty_ranges ?? deriveDirtyRanges(operation),
    required_work_units: options.required_work_units ?? 1,
    cancellation_policy: "best-effort",
    stale_policy: "reject",
    result_version: options.result_version ?? operation.session_version,
    checksum: operation.checksum,
    trace_context: options.trace_context ?? {},
    projection_contract:
      options.projection_contract ??
      {
        max_result_bytes: 4096,
        required_visible_range: visibleRange,
        require_projection_checksum: true,
        require_version_check: true
      }
  };

  const transactionValidation = validateTransaction(transaction);
  if (!transactionValidation.valid) {
    return {
      ok: false,
      errors: transactionValidation.errors
    };
  }

  return {
    ok: true,
    record: {
      transaction,
      status: "queued",
      result_version: transaction.result_version
    },
    errors: []
  };
}

export function validateTransactionLifecycleTransition(
  currentStatus: TransactionStatus,
  nextStatus: TransactionStatus
): TransactionTransitionValidationResult {
  const allowed = allowedNextStatuses(currentStatus);
  if (allowed.includes(nextStatus)) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: [
      createRuntimeError("TransactionCanceled", {
        detail: `invalid transaction transition ${currentStatus}->${nextStatus}`
      })
    ]
  };
}

export function markTransactionAccepted(txn: Transaction | TransactionLifecycleRecord): TransactionLifecycleResult {
  return markTransaction(txn, "running", "accepted");
}

export function markTransactionRejected(
  txn: Transaction | TransactionLifecycleRecord,
  reason: string
): TransactionLifecycleResult {
  return markTransaction(txn, "rejected", reason);
}

export function markTransactionCompleted(
  txn: Transaction | TransactionLifecycleRecord,
  resultVersion: number
): TransactionLifecycleResult {
  if (!Number.isInteger(resultVersion) || resultVersion < 0) {
    return {
      ok: false,
      record: toRecord(txn),
      errors: [
        createRuntimeError("MissingRequiredField", {
          detail: "resultVersion must be a finite non-negative integer"
        })
      ]
    };
  }

  return markTransaction(txn, "completed", "completed", resultVersion);
}

export function markTransactionCanceled(
  txn: Transaction | TransactionLifecycleRecord,
  reason: string
): TransactionLifecycleResult {
  return markTransaction(txn, "canceled", reason);
}

function markTransaction(
  txn: Transaction | TransactionLifecycleRecord,
  nextStatus: TransactionStatus,
  reason: string,
  resultVersion?: number
): TransactionLifecycleResult {
  const record = toRecord(txn);
  const transition = validateTransactionLifecycleTransition(record.status, nextStatus);
  if (!transition.valid) {
    return {
      ok: false,
      record,
      errors: transition.errors
    };
  }

  return {
    ok: true,
    record: {
      transaction: record.transaction,
      status: nextStatus,
      reason,
      result_version: resultVersion ?? record.result_version
    },
    errors: []
  };
}

function toRecord(txn: Transaction | TransactionLifecycleRecord): TransactionLifecycleRecord {
  if ("transaction" in txn) {
    return txn;
  }

  return {
    transaction: txn,
    status: "queued",
    result_version: txn.result_version
  };
}

function allowedNextStatuses(status: TransactionStatus): readonly TransactionStatus[] {
  switch (status) {
    case "queued":
      return ["running", "rejected", "canceled"];
    case "running":
      return ["completed", "failed", "canceled", "rejected"];
    case "completed":
    case "canceled":
    case "rejected":
    case "failed":
      return [];
  }
}

function deriveTransactionType(operation: RuntimeOperation): TransactionType {
  switch (operation.op_type) {
    case "RequestProjection":
    case "SetViewport":
    case "CommitProjectionAck":
      return "visible-projection";
    case "CancelTransaction":
      return "urgent-input";
    case "AppendChunk":
    case "SealBlock":
    case "PatchRange":
    case "AddMessage":
      return "stream-update";
  }
}

function derivePriority(transactionType: TransactionType): Transaction["priority"] {
  switch (transactionType) {
    case "urgent-input":
      return "urgent-input";
    case "visible-projection":
      return "visible-projection";
    case "stream-update":
      return "stream-update";
    case "background-indexing":
    case "hydration-reconstruction":
    case "cleanup-compaction":
      return "background-indexing";
  }
}

function deriveVisibleRange(operation: RuntimeOperation): VisibleRange | undefined {
  switch (operation.op_type) {
    case "SetViewport":
    case "RequestProjection":
      return operation.visible_range;
    case "AppendChunk":
    case "SealBlock":
    case "PatchRange":
      return {
        start_block_id: operation.block_id,
        end_block_id: operation.block_id
      };
    case "AddMessage":
      return visibleRangeFromBlockIds(operation.block_ids);
    case "CancelTransaction":
    case "CommitProjectionAck":
      return undefined;
  }
}

function visibleRangeFromBlockIds(blockIds: AddMessage["block_ids"]): VisibleRange | undefined {
  if (blockIds.length === 0) {
    return undefined;
  }

  return {
    start_block_id: blockIds[0],
    end_block_id: blockIds[blockIds.length - 1]
  };
}

function deriveDirtyRanges(operation: RuntimeOperation): readonly DirtyRange[] {
  switch (operation.op_type) {
    case "AppendChunk":
      return [
        {
          block_id: operation.block_id,
          start_offset: operation.append_offset,
          end_offset: operation.append_offset
        }
      ];
    case "SealBlock":
      return [
        {
          block_id: operation.block_id,
          start_offset: 0,
          end_offset: operation.final_length
        }
      ];
    case "PatchRange":
      return [
        {
          block_id: operation.block_id,
          start_offset: operation.start_offset,
          end_offset: operation.end_offset
        }
      ];
    case "AddMessage":
    case "SetViewport":
    case "RequestProjection":
    case "CancelTransaction":
    case "CommitProjectionAck":
      return [];
  }
}
