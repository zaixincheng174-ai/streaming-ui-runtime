import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";
import { isPriorityLane } from "./priorities.ts";
import type {
  AddMessage,
  AppendChunk,
  CancelTransaction,
  CommitProjectionAck,
  PatchRange,
  RequestProjection,
  RuntimeOperation,
  SealBlock,
  SetViewport,
  VisibleRange
} from "./ops.ts";

export type OperationValidationErrorReason =
  | "unknown-op-type"
  | "missing-required-field"
  | "invalid-checksum"
  | "invalid-session-version"
  | "invalid-offset"
  | "invalid-payload"
  | "invalid-priority"
  | "invalid-timestamp";

export interface OperationValidationOptions {
  max_inline_payload_bytes?: number;
}

export type OperationValidationResult =
  | { valid: true; errors: []; reasons: [] }
  | { valid: false; errors: RuntimeErrorShape[]; reasons: OperationValidationErrorReason[] };

const opTypes = [
  "AppendChunk",
  "SealBlock",
  "PatchRange",
  "AddMessage",
  "SetViewport",
  "RequestProjection",
  "CancelTransaction",
  "CommitProjectionAck"
] as const;

type RuntimeOpType = (typeof opTypes)[number];

export function validateOperation(
  op: Partial<RuntimeOperation> | Record<string, unknown> | null | undefined,
  options: OperationValidationOptions = {}
): OperationValidationResult {
  if (!isRecord(op)) {
    return invalid("operation must be an object", "missing-required-field");
  }

  const baseValidation = validateBaseFields(op);
  if (!baseValidation.valid) {
    return baseValidation;
  }

  switch (op.op_type) {
    case "AppendChunk":
      return validateAppendChunk(op as Partial<AppendChunk>, options);
    case "SealBlock":
      return validateSealBlock(op as Partial<SealBlock>);
    case "PatchRange":
      return validatePatchRange(op as Partial<PatchRange>);
    case "AddMessage":
      return validateAddMessage(op as Partial<AddMessage>);
    case "SetViewport":
      return validateSetViewport(op as Partial<SetViewport>);
    case "RequestProjection":
      return validateRequestProjection(op as Partial<RequestProjection>);
    case "CancelTransaction":
      return validateCancelTransaction(op as Partial<CancelTransaction>);
    case "CommitProjectionAck":
      return validateCommitProjectionAck(op as Partial<CommitProjectionAck>);
    default:
      return invalid(`unknown op_type=${String(op.op_type)}`, "unknown-op-type", "UnknownMessageType");
  }
}

export function validateAppendChunk(
  op: Partial<AppendChunk>,
  options: OperationValidationOptions = {}
): OperationValidationResult {
  const errors = new OperationValidationCollector();

  errors.requireNonEmptyString(op.block_id, "block_id");
  errors.requireNonEmptyString(op.chunk_id, "chunk_id");
  errors.requireNonNegativeInteger(op.append_offset, "append_offset", "invalid-offset");
  errors.requirePayloadOrRef(op.text_bytes_or_ref, "text_bytes_or_ref", options);

  return errors.result();
}

export function validateSealBlock(op: Partial<SealBlock>): OperationValidationResult {
  const errors = new OperationValidationCollector();

  errors.requireNonEmptyString(op.block_id, "block_id");
  errors.requireNonNegativeInteger(op.final_length, "final_length", "invalid-offset");

  return errors.result();
}

export function validatePatchRange(op: Partial<PatchRange>): OperationValidationResult {
  const errors = new OperationValidationCollector();

  errors.requireNonEmptyString(op.block_id, "block_id");
  errors.requireNonNegativeInteger(op.start_offset, "start_offset", "invalid-offset");
  errors.requireNonNegativeInteger(op.end_offset, "end_offset", "invalid-offset");
  if (isNonNegativeInteger(op.start_offset) && isNonNegativeInteger(op.end_offset)) {
    if (op.end_offset < op.start_offset) {
      errors.add("end_offset must be greater than or equal to start_offset", "invalid-offset");
    }
  }
  errors.requirePayloadOrRef(op.replacement_ref, "replacement_ref", {});

  return errors.result();
}

