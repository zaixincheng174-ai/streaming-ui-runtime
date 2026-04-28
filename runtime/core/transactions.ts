import type { EquivalentWorkCounters, ProjectionChecksum } from "./checksums.ts";
import type { VisibleRange } from "./ops.ts";
import type { PriorityLane } from "./priorities.ts";
import type { TraceContext } from "./protocol.ts";

export type TransactionType =
  | "urgent-input"
  | "visible-projection"
  | "stream-update"
  | "background-indexing"
  | "hydration-reconstruction"
  | "cleanup-compaction";

export type TransactionStatus =
  | "queued"
  | "running"
  | "completed"
  | "canceled"
  | "rejected"
  | "failed";

export type CancellationPolicy = "none" | "best-effort" | "required-before-visible-commit";
export type StalePolicy = "reject" | "compatible-if-versioned";

export interface DirtyRange {
  block_id: string;
  start_offset: number;
  end_offset: number;
}

export interface ProjectionContract {
  max_result_bytes: number;
  required_visible_range: VisibleRange;
  require_projection_checksum: boolean;
  require_version_check: boolean;
}

export interface Transaction {
  txn_id: string;
  parent_action_id: string;
  op_ids: readonly string[];
  transaction_type: TransactionType;
  priority: PriorityLane;
  deadline_ms: number;
  budget_ms: number;
  session_version: number;
  visible_range: VisibleRange;
  dirty_ranges: readonly DirtyRange[];
  required_work_units: number;
  cancellation_policy: CancellationPolicy;
  stale_policy: StalePolicy;
  result_version: number;
  checksum: string | number;
  projection_contract: ProjectionContract;
  trace_context: TraceContext;
}

export interface TransactionResult {
  txn_id: string;
  status: TransactionStatus;
  session_version: number;
  result_version: number;
  checksum: string | number;
  projection_checksum?: ProjectionChecksum;
  equivalent_work_counters?: EquivalentWorkCounters;
  error_code?: string;
}
