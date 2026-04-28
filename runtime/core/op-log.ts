import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";
import { validateOperation } from "./op-validation.ts";
import type { RuntimeOperation } from "./ops.ts";

export interface OpLog {
  operations: readonly RuntimeOperation[];
  op_ids: readonly string[];
}

export interface OpLogSummary {
  operation_count: number;
  op_ids: readonly string[];
}

export type OpLogAppendResult =
  | { accepted: true; log: OpLog; operation: RuntimeOperation; errors: [] }
  | { accepted: false; log: OpLog; errors: RuntimeErrorShape[] };

export function createEmptyOpLog(): OpLog {
  return {
    operations: [],
    op_ids: []
  };
}

export function appendOperation(log: OpLog, op: Partial<RuntimeOperation> | Record<string, unknown>): OpLogAppendResult {
  const validation = validateOperation(op);
  if (!validation.valid) {
    return {
      accepted: false,
      log,
      errors: validation.errors
    };
  }

  const operation = op as RuntimeOperation;
  if (hasOperation(log, operation.op_id)) {
    return {
      accepted: false,
      log,
      errors: [
        createRuntimeError("DuplicateOperationId", {
          detail: `duplicate op_id=${operation.op_id}`
        })
      ]
    };
  }

  return {
    accepted: true,
    log: {
      operations: [...log.operations, operation],
      op_ids: [...log.op_ids, operation.op_id]
    },
    operation,
    errors: []
  };
}

export function hasOperation(log: OpLog, op_id: string): boolean {
  return log.op_ids.includes(op_id);
}

export function getOperationCount(log: OpLog): number {
  return log.operations.length;
}

export function summarizeOpLog(log: OpLog): OpLogSummary {
  return {
    operation_count: getOperationCount(log),
    op_ids: [...log.op_ids]
  };
}