export function validateAddMessage(op: Partial<AddMessage>): OperationValidationResult {
  const errors = new OperationValidationCollector();

  errors.requireNonEmptyString(op.message_id, "message_id");
  if (!isMessageRole(op.role)) {
    errors.add("role is missing or invalid", "missing-required-field");
  }
  if (!Array.isArray(op.block_ids) || op.block_ids.length === 0 || !op.block_ids.every(isNonEmptyString)) {
    errors.add("block_ids must be a non-empty string array", "missing-required-field");
  } else if (new Set(op.block_ids).size !== op.block_ids.length) {
    errors.add("block_ids must not contain duplicate block ids", "missing-required-field");
  }
  errors.requireNonNegativeFiniteNumber(op.created_at_ms, "created_at_ms", "invalid-timestamp");

  return errors.result();
}

export function validateSetViewport(op: Partial<SetViewport>): OperationValidationResult {
  const errors = new OperationValidationCollector();

  errors.requireVisibleRange(op.visible_range, "visible_range");
  errors.requireNonEmptyString(op.anchor, "anchor");
  errors.requireNonNegativeInteger(op.viewport_version, "viewport_version", "missing-required-field");

  return errors.result();
}

export function validateRequestProjection(op: Partial<RequestProjection>): OperationValidationResult {
  const errors = new OperationValidationCollector();

  errors.requireVisibleRange(op.visible_range, "visible_range");
  if (!isPriorityLane(op.priority)) {
    errors.add("priority is missing or invalid", "invalid-priority");
  }
  errors.requireNonNegativeFiniteNumber(op.deadline_ms, "deadline_ms", "missing-required-field");
  if (!isRequestProjectionReason(op.reason)) {
    errors.add("reason is missing or invalid", "missing-required-field");
  }

  return errors.result();
}

export function validateCancelTransaction(op: Partial<CancelTransaction>): OperationValidationResult {
  const errors = new OperationValidationCollector();

  errors.requireNonEmptyString(op.txn_id, "txn_id");
  errors.requireNonEmptyString(op.reason, "reason");
  if (!isCancellationPolicy(op.cancellation_policy)) {
    errors.add("cancellation_policy is missing or invalid", "missing-required-field");
  }

  return errors.result();
}

export function validateCommitProjectionAck(op: Partial<CommitProjectionAck>): OperationValidationResult {
  const errors = new OperationValidationCollector();

  errors.requireNonEmptyString(op.projection_id, "projection_id");
  errors.requireNonNegativeInteger(op.result_version, "result_version", "missing-required-field");
  errors.requireNonNegativeFiniteNumber(op.committed_at_ms, "committed_at_ms", "invalid-timestamp");
  if (op.status !== "committed" && op.status !== "rejected") {
    errors.add("status is missing or invalid", "missing-required-field");
  }

  return errors.result();
}

function validateBaseFields(op: Record<string, unknown>): OperationValidationResult {
  const errors = new OperationValidationCollector();

  if (!isRuntimeOpType(op.op_type)) {
    errors.add(`unknown op_type=${String(op.op_type)}`, "unknown-op-type", "UnknownMessageType");
  }
  errors.requireNonEmptyString(op.op_id, "op_id");
  errors.requireNonEmptyString(op.parent_action_id, "parent_action_id");
  errors.requireNonNegativeInteger(op.session_version, "session_version", "invalid-session-version");
  errors.requireChecksum(op.checksum, "checksum");
  if (op.priority != null && !isPriorityLane(op.priority)) {
    errors.add("priority is invalid", "invalid-priority");
  }

  return errors.result();
}

class OperationValidationCollector {
  private readonly errors: RuntimeErrorShape[] = [];
  private readonly reasons: OperationValidationErrorReason[] = [];

