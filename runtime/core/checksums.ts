import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";

type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type RuntimeHashValue = string | number;
export type WorkloadSourceHash = Brand<RuntimeHashValue, "WorkloadSourceHash">;
export type ActionSequenceHash = Brand<RuntimeHashValue, "ActionSequenceHash">;
export type WorkerResultChecksum = Brand<RuntimeHashValue, "WorkerResultChecksum">;
export type ProjectionChecksum = Brand<RuntimeHashValue, "ProjectionChecksum">;

export interface EquivalentWorkCounters {
  module_flush_count: number;
  subscriber_notify_count: number;
  queue_drain_step_count: number;
  derived_selector_eval_count: number;
  state_nodes_touched_observed: number;
  derived_hash_rounds_observed: number;
  projection_update_count_observed: number;
}

export type CounterValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: RuntimeErrorShape[] };

const counterFields = [
  "module_flush_count",
  "subscriber_notify_count",
  "queue_drain_step_count",
  "derived_selector_eval_count",
  "state_nodes_touched_observed",
  "derived_hash_rounds_observed",
  "projection_update_count_observed"
] as const satisfies readonly (keyof EquivalentWorkCounters)[];

export function validateEquivalentWorkCounters(
  actual: Partial<EquivalentWorkCounters> | null | undefined,
  expected: EquivalentWorkCounters
): CounterValidationResult {
  const errors: RuntimeErrorShape[] = [];

  errors.push(...collectEquivalentWorkCounterShapeErrors(actual, "actual equivalent work counters"));
  errors.push(...collectEquivalentWorkCounterShapeErrors(expected, "expected equivalent work counters"));
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const validActual = actual as EquivalentWorkCounters;
  const validExpected = expected as EquivalentWorkCounters;
  for (const field of counterFields) {
    const actualValue = validActual[field];
    const expectedValue = validExpected[field];
    if (actualValue < expectedValue) {
      errors.push(
        createRuntimeError("EquivalenceMismatch", {
          detail: `${field}=${String(actualValue)} is below expected ${expectedValue}`
        })
      );
    }
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

export function validateEquivalentWorkCounterShape(
  counters: Partial<EquivalentWorkCounters> | null | undefined
): CounterValidationResult {
  const errors = collectEquivalentWorkCounterShapeErrors(counters, "equivalent work counters");

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

export function validateRequiredChecksum(
  value: unknown,
  fieldName: string
): { valid: true; errors: [] } | { valid: false; errors: RuntimeErrorShape[] } {
  if ((typeof value === "string" && value.length > 0) || (typeof value === "number" && Number.isFinite(value))) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: [
      createRuntimeError("InvalidChecksum", {
        detail: `${fieldName} is missing or invalid`
      })
    ]
  };
}

export function validateWorkerResultChecksum(value: unknown): ReturnType<typeof validateRequiredChecksum> {
  return validateRequiredChecksum(value, "worker_result_checksum");
}

export function validateProjectionChecksum(value: unknown): ReturnType<typeof validateRequiredChecksum> {
  return validateRequiredChecksum(value, "projection_checksum");
}

function collectEquivalentWorkCounterShapeErrors(
  counters: Partial<EquivalentWorkCounters> | null | undefined,
  label: string
): RuntimeErrorShape[] {
  if (counters == null) {
    return [
      createRuntimeError("EquivalenceMismatch", {
        detail: `${label} are missing`
      })
    ];
  }

  const errors: RuntimeErrorShape[] = [];
  for (const field of counterFields) {
    const value = counters[field];
    if (!Number.isInteger(value) || (value as number) < 0) {
      errors.push(
        createRuntimeError("EquivalenceMismatch", {
          detail: `${label}.${field}=${String(value)} is missing or invalid`
        })
      );
    }
  }

  return errors;
}
