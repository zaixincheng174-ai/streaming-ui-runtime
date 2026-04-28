import type { Transaction } from "./transactions.ts";
import { comparePriority, isPreemptibleBy, type PriorityLane } from "./priorities.ts";
import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";
import { validateTransaction } from "./transaction-validation.ts";

export interface SchedulerAdmissionPolicy {
  allow_equal_priority_admission?: boolean;
  require_version_match?: boolean;
}

export type SchedulerDecisionKind =
  | "admit"
  | "reject"
  | "preempt"
  | "defer"
  | "accept-result"
  | "reject-stale-result";

export interface SchedulerDecision {
  decision: SchedulerDecisionKind;
  reason: string;
  txn_id?: string;
  priority?: PriorityLane;
  session_version?: number;
}

export type SchedulerValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: RuntimeErrorShape[] };

type ValidatedTransaction = Transaction;

export function canPreempt(currentPriority: PriorityLane, incomingPriority: PriorityLane): boolean {
  return isPreemptibleBy(currentPriority, incomingPriority);
}

export function selectHigherPriority(a: PriorityLane, b: PriorityLane): PriorityLane {
  return comparePriority(a, b) >= 0 ? a : b;
}

export function shouldRejectStaleResult(resultSessionVersion: number, currentSessionVersion: number): boolean {
  if (!Number.isFinite(resultSessionVersion) || !Number.isFinite(currentSessionVersion)) {
    return true;
  }

  return resultSessionVersion < currentSessionVersion;
}

export function shouldAdmitTransaction(
  candidate: Partial<Transaction> | null | undefined,
  active: Pick<Transaction, "priority" | "session_version"> | null | undefined,
  policy: SchedulerAdmissionPolicy = {}
): SchedulerDecision {
  const validation = validateTransaction(candidate);
  if (!validation.valid) {
    return {
      decision: "reject",
      reason: validation.errors.map((error) => error.detail ?? error.error_code).join("; ")
    };
  }

  const validCandidate = candidate as ValidatedTransaction;

  if (active == null) {
    return {
      decision: "admit",
      reason: "no active transaction",
      txn_id: validCandidate.txn_id,
      priority: validCandidate.priority,
      session_version: validCandidate.session_version
    };
  }

  if (policy.require_version_match === true && validCandidate.session_version !== active.session_version) {
    return {
      decision: "reject",
      reason: "session version mismatch",
      txn_id: validCandidate.txn_id,
      priority: validCandidate.priority,
      session_version: validCandidate.session_version
    };
  }

  if (canPreempt(active.priority, validCandidate.priority)) {
    return {
      decision: "preempt",
      reason: "candidate priority outranks active transaction",
      txn_id: validCandidate.txn_id,
      priority: validCandidate.priority,
      session_version: validCandidate.session_version
    };
  }

  if (policy.allow_equal_priority_admission === true && comparePriority(validCandidate.priority, active.priority) === 0) {
    return {
      decision: "admit",
      reason: "equal priority admission allowed",
      txn_id: validCandidate.txn_id,
      priority: validCandidate.priority,
      session_version: validCandidate.session_version
    };
  }

  return {
    decision: "defer",
    reason: "active transaction has equal or higher priority",
    txn_id: validCandidate.txn_id,
    priority: validCandidate.priority,
    session_version: validCandidate.session_version
  };
}

export function validateSchedulerDecision(decision: unknown): SchedulerValidationResult {
  if (typeof decision !== "object" || decision === null || Array.isArray(decision)) {
    return {
      valid: false,
      errors: [
        createRuntimeError("MissingRequiredField", {
          detail: "scheduler decision must be an object"
        })
      ]
    };
  }

  const candidate = decision as Partial<SchedulerDecision>;
  const errors: RuntimeErrorShape[] = [];

  if (candidate.decision == null) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        detail: "decision is required"
      })
    );
  }

  if (candidate.reason == null || candidate.reason === "") {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        detail: "reason is required"
      })
    );
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}
