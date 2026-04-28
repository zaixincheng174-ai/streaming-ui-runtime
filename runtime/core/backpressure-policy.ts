import { createRuntimeError, type RuntimeErrorCode, type RuntimeErrorShape } from "./errors.ts";
import { isPriorityLane, type PriorityLane } from "./priorities.ts";

export interface BackpressureLimits {
  max_pending_transactions: number;
  max_pending_bytes: number;
  max_projection_result_bytes: number;
  max_uncommitted_projection_count: number;
}

export interface BackpressureSnapshot {
  pending_transactions: number;
  pending_bytes: number;
  largest_pending_projection_bytes: number;
  uncommitted_projection_count: number;
  background_queue_depth: number;
  stream_update_queue_depth: number;
}

export interface StreamUpdatePolicy {
  semantic_equivalence_preserved: boolean;
}

export interface ProjectionSizeInfo {
  result_bytes: number;
}

export interface TransactionAdmissionInput {
  priority: PriorityLane;
  projected_bytes?: number;
  projection_size?: ProjectionSizeInfo;
}

export type BackpressureDecision =
  | {
      admit: true;
      reason: string;
      throttle_background: boolean;
      errors: [];
    }
  | {
      admit: false;
      reason: string;
      throttle_background: boolean;
      errors: RuntimeErrorShape[];
    };

export type BackpressureValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: RuntimeErrorShape[] };

const limitFields = [
  "max_pending_transactions",
  "max_pending_bytes",
  "max_projection_result_bytes",
  "max_uncommitted_projection_count"
] as const satisfies readonly (keyof BackpressureLimits)[];

const snapshotFields = [
  "pending_transactions",
  "pending_bytes",
  "largest_pending_projection_bytes",
  "uncommitted_projection_count",
  "background_queue_depth",
  "stream_update_queue_depth"
] as const satisfies readonly (keyof BackpressureSnapshot)[];

