import type { EquivalentWorkCounters, ProjectionChecksum } from "./checksums.ts";
import { validateEquivalentWorkCounterShape, validateProjectionChecksum } from "./checksums.ts";
import { createRuntimeError, type RuntimeErrorCode, type RuntimeErrorShape } from "./errors.ts";
import type { VisibleRange } from "./ops.ts";

export type ProjectionStaleStatus = "fresh" | "compatible" | "stale";

export interface ProjectionBlockShape {
  block_id: string;
  estimated_bytes: number;
}

export interface ProjectionResultShape {
  projection_id: string;
  txn_id: string;
  session_version: number;
  result_version: number;
  visible_range: VisibleRange;
  blocks: readonly ProjectionBlockShape[];
  checksum?: ProjectionChecksum | string | number;
  stale_status: ProjectionStaleStatus;
  equivalent_work_counters?: EquivalentWorkCounters;
}

export interface ProjectionBounds {
  max_blocks: number;
  max_result_bytes: number;
  require_checksum: boolean;
  allow_stale_compatible: boolean;
}

export type ProjectionValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: RuntimeErrorShape[] };

export type ProjectionCommitDecision =
  | { commit: true; reason: string; result: ProjectionResultShape; errors: [] }
  | { commit: false; reason: string; errors: RuntimeErrorShape[] };

export function isStaleProjection(resultSessionVersion: number, currentSessionVersion: number): boolean {
  if (!Number.isFinite(resultSessionVersion) || !Number.isFinite(currentSessionVersion)) {
    return true;
  }

  return resultSessionVersion < currentSessionVersion;
}

