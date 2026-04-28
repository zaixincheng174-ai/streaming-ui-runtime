// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  estimateSerializedByteSize,
  estimateUtf8ByteLength,
  validateMessagePayloadForTransfer,
  validateSerializableValue
} from "../../runtime/core/message-serialization.ts";

function reasons(result) {
  return result.reasons;
}

test("valid primitive payloads pass", () => {
  assert.equal(validateSerializableValue(null).valid, true);
  assert.equal(validateSerializableValue(true).valid, true);
  assert.equal(validateSerializableValue(42).valid, true);
  assert.equal(validateSerializableValue("hello").valid, true);
});

test("valid nested plain object passes", () => {
  const result = validateSerializableValue({
    a: "alpha",
    b: {
      c: 1,
      d: false
    }
  });

  assert.equal(result.valid, true);
});

test("valid array payload passes", () => {
  assert.equal(validateSerializableValue(["a", 1, null, { ok: true }]).valid, true);
});

test("function payload fails closed", () => {
  const result = validateSerializableValue(() => "no");

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("unsupported-type"));
});

test("symbol payload fails closed", () => {
  const result = validateSerializableValue(Symbol("no"));

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("unsupported-type"));
});

test("bigint payload fails closed", () => {
  const result = validateSerializableValue(1n);

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("unsupported-type"));
});

test("undefined payload fails closed", () => {
  const result = validateSerializableValue(undefined);

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("unsupported-type"));
});

test("NaN and Infinity fail closed", () => {
  const nanResult = validateSerializableValue(Number.NaN);
  const infinityResult = validateSerializableValue(Number.POSITIVE_INFINITY);

  assert.equal(nanResult.valid, false);
  assert.ok(reasons(nanResult).includes("non-finite-number"));
  assert.equal(infinityResult.valid, false);
  assert.ok(reasons(infinityResult).includes("non-finite-number"));
});

test("cyclic object fails closed", () => {
  const value = { a: 1 };
  value.self = value;

  const result = validateSerializableValue(value);

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("cyclic-reference"));
});

test("class instance and non-plain object fail closed", () => {
  class Payload {
    value = 1;
  }

  const result = validateSerializableValue(new Payload());

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("non-plain-object"));
});

test("Date Map Set RegExp and Error fail closed", () => {
  const values = [new Date(), new Map(), new Set(), /x/, new Error("no")];

  for (const value of values) {
    const result = validateSerializableValue(value);
    assert.equal(result.valid, false);
    assert.ok(reasons(result).includes("non-plain-object"));
  }
});

test("string max bytes uses UTF-8 byte length not UTF-16 code units", () => {
  assert.equal(estimateUtf8ByteLength("a"), 1);
  assert.equal(estimateUtf8ByteLength("你"), 3);
  assert.equal(estimateUtf8ByteLength("😀"), 4);
});

test("CJK string over byte limit fails closed", () => {
  const result = validateSerializableValue("你".repeat(5), { max_string_bytes: 12 });

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("max-string-bytes-exceeded"));
});

test("emoji string over byte limit fails closed", () => {
  const result = validateSerializableValue("😀".repeat(5), { max_string_bytes: 12 });

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("max-string-bytes-exceeded"));
});

test("max_depth exceeded fails closed", () => {
  const result = validateSerializableValue({ a: { b: { c: 1 } } }, { max_depth: 2 });

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("max-depth-exceeded"));
});

test("max_array_length exceeded fails closed", () => {
  const result = validateSerializableValue([1, 2, 3], { max_array_length: 2 });

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("max-array-length-exceeded"));
});

test("max_object_keys exceeded fails closed", () => {
  const result = validateSerializableValue({ a: 1, b: 2, c: 3 }, { max_object_keys: 2 });

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("max-object-keys-exceeded"));
});

test("max_total_bytes exceeded fails closed", () => {
  const result = validateSerializableValue({ payload: "abcdef" }, { max_total_bytes: 10 });

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("max-total-bytes-exceeded"));
});

test("valid payload exactly at byte limit passes", () => {
  const value = { payload: "abc" };
  const estimated = estimateSerializedByteSize(value);
  assert.equal(estimated.valid, true);

  const result = validateSerializableValue(value, { max_total_bytes: estimated.byte_size });

  assert.equal(result.valid, true);
});

test("invalid limits fail closed when provided", () => {
  const result = validateSerializableValue("abc", { max_string_bytes: -1 });

  assert.equal(result.valid, false);
  assert.ok(reasons(result).includes("invalid-limit"));
});

test("validateMessagePayloadForTransfer mirrors serializable validation", () => {
  assert.equal(validateMessagePayloadForTransfer({ ok: true }).valid, true);
  assert.equal(validateMessagePayloadForTransfer(new Date()).valid, false);
});

test("source does not import or use blocked runtime APIs", () => {
  const source = readFileSync(new URL("../../runtime/core/message-serialization.ts", import.meta.url), "utf8");
  const forbiddenTokens = [
    "new " + "Worker" + "(",
    "self" + ".onmessage",
    "post" + "Message",
    "docu" + "ment",
    "win" + "dow",
    "from \"" + "react" + "\"",
    "from '" + "react" + "'",
    "HTML" + "CanvasElement",
    "Offscreen" + "Canvas",
    "Canvas" + "RenderingContext2D",
    "Web" + "GPU",
    "GPU" + "Device",
    "navigator" + ".gpu"
  ];

  for (const token of forbiddenTokens) {
    assert.equal(source.includes(token), false);
  }
});