export function validateBackpressureLimits(
  limits: Partial<BackpressureLimits> | null | undefined
): BackpressureValidationResult {
  if (limits == null) {
    return {
      valid: false,
      errors: [
        createRuntimeError("BackpressureLimitExceeded", {
          detail: "backpressure limits are required"
        })
      ]
    };
  }

  const errors: RuntimeErrorShape[] = [];
  for (const field of limitFields) {
    const value = limits[field];
    if (!isNonNegativeInteger(value)) {
      errors.push(
        createRuntimeError("BackpressureLimitExceeded", {
          detail: `${field} is missing or invalid`
        })
      );
    }
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

export function evaluateBackpressure(
  snapshot: Partial<BackpressureSnapshot> | null | undefined,
  limits: BackpressureLimits
): BackpressureDecision {
  const validation = validateSnapshotAndLimits(snapshot, limits);
  if (!validation.valid) {
    return createBackpressureRejectedDecision("backpressure state validation failed", "BackpressureLimitExceeded");
  }

  const validSnapshot = snapshot as BackpressureSnapshot;

  if (validSnapshot.pending_bytes > limits.max_pending_bytes) {
    return createBackpressureRejectedDecision("pending bytes exceed limit", "BackpressureLimitExceeded");
  }

  if (validSnapshot.largest_pending_projection_bytes > limits.max_projection_result_bytes) {
    return createBackpressureRejectedDecision("pending projection size exceeds limit", "ProjectionTooLarge");
  }

  return {
    admit: true,
    reason: "backpressure state is within limits",
    throttle_background: shouldThrottleBackground(validSnapshot, limits),
    errors: []
  };
}

export function canAdmitTransaction(
  input: TransactionAdmissionInput,
  snapshot: BackpressureSnapshot,
  limits: BackpressureLimits
): BackpressureDecision {
  const validation = validateSnapshotAndLimits(snapshot, limits);
  if (!validation.valid) {
    return createBackpressureRejectedDecision("backpressure state validation failed", "BackpressureLimitExceeded");
  }

  if (!isPriorityLane(input.priority)) {
    return createBackpressureRejectedDecision("priority is invalid", "BackpressureLimitExceeded");
  }

  if (input.projected_bytes != null && !isNonNegativeInteger(input.projected_bytes)) {
    return createBackpressureRejectedDecision("projected bytes are invalid", "BackpressureLimitExceeded");
  }

  if (input.projection_size != null && shouldRejectProjectionSize(input.projection_size, limits)) {
    return createBackpressureRejectedDecision("projection size exceeds limit", "ProjectionTooLarge");
  }

  if (input.priority === "urgent-input") {
    return {
      admit: true,
      reason: "urgent-input is never dropped by backpressure policy",
      throttle_background: true,
      errors: []
    };
  }

  const projectedPendingBytes = snapshot.pending_bytes + (input.projected_bytes ?? 0);
  if (snapshot.pending_transactions >= limits.max_pending_transactions) {
    return createBackpressureRejectedDecision("pending transaction limit reached", "BackpressureLimitExceeded");
  }

  if (projectedPendingBytes > limits.max_pending_bytes) {
    return createBackpressureRejectedDecision("pending byte limit exceeded", "BackpressureLimitExceeded");
  }

  if (
    input.priority === "visible-projection" &&
    snapshot.uncommitted_projection_count >= limits.max_uncommitted_projection_count
  ) {
    return createBackpressureRejectedDecision("uncommitted projection limit reached", "BackpressureLimitExceeded");
  }

  return {
    admit: true,
    reason: "transaction admitted",
    throttle_background: shouldThrottleBackground(snapshot, limits),
    errors: []
  };
}

export function shouldThrottleBackground(
  snapshot: Partial<BackpressureSnapshot> | null | undefined,
  limits: Partial<BackpressureLimits> | null | undefined
): boolean {
  if (!validateSnapshotAndLimits(snapshot, limits).valid) {
    return true;
  }

  const validSnapshot = snapshot as BackpressureSnapshot;
  const validLimits = limits as BackpressureLimits;

  return (
    validSnapshot.pending_transactions >= validLimits.max_pending_transactions ||
    validSnapshot.pending_bytes > validLimits.max_pending_bytes ||
    validSnapshot.largest_pending_projection_bytes > validLimits.max_projection_result_bytes ||
    validSnapshot.uncommitted_projection_count >= validLimits.max_uncommitted_projection_count
  );
}

export function shouldRejectProjectionSize(
  sizeInfo: Partial<ProjectionSizeInfo> | null | undefined,
  limits: Partial<BackpressureLimits> | null | undefined
): boolean {
  if (!validateBackpressureLimits(limits).valid) {
    return true;
  }

  if (!isNonNegativeInteger(sizeInfo?.result_bytes)) {
    return true;
  }

  return sizeInfo.result_bytes > (limits as BackpressureLimits).max_projection_result_bytes;
}

export function canMergeStreamUpdate(policy: Partial<StreamUpdatePolicy> | null | undefined): boolean {
  return policy?.semantic_equivalence_preserved === true;
}

export function createBackpressureRejectedDecision(
  reason: string,
  error_code: RuntimeErrorCode
): BackpressureDecision {
  return {
    admit: false,
    reason,
    throttle_background: true,
    errors: [
      createRuntimeError(error_code, {
        safe_fallback: "reject-message",
        detail: reason
      })
    ]
  };
}

function validateSnapshotAndLimits(
  snapshot: Partial<BackpressureSnapshot> | null | undefined,
  limits: Partial<BackpressureLimits> | null | undefined
): BackpressureValidationResult {
  const limitValidation = validateBackpressureLimits(limits);
  if (!limitValidation.valid) {
    return limitValidation;
  }

  if (snapshot == null) {
    return {
      valid: false,
      errors: [
        createRuntimeError("BackpressureLimitExceeded", {
          detail: "backpressure snapshot is required"
        })
      ]
    };
  }

  const errors: RuntimeErrorShape[] = [];
  for (const field of snapshotFields) {
    const value = snapshot[field];
    if (!isNonNegativeInteger(value)) {
      errors.push(
        createRuntimeError("BackpressureLimitExceeded", {
          detail: `${field} is missing or invalid`
        })
      );
    }
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
