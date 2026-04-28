import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";
import {
  validateMessagePayloadForTransfer,
  type SerializationValidationOptions
} from "./message-serialization.ts";
import { isPriorityLane, type PriorityLane } from "./priorities.ts";

export type ProtocolVersion = "p2.v1";
export const CURRENT_PROTOCOL_VERSION: ProtocolVersion = "p2.v1";

export type MessageId = string;

export interface TraceContext {
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  capture_id?: string;
}

export const MESSAGE_TYPES = [
  "operation",
  "transaction",
  "projection-request",
  "cancel-transaction",
  "commit-projection-ack",
  "projection-result",
  "transaction-status",
  "error-report",
  "metrics-snapshot"
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export interface MessageEnvelope<TPayload = unknown> {
  protocol_version: ProtocolVersion;
  message_id: MessageId;
  message_type: MessageType;
  parent_action_id: string;
  session_id: string;
  session_version: number;
  created_at_ms: number;
  priority: PriorityLane;
  source: "main" | "worker";
  target: "main" | "worker";
  payload: TPayload;
  checksum: string | number;
  trace_context: TraceContext;
}

export type RuntimeMessage<TPayload = unknown> = MessageEnvelope<TPayload>;
export type MainToWorkerMessage<TPayload = unknown> = MessageEnvelope<TPayload> & {
  source: "main";
  target: "worker";
};
export type WorkerToMainMessage<TPayload = unknown> = MessageEnvelope<TPayload> & {
  source: "worker";
  target: "main";
};

export type DuplicateMessageIdPolicy = "reject" | "idempotent";

export type ValidationResult =
  | { valid: true; errors: []; duplicate_message_id?: boolean }
  | { valid: false; errors: RuntimeErrorShape[]; duplicate_message_id?: boolean };

export interface MessageEnvelopeValidationOptions {
  supported_versions?: readonly ProtocolVersion[];
  seen_message_ids?: ReadonlySet<string>;
  duplicate_message_id_policy?: DuplicateMessageIdPolicy;
  validate_payload_serializable?: boolean;
  payload_serialization_options?: SerializationValidationOptions;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessageType(value: unknown): value is MessageType {
  return typeof value === "string" && (MESSAGE_TYPES as readonly string[]).includes(value);
}

function isEndpoint(value: unknown): value is "main" | "worker" {
  return value === "main" || value === "worker";
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isChecksumValue(value: unknown): value is string | number {
  return (typeof value === "string" && value.length > 0) || (typeof value === "number" && Number.isFinite(value));
}

function envelopeLineage(message: Record<string, unknown>): Partial<RuntimeErrorShape> {
  return {
    ...(typeof message.message_id === "string" && message.message_id.length > 0
      ? { message_id: message.message_id }
      : {}),
    ...(typeof message.parent_action_id === "string" && message.parent_action_id.length > 0
      ? { parent_action_id: message.parent_action_id }
      : {}),
    ...(isRecord(message.trace_context) ? { trace_context: message.trace_context } : {})
  };
}

function addEnvelopeLineage(
  errors: readonly RuntimeErrorShape[],
  message: Record<string, unknown>
): RuntimeErrorShape[] {
  const lineage = envelopeLineage(message);
  return errors.map((error) => ({
    ...error,
    message_id: error.message_id ?? lineage.message_id,
    parent_action_id: error.parent_action_id ?? lineage.parent_action_id,
    trace_context: error.trace_context ?? lineage.trace_context
  }));
}

export function validateMessageEnvelope(
  message: unknown,
  options: MessageEnvelopeValidationOptions = {}
): ValidationResult {
  const supportedVersions = options.supported_versions ?? [CURRENT_PROTOCOL_VERSION];
  const duplicatePolicy = options.duplicate_message_id_policy ?? "reject";
  const errors: RuntimeErrorShape[] = [];

  if (!isRecord(message)) {
    return {
      valid: false,
      errors: [
        createRuntimeError("MissingRequiredField", {
          detail: "message envelope must be an object"
        })
      ]
    };
  }

  const requiredFields = [
    "protocol_version",
    "message_id",
    "message_type",
    "parent_action_id",
    "session_id",
    "session_version",
    "created_at_ms",
    "priority",
    "source",
    "target",
    "payload",
    "checksum",
    "trace_context"
  ] as const;

  for (const field of requiredFields) {
    if (!hasOwn(message, field) || message[field] == null || message[field] === "") {
      errors.push(
        createRuntimeError(field === "checksum" ? "InvalidChecksum" : "MissingRequiredField", {
          detail: `${field} is required`
        })
      );
    }
  }

  if (hasOwn(message, "protocol_version") && !supportedVersions.includes(message.protocol_version as ProtocolVersion)) {
    errors.push(
      createRuntimeError("ProtocolVersionUnsupported", {
        detail: `unsupported protocol_version=${String(message.protocol_version)}`
      })
    );
  }

  if (hasOwn(message, "message_type") && !isMessageType(message.message_type)) {
    errors.push(
      createRuntimeError("UnknownMessageType", {
        detail: `unknown message_type=${String(message.message_type)}`
      })
    );
  }

  if (hasOwn(message, "priority") && !isPriorityLane(message.priority)) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        detail: `unsupported priority=${String(message.priority)}`
      })
    );
  }

  if (hasOwn(message, "source") && !isEndpoint(message.source)) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        detail: `unsupported source=${String(message.source)}`
      })
    );
  }

  if (hasOwn(message, "target") && !isEndpoint(message.target)) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        detail: `unsupported target=${String(message.target)}`
      })
    );
  }

  if (hasOwn(message, "session_version") && !isFiniteNonNegativeInteger(message.session_version)) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        detail: `session_version must be a finite non-negative integer`
      })
    );
  }

  if (hasOwn(message, "created_at_ms") && !isFiniteNonNegativeNumber(message.created_at_ms)) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        detail: `created_at_ms must be a finite non-negative number`
      })
    );
  }

  if (hasOwn(message, "trace_context") && !isRecord(message.trace_context)) {
    errors.push(
      createRuntimeError("MissingRequiredField", {
        detail: "trace_context must be a non-null object"
      })
    );
  }

  if (hasOwn(message, "checksum") && !isChecksumValue(message.checksum)) {
    errors.push(
      createRuntimeError("InvalidChecksum", {
        detail: "checksum is missing or invalid"
      })
    );
  }

  if (options.validate_payload_serializable === true && hasOwn(message, "payload")) {
    const payloadValidation = validateMessagePayloadForTransfer(
      message.payload,
      options.payload_serialization_options
    );
    if (!payloadValidation.valid) {
      errors.push(...payloadValidation.errors);
    }
  }

  const messageId = typeof message.message_id === "string" ? message.message_id : undefined;
  const duplicate = messageId != null && options.seen_message_ids?.has(messageId) === true;
  if (duplicate && duplicatePolicy === "reject") {
    errors.push(
      createRuntimeError("DuplicateMessageId", {
        message_id: messageId,
        detail: `duplicate message_id=${messageId}`
      })
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors: addEnvelopeLineage(errors, message), duplicate_message_id: duplicate || undefined };
  }

  return { valid: true, errors: [], duplicate_message_id: duplicate || undefined };
}
