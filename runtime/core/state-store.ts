import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";
import { validateOperation } from "./op-validation.ts";
import type {
  AddMessage,
  AppendChunk,
  PatchRange,
  RuntimeOperation,
  SealBlock
} from "./ops.ts";

export interface BlockState {
  block_id: string;
  text: string;
  // State-store v0 offsets and lengths are UTF-16 code units.
  // Payload byte budgets are handled before state application.
  length: number;
  sealed: boolean;
  // AppendChunk chunk identity is block-local in state-store v0.
  applied_chunk_ids: readonly string[];
  checksum?: string | number;
}

export interface MessageState {
  message_id: string;
  role: AddMessage["role"];
  block_ids: readonly string[];
  created_at_ms: number;
  checksum: string | number;
}

export interface SessionState {
  session_version: number;
  blocks: Readonly<Record<string, BlockState>>;
  messages: Readonly<Record<string, MessageState>>;
}

export interface StateStoreSummary {
  session_version: number;
  block_count: number;
  message_count: number;
  sealed_block_count: number;
  total_text_length: number;
}

export type StateStoreDecision =
  | {
      accepted: true;
      state: SessionState;
      operation: RuntimeOperation;
      reason: string;
      errors: [];
      summary: StateStoreSummary;
    }
  | {
      accepted: false;
      state: SessionState;
      reason: string;
      errors: RuntimeErrorShape[];
      summary: StateStoreSummary;
    };

export function createEmptySessionState(initialVersion = 0): SessionState {
  if (!Number.isInteger(initialVersion) || initialVersion < 0) {
    throw new RangeError("initialVersion must be a finite non-negative integer");
  }

  return {
    session_version: initialVersion,
    blocks: {},
    messages: {}
  };
}

export function applyOperationToState(
  state: SessionState,
  op: Partial<RuntimeOperation> | Record<string, unknown>
): StateStoreDecision {
  const validation = validateOperation(op);
  if (!validation.valid) {
    return reject(state, "operation validation failed", validation.errors);
  }

  const operation = op as RuntimeOperation;
  if (operation.session_version < state.session_version) {
    return reject(
      state,
      `operation.session_version=${operation.session_version} is older than state.session_version=${state.session_version}`
    );
  }

  switch (operation.op_type) {
    case "AppendChunk":
      return applyAppendChunk(state, operation);
    case "SealBlock":
      return applySealBlock(state, operation);
    case "PatchRange":
      return applyPatchRange(state, operation);
    case "AddMessage":
      return applyAddMessage(state, operation);
    case "SetViewport":
    case "RequestProjection":
    case "CancelTransaction":
    case "CommitProjectionAck":
      return accept(advanceSessionVersion(state, operation.session_version), operation, "operation accepted as state no-op");
  }
}

export function applyOperationsToState(
  state: SessionState,
  ops: readonly (Partial<RuntimeOperation> | Record<string, unknown>)[]
): StateStoreDecision {
  let nextState = state;
  let lastDecision: StateStoreDecision | undefined;

  for (const op of ops) {
    lastDecision = applyOperationToState(nextState, op);
    if (!lastDecision.accepted) {
      return lastDecision;
    }
    nextState = lastDecision.state;
  }

  return lastDecision ?? accept(state, {
    op_type: "SetViewport",
    op_id: "noop",
    parent_action_id: "noop",
    session_version: state.session_version,
    checksum: "noop",
    visible_range: {
      start_block_id: "noop",
      end_block_id: "noop"
    },
    anchor: "noop",
    viewport_version: state.session_version
  }, "no operations provided");
}

export function getBlock(state: SessionState, block_id: string): BlockState | undefined {
  return state.blocks[block_id];
}

export function getMessage(state: SessionState, message_id: string): MessageState | undefined {
  return state.messages[message_id];
}

export function summarizeSessionState(state: SessionState): StateStoreSummary {
  const blocks = Object.values(state.blocks);
  return {
    session_version: state.session_version,
    block_count: blocks.length,
    message_count: Object.keys(state.messages).length,
    sealed_block_count: blocks.filter((block) => block.sealed).length,
    total_text_length: blocks.reduce((total, block) => total + block.length, 0)
  };
}

function applyAppendChunk(state: SessionState, op: AppendChunk): StateStoreDecision {
  if (typeof op.text_bytes_or_ref !== "string") {
    return reject(state, "AppendChunk requires inline text for state v0");
  }

  if (!isWellFormedUtf16(op.text_bytes_or_ref)) {
    return reject(state, "AppendChunk text must be well-formed UTF-16");
  }

  const block = state.blocks[op.block_id] ?? createEmptyBlock(op.block_id);
  if (block.sealed) {
    return reject(state, `cannot append to sealed block ${op.block_id}`);
  }

  if (block.applied_chunk_ids.includes(op.chunk_id)) {
    return reject(state, `chunk ${op.chunk_id} already applied to block ${op.block_id}`);
  }

  if (op.append_offset !== block.length) {
    return reject(state, `append_offset ${op.append_offset} does not match block length ${block.length}`);
  }

  const text = block.text + op.text_bytes_or_ref;
  const nextBlock: BlockState = {
    ...block,
    text,
    length: textOffsetLength(text),
    applied_chunk_ids: [...block.applied_chunk_ids, op.chunk_id],
    checksum: op.checksum
  };
  return accept(
    {
      ...state,
      session_version: Math.max(state.session_version, op.session_version),
      blocks: {
        ...state.blocks,
        [op.block_id]: nextBlock
      }
    },
    op,
    "AppendChunk applied"
  );
}

