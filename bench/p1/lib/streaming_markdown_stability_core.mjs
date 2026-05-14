export const DEMO_ID = "P1_STREAMING_MARKDOWN_STABILITY_DEMO";

export const RENDER_MODES = {
  naive: "naive-full-reparse",
  stable: "stable-tail-block"
};

export const FIXTURES = [
  {
    id: "incomplete-fenced-code",
    label: "Incomplete fenced code",
    description: "A fenced code block remains mutable until the closing fence arrives.",
    chunks: [
      "# Code review note\n\nThe assistant starts a TypeScript block.\n\n",
      "```ts\n",
      "const total = rows.reduce((sum, row) => sum + row.amount, 0);\n",
      "return total.toFixed(2);\n",
      "```\n\n",
      "After the fence closes, earlier prose and code should remain stable.\n"
    ]
  },
  {
    id: "gfm-table-stream",
    label: "GFM table stream",
    description: "A table is streamed across header, separator, and row chunks before a blank line commits it.",
    chunks: [
      "# Reconciliation table\n\n",
      "| Account | Status | Delta |\n",
      "| --- | ---: | ---: |\n",
      "| Cash | reviewed | 0 |\n",
      "| AR | needs ask | 1842 |\n",
      "\nReviewer note: the table is complete after the blank line.\n"
    ]
  },
  {
    id: "latex-math-like-partial",
    label: "LaTeX/math-like partial",
    description: "Math-like text is treated as text while inline and block delimiters arrive over time.",
    chunks: [
      "# Variance formula\n\nThe run tracks $\\Delta",
      " = \\frac{actual - prior}{prior}$ while tokens are still arriving.\n\n",
      "$$\n",
      "confidence = \\sum_i w_i x_i\n",
      "$$\n\n",
      "This demo does not render TeX; it only keeps the streamed text stable.\n"
    ]
  },
  {
    id: "mixed-long-assistant-answer",
    label: "Mixed long assistant answer",
    description: "A longer answer mixes prose, list items, a table, code, and math-like text.",
    chunks: [
      "# Close-pack review summary\n\n",
      "The assistant is drafting a review note with multiple block types.\n\n- Validate source exports\n- Compare prior period mapping\n",
      "- Preserve reviewer ask items\n\n| Area | Signal | Action |\n| --- | --- | --- |\n",
      "| Cash | clean | no ask |\n| AR | variance | ask client |\n\n",
      "```json\n{\n  \"client\": \"sample-co\",\n  \"open_items\": 2\n}\n```\n\n",
      "Use score $s = \\alpha x + \\beta y$ as text-only math notation.\n\nThe stable renderer should avoid touching completed blocks while this tail paragraph grows."
    ]
  }
];

const TABLE_SEPARATOR_RE = /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;

export function getFixture(fixtureId) {
  const fixture = FIXTURES.find((candidate) => candidate.id === fixtureId);
  if (!fixture) {
    throw new Error(`Unknown streaming Markdown fixture: ${fixtureId}`);
  }
  return fixture;
}

export function buildSourceThroughChunk(fixture, chunkIndex) {
  return fixture.chunks.slice(0, chunkIndex + 1).join("");
}

export function runFixtureSimulation(fixtureId) {
  const fixture = getFixture(fixtureId);
  const naive = createRenderRun(RENDER_MODES.naive, fixture.id);
  const stable = createRenderRun(RENDER_MODES.stable, fixture.id);

  for (let index = 0; index < fixture.chunks.length; index += 1) {
    const isFinal = index === fixture.chunks.length - 1;
    applyChunkToRun(naive, fixture.chunks[index], { isFinal });
    applyChunkToRun(stable, fixture.chunks[index], { isFinal });
  }

  return {
    fixture_id: fixture.id,
    naive: summarizeRun(naive),
    stable: summarizeRun(stable)
  };
}

export function createRenderRun(mode, fixtureId) {
  if (!Object.values(RENDER_MODES).includes(mode)) {
    throw new Error(`Unknown render mode: ${mode}`);
  }

  return {
    mode,
    fixture_id: fixtureId,
    source: "",
    chunk_index: -1,
    completed_seen_keys: new Set(),
    stable_committed_keys: new Set(),
    metrics: {
      render_count: 0,
      completed_block_render_count: 0,
      completed_block_rerender_count: 0,
      approximate_node_churn: 0,
      total_update_time_ms: 0,
      average_update_time_ms: 0,
      max_update_time_ms: 0,
      latest_update_time_ms: 0,
      committed_block_count: 0,
      tail_block_render_count: 0,
      semantic_hash: 0
    },
    latest_blocks: []
  };
}

