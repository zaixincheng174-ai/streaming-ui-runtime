import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  FIXTURES,
  buildSourceThroughChunk,
  parseMarkdownBlocks,
  runFixtureSimulation
} from "../../bench/p1/lib/streaming_markdown_stability_core.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const targetPath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_streaming_markdown_stability_demo.html", import.meta.url)
);
const corePath = fileURLToPath(
  new URL("../../bench/p1/lib/streaming_markdown_stability_core.mjs", import.meta.url)
);
const auditPath = fileURLToPath(
  new URL("../../scripts/p1/audit_streaming_markdown_stability_demo.mjs", import.meta.url)
);

const REQUIRED_FIXTURE_IDS = [
  "incomplete-fenced-code",
  "gfm-table-stream",
  "latex-math-like-partial",
  "mixed-long-assistant-answer"
];

test("streaming Markdown demo files exist", () => {
  assert.equal(fs.existsSync(targetPath), true);
  assert.equal(fs.existsSync(corePath), true);
  assert.equal(fs.existsSync(auditPath), true);
});

test("required fixtures are present", () => {
  const fixtureIds = FIXTURES.map((fixture) => fixture.id);
  assert.deepEqual(fixtureIds, REQUIRED_FIXTURE_IDS);
  for (const fixture of FIXTURES) {
    assert.ok(fixture.chunks.length >= 5, `${fixture.id} should be chunked`);
  }
});

test("incomplete fenced code remains tail-only until the closing fence arrives", () => {
  const fixture = FIXTURES.find((candidate) => candidate.id === "incomplete-fenced-code");
  const openBlocks = parseMarkdownBlocks(buildSourceThroughChunk(fixture, 3));
  const openCode = openBlocks.find((block) => block.type === "code");
  assert.equal(openCode.complete, false);

  const closedBlocks = parseMarkdownBlocks(buildSourceThroughChunk(fixture, 4));
  const closedCode = closedBlocks.find((block) => block.type === "code");
  assert.equal(closedCode.complete, true);
});

test("GFM table stays uncommitted while streamed across chunks and commits after a blank boundary", () => {
  const fixture = FIXTURES.find((candidate) => candidate.id === "gfm-table-stream");
  const partialBlocks = parseMarkdownBlocks(buildSourceThroughChunk(fixture, 4));
  const partialTable = partialBlocks.find((block) => block.type === "table");
  assert.equal(partialTable.complete, false);
  assert.equal(partialTable.rows.length, 2);

  const finalBlocks = parseMarkdownBlocks(buildSourceThroughChunk(fixture, 5), { final: true });
  const finalTable = finalBlocks.find((block) => block.type === "table");
  assert.equal(finalTable.complete, true);
  assert.equal(finalTable.rows.length, 2);
});

test("math-like partial input remains text and block math commits only after closing delimiter", () => {
  const fixture = FIXTURES.find((candidate) => candidate.id === "latex-math-like-partial");
  const inlinePartialBlocks = parseMarkdownBlocks(buildSourceThroughChunk(fixture, 0));
  const partialParagraph = inlinePartialBlocks.find((block) => block.type === "paragraph");
  assert.match(partialParagraph.text, /\\Delta$/);
  assert.equal(partialParagraph.complete, false);

  const openMathBlocks = parseMarkdownBlocks(buildSourceThroughChunk(fixture, 3));
  const openMath = openMathBlocks.find((block) => block.type === "math_block");
  assert.equal(openMath.complete, false);

  const closedMathBlocks = parseMarkdownBlocks(buildSourceThroughChunk(fixture, 4));
  const closedMath = closedMathBlocks.find((block) => block.type === "math_block");
  assert.equal(closedMath.complete, true);
});

test("mixed long assistant answer covers prose, list, table, code, and math-like text", () => {
  const fixture = FIXTURES.find((candidate) => candidate.id === "mixed-long-assistant-answer");
  const blocks = parseMarkdownBlocks(buildSourceThroughChunk(fixture, fixture.chunks.length - 1), { final: true });
  const blockTypes = new Set(blocks.map((block) => block.type));
  for (const type of ["heading", "paragraph", "list", "table", "code"]) {
    assert.equal(blockTypes.has(type), true, `missing block type ${type}`);
  }
  assert.ok(blocks.some(
    (block) => block.type === "paragraph" && block.text.includes(String.raw`$s = \alpha x + \beta y$`)
  ));
});

test("stable tail-block mode preserves final semantics and reduces completed-block churn", () => {
  for (const fixture of FIXTURES) {
    const simulation = runFixtureSimulation(fixture.id);
    assert.equal(simulation.naive.metrics.render_count, fixture.chunks.length);
    assert.equal(simulation.stable.metrics.render_count, fixture.chunks.length);
    assert.equal(
      simulation.naive.metrics.semantic_hash,
      simulation.stable.metrics.semantic_hash,
      `${fixture.id} semantic hash mismatch`
    );
    assert.ok(
      simulation.stable.metrics.completed_block_rerender_count < simulation.naive.metrics.completed_block_rerender_count,
      `${fixture.id} stable completed-block churn should be lower`
    );
    assert.ok(
      simulation.stable.metrics.approximate_node_churn < simulation.naive.metrics.approximate_node_churn,
      `${fixture.id} stable approximate node churn should be lower`
    );
  }
});

test("demo target exposes visible modes and required metrics", () => {
  const html = fs.readFileSync(targetPath, "utf8");
  for (const needle of [
    "Naive full reparse",
    "Stable tail block",
    "render count",
    "completed-block re-render count",
    "approximate node churn",
    "avg / max update ms",
    "__P1_STREAMING_MARKDOWN_STABILITY_SUMMARY__"
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("demo audit script passes", () => {
  const output = execFileSync(process.execPath, [auditPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.match(output, /AUDIT_STATUS=PASS/);
  assert.match(output, /fixture_count=4/);
  assert.match(output, /p1_streaming_markdown_stability_demo\.html/);
});