function applySealBlock(state: SessionState, op: SealBlock): StateStoreDecision {
  const block = state.blocks[op.block_id];
  if (block == null) {
    return reject(state, `block ${op.block_id} is required before SealBlock`);
  }

  if (op.final_length !== block.length) {
    return reject(state, `final_length ${op.final_length} does not match block length ${block.length}`);
  }

  return accept(
    {
      ...state,
      session_version: Math.max(state.session_version, op.session_version),
      blocks: {
        ...state.blocks,
        [op.block_id]: {
          ...block,
          sealed: true,
          checksum: op.checksum
        }
      }
    },
    op,
    "SealBlock applied"
  );
}

function applyPatchRange(state: SessionState, op: PatchRange): StateStoreDecision {
  const block = state.blocks[op.block_id];
  if (block == null) {
    return reject(state, `block ${op.block_id} is required before PatchRange`);
  }

  if (block.sealed) {
    return reject(state, `cannot patch sealed block ${op.block_id}`);
  }

  if (typeof op.replacement_ref !== "string") {
    return reject(state, "PatchRange requires inline replacement text for state v0");
  }

  if (!isWellFormedUtf16(op.replacement_ref)) {
    return reject(state, "PatchRange replacement text must be well-formed UTF-16");
  }

  if (op.start_offset > block.length || op.end_offset > block.length) {
    return reject(state, "PatchRange offsets exceed block length");
  }

  if (!isUtf16OffsetBoundary(block.text, op.start_offset) || !isUtf16OffsetBoundary(block.text, op.end_offset)) {
    return reject(state, "PatchRange offsets must align to UTF-16 code point boundaries");
  }

  const text = `${block.text.slice(0, op.start_offset)}${op.replacement_ref}${block.text.slice(op.end_offset)}`;
  return accept(
    {
      ...state,
      session_version: Math.max(state.session_version, op.session_version),
      blocks: {
        ...state.blocks,
        [op.block_id]: {
          ...block,
          text,
          length: textOffsetLength(text),
          checksum: op.checksum
        }
      }
    },
    op,
    "PatchRange applied"
  );
}

function applyAddMessage(state: SessionState, op: AddMessage): StateStoreDecision {
  if (state.messages[op.message_id] != null) {
    return reject(state, `message ${op.message_id} already exists`, "DuplicateMessageId");
  }

  const missingBlockId = op.block_ids.find((blockId) => state.blocks[blockId] == null);
  if (missingBlockId != null) {
    return reject(state, `block ${missingBlockId} is required before AddMessage`);
  }

  return accept(
    {
      ...state,
      session_version: Math.max(state.session_version, op.session_version),
      messages: {
        ...state.messages,
        [op.message_id]: {
          message_id: op.message_id,
          role: op.role,
          block_ids: [...op.block_ids],
          created_at_ms: op.created_at_ms,
          checksum: op.checksum
        }
      }
    },
    op,
    "AddMessage applied"
  );
}

function createEmptyBlock(block_id: string): BlockState {
  return {
    block_id,
    text: "",
    length: 0,
    sealed: false,
    applied_chunk_ids: []
  };
}

function textOffsetLength(text: string): number {
  return text.length;
}

function isUtf16OffsetBoundary(text: string, offset: number): boolean {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) {
    return false;
  }

  if (offset === 0 || offset === text.length) {
    return true;
  }

  return !(isHighSurrogate(text.charCodeAt(offset - 1)) && isLowSurrogate(text.charCodeAt(offset)));
}

function isWellFormedUtf16(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    if (isHighSurrogate(codeUnit)) {
      if (index + 1 >= text.length || !isLowSurrogate(text.charCodeAt(index + 1))) {
        return false;
      }
      index += 1;
      continue;
    }

    if (isLowSurrogate(codeUnit)) {
      return false;
    }
  }

  return true;
}

function isHighSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

function advanceSessionVersion(state: SessionState, sessionVersion: number): SessionState {
  const nextSessionVersion = Math.max(state.session_version, sessionVersion);
  if (nextSessionVersion === state.session_version) {
    return state;
  }

  return {
    ...state,
    session_version: nextSessionVersion
  };
}

function accept(state: SessionState, operation: RuntimeOperation, reason: string): StateStoreDecision {
  return {
    accepted: true,
    state,
    operation,
    reason,
    errors: [],
    summary: summarizeSessionState(state)
  };
}

function reject(
  state: SessionState,
  reason: string,
  errorCodeOrErrors: "AdmissionRejected" | "DuplicateMessageId" | RuntimeErrorShape[] = "AdmissionRejected"
): StateStoreDecision {
  const errors = Array.isArray(errorCodeOrErrors)
    ? errorCodeOrErrors
    : [
        createRuntimeError(errorCodeOrErrors, {
          detail: reason
        })
      ];

  return {
    accepted: false,
    state,
    reason,
    errors,
    summary: summarizeSessionState(state)
  };
}