export function applyChunkToRun(run, chunk, options = {}) {
  const isFinal = options.isFinal === true;
  run.chunk_index += 1;
  run.source += chunk;

  const blocks = parseMarkdownBlocks(run.source, { final: isFinal });
  const update = estimateUpdate(run, blocks);
  const metrics = run.metrics;

  metrics.render_count += 1;
  metrics.completed_block_render_count += update.completed_block_render_count;
  metrics.completed_block_rerender_count += update.completed_block_rerender_count;
  metrics.approximate_node_churn += update.approximate_node_churn;
  metrics.tail_block_render_count += update.tail_block_render_count;
  metrics.committed_block_count = update.committed_block_count;
  metrics.latest_update_time_ms = update.update_time_ms;
  metrics.total_update_time_ms += update.update_time_ms;
  metrics.average_update_time_ms = roundMetric(metrics.total_update_time_ms / metrics.render_count);
  metrics.max_update_time_ms = Math.max(metrics.max_update_time_ms, update.update_time_ms);
  metrics.semantic_hash = semanticHash(blocks);

  for (const block of blocks) {
    if (block.complete) {
      run.completed_seen_keys.add(block.key);
    }
  }

  run.latest_blocks = blocks;

  return {
    blocks,
    update,
    metrics: summarizeMetrics(metrics)
  };
}

function estimateUpdate(run, blocks) {
  const completedBlocks = blocks.filter((block) => block.complete);
  const tailBlocks = blocks.filter((block) => !block.complete);
  const allNodeCount = blocks.reduce((sum, block) => sum + estimateBlockNodeCount(block), 0);
  let completedBlockRenderCount = 0;
  let completedBlockRerenderCount = 0;
  let approximateNodeChurn = 0;
  let tailBlockRenderCount = tailBlocks.length;

  if (run.mode === RENDER_MODES.naive) {
    completedBlockRenderCount = completedBlocks.length;
    for (const block of completedBlocks) {
      if (run.completed_seen_keys.has(block.key)) {
        completedBlockRerenderCount += 1;
      }
    }
    approximateNodeChurn = allNodeCount;
  } else {
    for (const block of completedBlocks) {
      if (!run.stable_committed_keys.has(block.key)) {
        completedBlockRenderCount += 1;
        approximateNodeChurn += estimateBlockNodeCount(block);
        run.stable_committed_keys.add(block.key);
      }
    }
    approximateNodeChurn += tailBlocks.reduce((sum, block) => sum + estimateBlockNodeCount(block), 0);
  }

  const updateTimeMs = estimateUpdateTimeMs({
    mode: run.mode,
    sourceLength: run.source.length,
    nodeChurn: approximateNodeChurn,
    blockCount: blocks.length
  });

  return {
    completed_block_render_count: completedBlockRenderCount,
    completed_block_rerender_count: completedBlockRerenderCount,
    approximate_node_churn: approximateNodeChurn,
    tail_block_render_count: tailBlockRenderCount,
    committed_block_count: run.mode === RENDER_MODES.stable
      ? run.stable_committed_keys.size
      : completedBlocks.length,
    update_time_ms: updateTimeMs
  };
}

function estimateUpdateTimeMs({ mode, sourceLength, nodeChurn, blockCount }) {
  const parseCost = mode === RENDER_MODES.naive ? sourceLength * 0.008 : sourceLength * 0.002;
  const churnCost = nodeChurn * 0.045;
  const blockCost = blockCount * 0.03;
  return roundMetric(parseCost + churnCost + blockCost);
}

