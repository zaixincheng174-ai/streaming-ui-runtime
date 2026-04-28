#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const allowedRuntimeFiles = new Set([
  "runtime/core/protocol.ts",
  "runtime/core/ops.ts",
  "runtime/core/transactions.ts",
  "runtime/core/priorities.ts",
  "runtime/core/scheduler-policy.ts",
  "runtime/core/projection-policy.ts",
  "runtime/core/backpressure-policy.ts",
  "runtime/core/op-validation.ts",
  "runtime/core/transaction-validation.ts",
  "runtime/core/core-decision.ts",
  "runtime/core/op-log.ts",
  "runtime/core/transaction-lifecycle.ts",
  "runtime/core/core-engine.ts",
  "runtime/core/decision-trace.ts",
  "runtime/core/metrics-snapshot.ts",
  "runtime/core/recovery-policy.ts",
  "runtime/core/message-serialization.ts",
  "runtime/core/state-store.ts",
  "runtime/core/checksums.ts",
  "runtime/core/errors.ts",
  "runtime/main/main-projection-adapter.ts",
  "runtime/testing/in-memory-roundtrip.ts",
  "runtime/testing/in-memory-session-scenario.ts",
  "runtime/worker/worker-context.ts",
  "runtime/worker/worker-message-handler.ts"
]);

const allowedRuntimeTests = new Set([
  "tests/runtime/protocol-validation.test.ts",
  "tests/runtime/checksum-fail-closed.test.ts",
  "tests/runtime/scheduler-priority.test.ts",
  "tests/runtime/projection-policy.test.ts",
  "tests/runtime/backpressure-policy.test.ts",
  "tests/runtime/op-validation.test.ts",
  "tests/runtime/transaction-validation.test.ts",
  "tests/runtime/core-decision.test.ts",
  "tests/runtime/op-log.test.ts",
  "tests/runtime/transaction-lifecycle.test.ts",
  "tests/runtime/core-engine.test.ts",
  "tests/runtime/core-engine-state-store.test.ts",
  "tests/runtime/decision-trace.test.ts",
  "tests/runtime/metrics-snapshot.test.ts",
  "tests/runtime/recovery-policy.test.ts",
  "tests/runtime/message-serialization.test.ts",
  "tests/runtime/state-store.test.ts",
  "tests/runtime/main-projection-adapter.test.ts",
  "tests/runtime/in-memory-roundtrip.test.ts",
  "tests/runtime/in-memory-session-scenario.test.ts",
  "tests/runtime/worker-main-adapter-contract.test.ts",
  "tests/runtime/worker-message-handler.test.ts"
]);

const forbiddenPatterns = [
  { label: "React import", pattern: /\bfrom\s+["']react["']|\bimport\s+React\b|\brequire\(["']react["']\)/ },
  { label: "DOM global document", pattern: /\bdocument\b/ },
  { label: "DOM global window", pattern: /\bwindow\b/ },
  { label: "Worker constructor", pattern: /\bnew\s+(?:(?:globalThis|self)\.)?Worker\s*\(|\b(?:globalThis|self)\.Worker\s*\(/ },
  { label: "Worker message handler", pattern: /\bself\.onmessage\b|\b(?:self|globalThis)\.addEventListener\s*\(\s*["']message["']|\baddEventListener\s*\(\s*["']message["']/ },
  { label: "Worker response sender", pattern: /\bpostMessage\b/ },
  { label: "Canvas API", pattern: /\bHTMLCanvasElement\b|\bOffscreenCanvas\b|\bCanvasRenderingContext2D\b|\bWebGLRenderingContext\b|\bWebGL2RenderingContext\b|\bWebGL\b|\bwebgl2?\b/ },
  { label: "WebGPU API", pattern: /\bWebGPU\b|\bGPUDevice\b|\bGPUAdapter\b|\bGPUCanvasContext\b|\bGPUBuffer\b|\bGPUTexture\b|\bnavigator\.gpu\b/ },
  { label: "P1 benchmark import", pattern: /(?:^|["'`])(?:\.\.\/)*bench\/p1\/|(?:^|["'`])(?:\.\.\/)*scripts\/p1\// },
  { label: "capture tooling", pattern: /\brun_single_capture_no_warmup\b|\bTracing\.start\b|\bChrome\b|\bCDP\b/ },
  { label: "product-specific import", pattern: /(?:^|["'`])(?:\.\.\/)*product(?:\/|["'`])/ }
];

function toRepoRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function listFiles(dirPath) {
  if (!existsSync(dirPath)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function fail(errors) {
  console.error("P2_RUNTIME_GUARD_FAILED");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const errors = [];
const runtimeDir = path.join(repoRoot, "runtime");
const runtimeTestsDir = path.join(repoRoot, "tests", "runtime");
const runtimeFiles = listFiles(runtimeDir);
const runtimeTestFiles = listFiles(runtimeTestsDir);

for (const filePath of runtimeFiles) {
  const relativePath = toRepoRelative(filePath);
  if (!allowedRuntimeFiles.has(relativePath)) {
    errors.push(`forbidden runtime file: ${relativePath}`);
  }
}

for (const filePath of runtimeTestFiles) {
  const relativePath = toRepoRelative(filePath);
  if (!allowedRuntimeTests.has(relativePath)) {
    errors.push(`forbidden runtime test file: ${relativePath}`);
  }
}

for (const filePath of [...runtimeFiles, ...runtimeTestFiles]) {
  const relativePath = toRepoRelative(filePath);
  const source = readFileSync(filePath, "utf8");
  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(source)) {
      errors.push(`${label} found in ${relativePath}`);
    }
  }
}

if (errors.length > 0) {
  fail(errors);
}

console.log("P2_RUNTIME_GUARDS_OK runtime_absent_or_schema_only=true tests_runtime_absent_or_schema_only=true");
