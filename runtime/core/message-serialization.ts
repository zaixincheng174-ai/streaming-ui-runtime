import { createRuntimeError, type RuntimeErrorShape } from "./errors.ts";

export type SerializablePrimitive = null | boolean | number | string;
export type SerializableValue =
  | SerializablePrimitive
  | readonly SerializableValue[]
  | { readonly [key: string]: SerializableValue };

export interface SerializationValidationOptions {
  max_depth?: number;
  max_array_length?: number;
  max_object_keys?: number;
  max_string_bytes?: number;
  max_total_bytes?: number;
}

export type SerializationFailureReason =
  | "invalid-limit"
  | "unsupported-type"
  | "non-finite-number"
  | "cyclic-reference"
  | "non-plain-object"
  | "max-depth-exceeded"
  | "max-array-length-exceeded"
  | "max-object-keys-exceeded"
  | "max-string-bytes-exceeded"
  | "max-total-bytes-exceeded";

export type SerializationValidationResult =
  | { valid: true; errors: []; reasons: []; byte_size: number }
  | { valid: false; errors: RuntimeErrorShape[]; reasons: SerializationFailureReason[]; byte_size?: number };

export function estimateUtf8ByteLength(value: string): number {
  return utf8ByteCounter.encode(value).length;
}

export function validateSerializableValue(
  value: unknown,
  options: SerializationValidationOptions = {}
): SerializationValidationResult {
  const limitValidation = validateLimits(options);
  if (!limitValidation.valid) {
    return limitValidation;
  }

  const state: SerializationState = {
    options,
    seen: new WeakSet<object>()
  };
  const result = visitSerializableValue(value, 0, state);
  if (!result.valid) {
    return result;
  }

  if (options.max_total_bytes != null && result.byte_size > options.max_total_bytes) {
    return invalid(
      `serialized payload byte size ${result.byte_size} exceeds max_total_bytes ${options.max_total_bytes}`,
      "max-total-bytes-exceeded"
    );
  }

  return result;
}

export function estimateSerializedByteSize(
  value: unknown,
  options: SerializationValidationOptions = {}
): SerializationValidationResult {
  return validateSerializableValue(value, options);
}

export function validateMessagePayloadForTransfer(
  payload: unknown,
  options: SerializationValidationOptions = {}
): SerializationValidationResult {
  return validateSerializableValue(payload, options);
}

interface SerializationState {
  options: SerializationValidationOptions;
  seen: WeakSet<object>;
}

function validateLimits(options: SerializationValidationOptions): SerializationValidationResult {
  for (const [key, value] of Object.entries(options)) {
    if (value == null) {
      continue;
    }
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      return invalid(`${key} must be a finite non-negative integer`, "invalid-limit");
    }
  }

  return { valid: true, errors: [], reasons: [], byte_size: 0 };
}

function visitSerializableValue(
  value: unknown,
  depth: number,
  state: SerializationState
): SerializationValidationResult {
  if (state.options.max_depth != null && depth > state.options.max_depth) {
    return invalid(`payload exceeds max_depth ${state.options.max_depth}`, "max-depth-exceeded");
  }

  if (value === null) {
    return validByteSize(4);
  }

  switch (typeof value) {
    case "boolean":
      return validByteSize(value ? 4 : 5);
    case "number":
      if (!Number.isFinite(value)) {
        return invalid("number payload values must be finite", "non-finite-number");
      }
      return validByteSize(estimateUtf8ByteLength(JSON.stringify(value)));
    case "string":
      return visitString(value, state.options);
    case "undefined":
    case "function":
    case "symbol":
    case "bigint":
      return invalid(`unsupported payload type ${typeof value}`, "unsupported-type");
    case "object":
      return visitObject(value, depth, state);
    default:
      return invalid(`unsupported payload type ${typeof value}`, "unsupported-type");
  }
}

function visitString(value: string, options: SerializationValidationOptions): SerializationValidationResult {
  const rawByteLength = estimateUtf8ByteLength(value);
  if (options.max_string_bytes != null && rawByteLength > options.max_string_bytes) {
    return invalid(
      `string byte length ${rawByteLength} exceeds max_string_bytes ${options.max_string_bytes}`,
      "max-string-bytes-exceeded"
    );
  }

  return validByteSize(estimateUtf8ByteLength(JSON.stringify(value)));
}

function visitObject(
  value: object,
  depth: number,
  state: SerializationState
): SerializationValidationResult {
  if (state.seen.has(value)) {
    return invalid("cyclic payload values are not serializable", "cyclic-reference");
  }
  state.seen.add(value);

  const result = Array.isArray(value) ? visitArray(value, depth, state) : visitPlainObject(value, depth, state);
  state.seen.delete(value);
  return result;
}

function visitArray(
  value: readonly unknown[],
  depth: number,
  state: SerializationState
): SerializationValidationResult {
  if (state.options.max_array_length != null && value.length > state.options.max_array_length) {
    return invalid(
      `array length ${value.length} exceeds max_array_length ${state.options.max_array_length}`,
      "max-array-length-exceeded"
    );
  }

  let byteSize = 2;
  for (let index = 0; index < value.length; index += 1) {
    const child = visitSerializableValue(value[index], depth + 1, state);
    if (!child.valid) {
      return child;
    }
    byteSize += child.byte_size;
    if (index > 0) {
      byteSize += 1;
    }
  }

  return validByteSize(byteSize);
}

function visitPlainObject(
  value: object,
  depth: number,
  state: SerializationState
): SerializationValidationResult {
  if (!isPlainObject(value)) {
    return invalid("payload objects must be plain objects", "non-plain-object");
  }

  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  if (state.options.max_object_keys != null && entries.length > state.options.max_object_keys) {
    return invalid(
      `object key count ${entries.length} exceeds max_object_keys ${state.options.max_object_keys}`,
      "max-object-keys-exceeded"
    );
  }

  let byteSize = 2;
  for (let index = 0; index < entries.length; index += 1) {
    const [key, childValue] = entries[index];
    const child = visitSerializableValue(childValue, depth + 1, state);
    if (!child.valid) {
      return child;
    }
    byteSize += estimateUtf8ByteLength(JSON.stringify(key));
    byteSize += 1;
    byteSize += child.byte_size;
    if (index > 0) {
      byteSize += 1;
    }
  }

  return validByteSize(byteSize);
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validByteSize(byte_size: number): SerializationValidationResult {
  return {
    valid: true,
    errors: [],
    reasons: [],
    byte_size
  };
}

function invalid(detail: string, reason: SerializationFailureReason): SerializationValidationResult {
  return {
    valid: false,
    errors: [
      createRuntimeError("MissingRequiredField", {
        detail
      })
    ],
    reasons: [reason]
  };
}

// Minimal ambient type for UTF-8 byte counting. TextEncoder is present in
// modern JS runtimes and avoids pulling DOM or browser libs into core types.
declare const TextEncoder: {
  new (): { encode(input?: string): { length: number } };
};

const utf8ByteCounter = new TextEncoder();
