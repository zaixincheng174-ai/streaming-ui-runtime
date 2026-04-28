import type { ProjectionChecksum } from "./checksums.ts";
import type { PriorityLane } from "./priorities.ts";

export interface RuntimeOpBase {
  op_id: string;
  parent_action_id: string;
  session_version: number;
  checksum: string | number;
  priority?: PriorityLane;
}

export interface BoundedPayloadRef {
  ref_id: string;
  byte_length: number;
  checksum: string | number;
}

export interface VisibleRange {
  start_block_id: string;
  end_block_id: string;
  anchor_block_id?: string;
}

export interface AppendChunk extends RuntimeOpBase {
  op_type: "AppendChunk";
  block_id: string;
  chunk_id: string;
  text_bytes_or_ref: string | BoundedPayloadRef;
  append_offset: number;
}

export interface SealBlock extends RuntimeOpBase {
  op_type: "SealBlock";
  block_id: string;
  final_length: number;
}

export interface PatchRange extends RuntimeOpBase {
  op_type: "PatchRange";
  block_id: string;
  start_offset: number;
  end_offset: number;
  replacement_ref: string | BoundedPayloadRef;
}

export interface AddMessage extends RuntimeOpBase {
  op_type: "AddMessage";
  message_id: string;
  role: "system" | "user" | "assistant" | "tool";
  block_ids: readonly string[];
  created_at_ms: number;
}

export interface SetViewport extends RuntimeOpBase {
  op_type: "SetViewport";
  visible_range: VisibleRange;
  anchor: string;
  viewport_version: number;
}

export interface RequestProjection extends RuntimeOpBase {
  op_type: "RequestProjection";
  visible_range: VisibleRange;
  priority: PriorityLane;
  deadline_ms: number;
  reason: "input" | "scroll" | "stream-update" | "background-refresh";
}

export interface CancelTransaction extends RuntimeOpBase {
  op_type: "CancelTransaction";
  txn_id: string;
  reason: string;
  cancellation_policy: "best-effort" | "required-before-commit";
}

export interface CommitProjectionAck extends RuntimeOpBase {
  op_type: "CommitProjectionAck";
  projection_id: string;
  result_version: number;
  committed_at_ms: number;
  status: "committed" | "rejected";
  projection_checksum?: ProjectionChecksum;
}

export type RuntimeOperation =
  | AppendChunk
  | SealBlock
  | PatchRange
  | AddMessage
  | SetViewport
  | RequestProjection
  | CancelTransaction
  | CommitProjectionAck;