  add(
    detail: string,
    reason: OperationValidationErrorReason,
    errorCode: "MissingRequiredField" | "InvalidChecksum" | "UnknownMessageType" = "MissingRequiredField"
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

  requireNonNegativeFiniteNumber(
    value: unknown,
    fieldName: string,
    reason: OperationValidationErrorReason
  ): void {
    if (!isNonNegativeFiniteNumber(value)) {
      this.add(`${fieldName} must be a finite non-negative number`, reason);
    }
  }

  requireNonNegativeInteger(value: unknown, fieldName: string, reason: OperationValidationErrorReason): void {
    if (!isNonNegativeInteger(value)) {
      this.add(`${fieldName} must be a finite non-negative integer`, reason);
    }
  }

  requireChecksum(value: unknown, fieldName: string): void {
    if (!isChecksumValue(value)) {
      this.add(`${fieldName} is missing or invalid`, "invalid-checksum", "InvalidChecksum");
    }
  }

  requirePayloadOrRef(value: unknown, fieldName: string, options: OperationValidationOptions): void {
    if (isNonEmptyString(value)) {
      if (
        isNonNegativeFiniteNumber(options.max_inline_payload_bytes) &&
        stringByteLength(value) > options.max_inline_payload_bytes
      ) {
        this.add(`${fieldName} exceeds max_inline_payload_bytes`, "invalid-payload");
      }
      return;
    }

    if (isRecord(value)) {
      this.requireBoundedPayloadRef(value, fieldName);
      return;
    }

    this.add(`${fieldName} must be a non-empty string or bounded payload ref`, "invalid-payload");
  }

  requireBoundedPayloadRef(value: unknown, fieldName: string): void {
    if (!isRecord(value)) {
      this.add(`${fieldName} must be a bounded payload ref`, "invalid-payload");
      return;
    }

    if (!isNonEmptyString(value.ref_id)) {
      this.add(`${fieldName}.ref_id is required`, "missing-required-field");
    }
    if (!isNonNegativeInteger(value.byte_length)) {
      this.add(`${fieldName}.byte_length must be a finite non-negative integer`, "invalid-payload");
    }
    this.requireChecksum(value.checksum, `${fieldName}.checksum`);
  }

  requireVisibleRange(value: unknown, fieldName: string): void {
    if (!isVisibleRange(value)) {
      this.add(`${fieldName} is missing or invalid`, "missing-required-field");
    }
  }

  result(): OperationValidationResult {
    return this.errors.length === 0
      ? { valid: true, errors: [], reasons: [] }
      : { valid: false, errors: this.errors, reasons: this.reasons };
  }
}

function invalid(
  detail: string,
  reason: OperationValidationErrorReason,
  errorCode: "MissingRequiredField" | "InvalidChecksum" | "UnknownMessageType" = "MissingRequiredField"
): OperationValidationResult {
  return {
    valid: false,
    errors: [
      createRuntimeError(errorCode, {
        detail
      })
    ],
    reasons: [reason]
  };
}

function isRuntimeOpType(value: unknown): value is RuntimeOpType {
  return typeof value === "string" && (opTypes as readonly string[]).includes(value);
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

function isMessageRole(value: unknown): value is AddMessage["role"] {
  return value === "system" || value === "user" || value === "assistant" || value === "tool";
}

function isRequestProjectionReason(value: unknown): value is RequestProjection["reason"] {
  return value === "input" || value === "scroll" || value === "stream-update" || value === "background-refresh";
}

function isCancellationPolicy(value: unknown): value is CancelTransaction["cancellation_policy"] {
  return value === "best-effort" || value === "required-before-commit";
}

// Minimal ambient type for the Web Standards UTF-8 encoder. TextEncoder is a
// global on Node 11+, modern browsers, and Workers. Declared here so this
// module does not depend on the DOM or WebWorker tsconfig libs and stays
// framework-agnostic.
declare const TextEncoder: {
  new (): { encode(input?: string): { length: number } };
};

const utf8ByteCounter = new TextEncoder();

function stringByteLength(value: string): number {
  return utf8ByteCounter.encode(value).length;
}