export function validateProjectionBounds(
  result: Partial<ProjectionResultShape> | null | undefined,
  bounds: Partial<ProjectionBounds> | null | undefined
): ProjectionValidationResult {
  const errors: RuntimeErrorShape[] = [];
  const boundsErrors = validateProjectionBoundsConfig(bounds);
  if (boundsErrors.length > 0) {
    return { valid: false, errors: boundsErrors };
  }
  const validBounds = bounds as ProjectionBounds;

  if (result == null) {
    return {
      valid: false,
      errors: [
        createRuntimeError("MissingRequiredField", {
          safe_fallback: "reject-projection",
          detail: "projection result is required"
        })
      ]
    };
  }

  if (result.projection_id == null || result.projection_id === "") {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        safe_fallback: "reject-projection",
        detail: "projection_id is required"
      })
    );
  }

  if (result.txn_id == null || result.txn_id === "") {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        safe_fallback: "reject-projection",
        detail: "txn_id is required"
      })
    );
  }

  if (!isNonNegativeInteger(result.session_version)) {
    errors.push(
      createRuntimeError("StaleProjectionRejected", {
        safe_fallback: "reject-projection",
        detail: "session_version is missing or invalid"
      })
    );
  }

  if (!isNonNegativeInteger(result.result_version)) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        safe_fallback: "reject-projection",
        detail: "result_version is missing or invalid"
      })
    );
  }

  if (!isVisibleRange(result.visible_range)) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        safe_fallback: "reject-projection",
        detail: "visible_range is missing or invalid"
      })
    );
  }

  if (result.stale_status == null || !isProjectionStaleStatus(result.stale_status)) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        safe_fallback: "reject-projection",
        detail: "stale_status is required"
      })
    );
  }

  if (result.equivalent_work_counters !== undefined) {
    const counterValidation = validateEquivalentWorkCounterShape(result.equivalent_work_counters);
    if (!counterValidation.valid) {
      errors.push(...counterValidation.errors);
    }
  }

  if (!Array.isArray(result.blocks)) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        safe_fallback: "reject-projection",
        detail: "blocks are required"
      })
    );
  } else {
    if (result.blocks.length > validBounds.max_blocks) {
      errors.push(
        createRuntimeError("ProjectionTooLarge", {
          safe_fallback: "reject-projection",
          detail: `block count ${result.blocks.length} exceeds max_blocks ${validBounds.max_blocks}`
        })
      );
    }

    errors.push(...validateProjectionBlocks(result.blocks));
    if (isVisibleRange(result.visible_range)) {
      errors.push(...validateVisibleRangeBlockReferences(result.visible_range, result.blocks));
    }

    const estimatedBytes = estimateProjectionBytes(result);
    if (estimatedBytes > validBounds.max_result_bytes) {
      errors.push(
        createRuntimeError("ProjectionTooLarge", {
          safe_fallback: "reject-projection",
          detail: `estimated bytes ${estimatedBytes} exceeds max_result_bytes ${validBounds.max_result_bytes}`
        })
      );
    }
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

export function validateProjectionChecksumPresence(
  result: Partial<ProjectionResultShape> | null | undefined,
  bounds: ProjectionBounds
): ProjectionValidationResult {
  if (!bounds.require_checksum) {
    return { valid: true, errors: [] };
  }

  return validateProjectionChecksum(result?.checksum);
}

export function shouldCommitProjection(
  result: Partial<ProjectionResultShape> | null | undefined,
  currentSessionVersion: number,
  bounds: Partial<ProjectionBounds> | null | undefined
): ProjectionCommitDecision {
  const boundsValidation = validateProjectionBounds(result, bounds);
  if (!boundsValidation.valid) {
    return createProjectionRejectedDecision("projection bounds validation failed", boundsValidation.errors[0].error_code);
  }

  const validBounds = bounds as ProjectionBounds;
  const checksumValidation = validateProjectionChecksumPresence(result, validBounds);
  if (!checksumValidation.valid) {
    return createProjectionRejectedDecision("projection checksum validation failed", "InvalidChecksum");
  }

  const projection = result as ProjectionResultShape;
  if (!isNonNegativeInteger(projection.session_version)) {
    return createProjectionRejectedDecision("projection session_version is invalid", "StaleProjectionRejected");
  }

  if (!isNonNegativeInteger(currentSessionVersion)) {
    return createProjectionRejectedDecision("current session version is invalid", "StaleProjectionRejected");
  }

  if (projection.session_version > currentSessionVersion) {
    return createProjectionRejectedDecision("future projection session version rejected", "StaleProjectionRejected");
  }

  if (isStaleProjection(projection.session_version, currentSessionVersion)) {
    if (validBounds.allow_stale_compatible === true && projection.stale_status === "compatible") {
      return {
        commit: true,
        reason: "stale compatible projection accepted by bounds",
        result: projection,
        errors: []
      };
    }

    return createProjectionRejectedDecision("stale projection rejected", "StaleProjectionRejected");
  }

  if (projection.stale_status === "stale") {
    return createProjectionRejectedDecision("explicit stale projection rejected", "StaleProjectionRejected");
  }

  return {
    commit: true,
    reason: "projection accepted",
    result: projection,
    errors: []
  };
}

export function createProjectionRejectedDecision(
  reason: string,
  error_code: RuntimeErrorCode
): ProjectionCommitDecision {
  return {
    commit: false,
    reason,
    errors: [
      createRuntimeError(error_code, {
        safe_fallback: "reject-projection",
        detail: reason
      })
    ]
  };
}

function isProjectionStaleStatus(value: unknown): value is ProjectionStaleStatus {
  return value === "fresh" || value === "compatible" || value === "stale";
}

function validateProjectionBoundsConfig(bounds: Partial<ProjectionBounds> | null | undefined): RuntimeErrorShape[] {
  if (bounds == null) {
    return [
      createRuntimeError("MissingRequiredField", {
        safe_fallback: "reject-projection",
        detail: "projection bounds are required"
      })
    ];
  }

  const errors: RuntimeErrorShape[] = [];
  if (!isNonNegativeInteger(bounds.max_blocks)) {
    errors.push(
      createRuntimeError("ProjectionTooLarge", {
        safe_fallback: "reject-projection",
        detail: "max_blocks is missing or invalid"
      })
    );
  }

  if (!isNonNegativeFiniteNumber(bounds.max_result_bytes)) {
    errors.push(
      createRuntimeError("ProjectionTooLarge", {
        safe_fallback: "reject-projection",
        detail: "max_result_bytes is missing or invalid"
      })
    );
  }

  if (typeof bounds.require_checksum !== "boolean") {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        safe_fallback: "reject-projection",
        detail: "require_checksum must be boolean"
      })
    );
  }

  if (typeof bounds.allow_stale_compatible !== "boolean") {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        safe_fallback: "reject-projection",
        detail: "allow_stale_compatible must be boolean"
      })
    );
  }

  return errors;
}

