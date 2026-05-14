#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURES, runFixtureSimulation } from "../../bench/p1/lib/streaming_markdown_stability_core.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const files = {
  target: path.join(repoRoot, "bench/p1/targets/p1_streaming_markdown_stability_demo.html"),
  core: path.join(repoRoot, "bench/p1/lib/streaming_markdown_stability_core.mjs"),
  server: path.join(repoRoot, "scripts/p1/serve_p1_streaming_baselines.mjs"),
  readme: path.join(repoRoot, "README.md"),
  portfolioReadme: path.join(repoRoot, "docs/portfolio/README.md"),
  evidenceMap: path.join(repoRoot, "docs/portfolio/evidence-map.md"),
  documentStatusMap: path.join(repoRoot, "docs/portfolio/document-status-map.md"),
  applicationPack: path.join(repoRoot, "docs/portfolio/application-outreach-pack.md"),
  postAudit: path.join(repoRoot, "docs/portfolio/streaming-markdown-stability-demo-post-audit.md")
};

const targetNeedles = [
  "P1_STREAMING_MARKDOWN_STABILITY_DEMO",
  "Naive full reparse",
  "Stable tail block",
  "naive-completed-block-rerender-count",
  "stable-completed-block-rerender-count",
  "naive-approximate-node-churn",
  "stable-approximate-node-churn",
  "__P1_STREAMING_MARKDOWN_STABILITY_SUMMARY__"
];

const coreNeedles = [
  "incomplete-fenced-code",
  "gfm-table-stream",
  "latex-math-like-partial",
  "mixed-long-assistant-answer",
  "parseMarkdownBlocks",
  "createRenderRun",
  "completed_block_rerender_count",
  "approximate_node_churn",
  "average_update_time_ms",
  "max_update_time_ms"
];

const serverNeedles = [
  "/p1_streaming_markdown_stability_demo.html",
  "/p1_streaming_markdown_stability_core.mjs"
];

const docNeedles = [
  "streaming Markdown stability demo",
  "not a production Markdown library",
  "not a provider integration",
  "not browser-level INP",
  "does not compare against external Markdown libraries"
];

const forbiddenPatterns = [
  { pattern: /new\s+Worker\b/, label: "Worker implementation" },
  { pattern: /OffscreenCanvas\b/, label: "OffscreenCanvas implementation" },
  { pattern: /navigator\.gpu\b|\bWebGPU\b/i, label: "WebGPU implementation" },
  { pattern: /<canvas\b|\.getContext\s*\(/i, label: "canvas renderer" },
  { pattern: /\bOpenAI\b|\bAnthropic\b/, label: "provider API reference" },
  { pattern: /\bapi[_-]?key\b|\bAuthorization:\s*Bearer\b/i, label: "credential/API key surface" },
  { pattern: /\bStreamdown\b/, label: "external-library comparison by name" },
  { pattern: /\bproduction-ready\b/i, label: "production-readiness claim" },
  { pattern: /\bsuperior to\b|\bbeats\b|\boutperforms\b/i, label: "superiority claim" },
  { pattern: /\bpublished\s+npm\b|\bnpm\s+install\b|\bpackage distribution\b/i, label: "package/distribution claim" }
];

const errors = [];

for (const [label, filePath] of Object.entries(files)) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing ${label}: ${filePath}`);
  }
}

const target = readIfPresent(files.target);
const core = readIfPresent(files.core);
const server = readIfPresent(files.server);
const docs = [
  files.readme,
  files.portfolioReadme,
  files.evidenceMap,
  files.documentStatusMap,
  files.applicationPack,
  files.postAudit
].map(readIfPresent).join("\n");

errors.push(...missingNeedles(target, targetNeedles, "target"));
errors.push(...missingNeedles(core, coreNeedles, "core"));
errors.push(...missingNeedles(server, serverNeedles, "server route"));
errors.push(...missingNeedles(docs, docNeedles, "docs"));

const newSurfaceText = [target, core, readIfPresent(files.postAudit)].join("\n");
for (const { pattern, label } of forbiddenPatterns) {
  if (pattern.test(newSurfaceText)) {
    errors.push(`forbidden ${label}: ${pattern}`);
  }
}

for (const fixture of FIXTURES) {
  const simulation = runFixtureSimulation(fixture.id);
  if (simulation.naive.metrics.render_count !== fixture.chunks.length) {
    errors.push(`fixture ${fixture.id} naive render count does not match chunk count`);
  }
  if (simulation.stable.metrics.render_count !== fixture.chunks.length) {
    errors.push(`fixture ${fixture.id} stable render count does not match chunk count`);
  }
  if (simulation.naive.metrics.semantic_hash !== simulation.stable.metrics.semantic_hash) {
    errors.push(`fixture ${fixture.id} final semantic hashes diverge`);
  }
  if (
    simulation.stable.metrics.completed_block_rerender_count >
    simulation.naive.metrics.completed_block_rerender_count
  ) {
    errors.push(`fixture ${fixture.id} stable completed-block re-render count exceeds naive`);
  }
}

if (errors.length > 0) {
  console.error("Streaming Markdown stability demo audit failures:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Streaming Markdown Stability Demo Contract Audit");
console.log(`target=${files.target}`);
console.log(`core=${files.core}`);
console.log(`fixture_count=${FIXTURES.length}`);
console.log(`fixture_ids=${FIXTURES.map((fixture) => fixture.id).join(",")}`);
console.log("local_url=http://127.0.0.1:4319/p1_streaming_markdown_stability_demo.html");
console.log("AUDIT_STATUS=PASS");

function readIfPresent(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function missingNeedles(content, needles, label) {
  return needles
    .filter((needle) => !content.includes(needle))
    .map((needle) => `missing ${label}: ${needle}`);
}