export function parseMarkdownBlocks(source, options = {}) {
  const final = options.final === true;
  const normalized = source.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    if (lines[index].trim() === "") {
      index += 1;
      continue;
    }

    const startLine = index;
    const fence = lines[index].match(/^```([A-Za-z0-9_-]+)?\s*$/);
    if (fence) {
      const language = fence[1] || "text";
      index += 1;
      const codeLines = [];
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      const closed = index < lines.length;
      if (closed) {
        index += 1;
      }
      blocks.push(makeBlock({
        type: "code",
        startLine,
        language,
        text: codeLines.join("\n"),
        complete: closed || final
      }));
      continue;
    }

    if (/^\$\$\s*$/.test(lines[index])) {
      index += 1;
      const mathLines = [];
      while (index < lines.length && !/^\$\$\s*$/.test(lines[index])) {
        mathLines.push(lines[index]);
        index += 1;
      }
      const closed = index < lines.length;
      if (closed) {
        index += 1;
      }
      blocks.push(makeBlock({
        type: "math_block",
        startLine,
        text: mathLines.join("\n"),
        complete: closed || final
      }));
      continue;
    }

    const heading = lines[index].match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push(makeBlock({
        type: "heading",
        startLine,
        level: heading[1].length,
        text: heading[2],
        complete: true
      }));
      index += 1;
      continue;
    }

    const table = parseTable(lines, index, { final });
    if (table) {
      blocks.push(makeBlock({
        type: "table",
        startLine,
        headers: table.headers,
        rows: table.rows,
        complete: table.complete
      }));
      index = table.nextIndex;
      continue;
    }

    if (/^-\s+/.test(lines[index])) {
      const items = [];
      while (index < lines.length && /^-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^-\s+/, ""));
        index += 1;
      }
      blocks.push(makeBlock({
        type: "list",
        startLine,
        items,
        complete: final || index < lines.length
      }));
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !startsStructuredBlock(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(makeBlock({
      type: "paragraph",
      startLine,
      text: paragraphLines.join(" "),
      complete: final || index < lines.length
    }));
  }

  return blocks;
}

function parseTable(lines, startIndex, options) {
  if (
    startIndex + 1 >= lines.length ||
    !isTableRow(lines[startIndex]) ||
    !TABLE_SEPARATOR_RE.test(lines[startIndex + 1])
  ) {
    return null;
  }

  const rows = [];
  let index = startIndex;
  while (index < lines.length && isTableRow(lines[index])) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const hasTerminator = index < lines.length - 1 && lines[index].trim() === "";
  const hasFollowingNonTableContent = index < lines.length && lines[index].trim() !== "";
  return {
    headers: rows[0],
    rows: rows.slice(2),
    nextIndex: index,
    complete: options.final === true || hasTerminator || hasFollowingNonTableContent
  };
}

function isTableRow(line) {
  return /^\|.*\|$/.test(line);
}

function splitTableRow(line) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function startsStructuredBlock(line) {
  return /^(#{1,3}\s+|``|\$\$\s*$|-\s+)/.test(line) || (
    isTableRow(line) && TABLE_SEPARATOR_RE.test(line)
  );
}

function makeBlock(block) {
  const identity = normalizedBlockIdentity(block);
  return {
    ...block,
    key: `${block.startLine}:${identity}`,
    identity
  };
}

function normalizedBlockIdentity(block) {
  if (block.type === "table") {
    return `table:${hashString(JSON.stringify([block.headers, block.rows]))}`;
  }
  if (block.type === "list") {
    return `list:${hashString(block.items.join("\n"))}`;
  }
  if (block.type === "code") {
    return `code:${block.language}:${block.complete ? "closed" : "open"}:${hashString(block.text)}`;
  }
  if (block.type === "heading") {
    return `heading:${block.level}:${hashString(block.text)}`;
  }
  if (block.type === "math_block") {
    return `math_block:${block.complete ? "closed" : "open"}:${hashString(block.text)}`;
  }
  return `paragraph:${hashString(block.text)}`;
}

export function semanticHash(blocks) {
  return hashString(blocks.map((block) => block.identity).join("|"));
}

export function estimateBlockNodeCount(block) {
  if (block.type === "heading") {
    return 1 + estimateInlineNodeCount(block.text);
  }
  if (block.type === "paragraph") {
    return 1 + estimateInlineNodeCount(block.text);
  }
  if (block.type === "list") {
    return 1 + block.items.length + block.items.reduce((sum, item) => sum + estimateInlineNodeCount(item), 0);
  }
  if (block.type === "table") {
    const cellCount = block.headers.length + block.rows.reduce((sum, row) => sum + row.length, 0);
    return 3 + block.rows.length + cellCount;
  }
  if (block.type === "code" || block.type === "math_block") {
    return 2 + Math.max(1, block.text.split("\n").length);
  }
  return 1;
}

function estimateInlineNodeCount(text) {
  const inlineMathPairs = Math.floor((text.match(/\$/g) || []).length / 2);
  const inlineCodePairs = Math.floor((text.match(/`/g) || []).length / 2);
  return 1 + inlineMathPairs + inlineCodePairs;
}

export function summarizeRun(run) {
  return {
    mode: run.mode,
    fixture_id: run.fixture_id,
    source_length: run.source.length,
    block_count: run.latest_blocks.length,
    complete_block_count: run.latest_blocks.filter((block) => block.complete).length,
    incomplete_block_count: run.latest_blocks.filter((block) => !block.complete).length,
    metrics: summarizeMetrics(run.metrics)
  };
}

function summarizeMetrics(metrics) {
  return {
    render_count: metrics.render_count,
    completed_block_render_count: metrics.completed_block_render_count,
    completed_block_rerender_count: metrics.completed_block_rerender_count,
    approximate_node_churn: metrics.approximate_node_churn,
    average_update_time_ms: roundMetric(metrics.average_update_time_ms),
    max_update_time_ms: roundMetric(metrics.max_update_time_ms),
    latest_update_time_ms: roundMetric(metrics.latest_update_time_ms),
    committed_block_count: metrics.committed_block_count,
    tail_block_render_count: metrics.tail_block_render_count,
    semantic_hash: metrics.semantic_hash
  };
}

export function hashString(value) {
  let hash = 2166136261;
  const input = String(value);
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}