function validateProjectionBlocks(blocks: readonly unknown[]): RuntimeErrorShape[] {
  const errors: RuntimeErrorShape[] = [];
  const seenBlockIds = new Set<string>();

  for (const block of blocks) {
    if (!isRecord(block)) {
      errors.push(
        createRuntimeError("MissingRequiredField", {
          safe_fallback: "reject-projection",
          detail: "projection block must be an object"
        })
      );
      continue;
    }

    if (!isNonEmptyString(block.block_id)) {
      errors.push(
        createRuntimeError("MissingRequiredField", {
          safe_fallback: "reject-projection",
          detail: "projection block_id is missing or invalid"
        })
      );
    } else if (seenBlockIds.has(block.block_id)) {
      errors.push(
        createRuntimeError("EquivalenceMismatch", {
          safe_fallback: "reject-projection",
          detail: `duplicate projection block_id ${block.block_id}`
        })
      );
    } else {
      seenBlockIds.add(block.block_id);
    }

    if (!isNonNegativeInteger(block.estimated_bytes)) {
      errors.push(
        createRuntimeError("ProjectionTooLarge", {
          safe_fallback: "reject-projection",
          detail: "projection block estimated_bytes must be a finite non-negative integer"
        })
      );
    }
  }

  return errors;
}

function validateVisibleRangeBlockReferences(
  visibleRange: VisibleRange,
  blocks: readonly unknown[]
): RuntimeErrorShape[] {
  const blockIds = new Set<string>();
  const errors: RuntimeErrorShape[] = [];

  for (const block of blocks) {
    if (isRecord(block) && isNonEmptyString(block.block_id)) {
      blockIds.add(block.block_id);
    }
  }

  if (!blockIds.has(visibleRange.start_block_id)) {
    errors.push(
      createRuntimeError("EquivalenceMismatch", {
        safe_fallback: "reject-projection",
        detail: `visible_range start_block_id ${visibleRange.start_block_id} is absent from projection blocks`
      })
    );
  }

  if (!blockIds.has(visibleRange.end_block_id)) {
    errors.push(
      createRuntimeError("EquivalenceMismatch", {
        safe_fallback: "reject-projection",
        detail: `visible_range end_block_id ${visibleRange.end_block_id} is absent from projection blocks`
      })
    );
  }

  if (visibleRange.anchor_block_id != null && !blockIds.has(visibleRange.anchor_block_id)) {
    errors.push(
      createRuntimeError("EquivalenceMismatch", {
        safe_fallback: "reject-projection",
        detail: `visible_range anchor_block_id ${visibleRange.anchor_block_id} is absent from projection blocks`
      })
    );
  }

  return errors;
}

function isVisibleRange(value: unknown): value is VisibleRange {
  return (
    isRecord(value) &&
    isNonEmptyString(value.start_block_id) &&
    isNonEmptyString(value.end_block_id) &&
    (value.anchor_block_id == null || isNonEmptyString(value.anchor_block_id))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function estimateProjectionBytes(result: Partial<ProjectionResultShape>): number {
  if (!Array.isArray(result.blocks)) {
    return 0;
  }

  return result.blocks.reduce((total, block) => {
    if (!isRecord(block) || !isNonNegativeInteger(block.estimated_bytes)) {
      return total;
    }

    return total + block.estimated_bytes;
  }, 0);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
