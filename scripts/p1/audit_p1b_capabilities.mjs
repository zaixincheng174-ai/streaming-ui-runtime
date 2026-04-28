#!/usr/bin/env node

import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const targetFilePath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_streaming_chat_baseline.html", import.meta.url)
);

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.className = "";
    this._textContent = "";
    this.value = "";
    this.spellcheck = false;
    this.readOnly = false;
    this.scrollTop = 0;
    this.scrollHeight = 1000;
    this.clientHeight = 500;
  }

  append(...children) {
    for (const child of children) {
      this.appendChild(child);
    }
  }

  appendChild(child) {
    if (child?.parentNode) {
      child.parentNode.children = child.parentNode.children.filter((entry) => entry !== child);
    }
    if (child) {
      child.parentNode = this;
    }
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    for (const child of this.children) {
      if (child) {
        child.parentNode = null;
      }
    }
    this.children = [];
    for (const child of children) {
      this.appendChild(child);
    }
  }

  addEventListener() {}

  remove() {}

  get childNodes() {
    return this.children;
  }

  get textContent() {
    if (this._textContent !== "") {
      return this._textContent;
    }
    return this.children.map((child) => child?.textContent || "").join("");
  }

  set textContent(value) {
    for (const child of this.children) {
      if (child) {
        child.parentNode = null;
      }
    }
    this.children = [];
    this._textContent = String(value);
  }

  get isConnected() {
    return true;
  }

  set selectionStart(value) {
    this._selectionStart = value;
  }

  set selectionEnd(value) {
    this._selectionEnd = value;
  }
}

function fail(message) {
  console.error(`P1B_CAPABILITY_AUDIT=FAIL ${message}`);
  process.exit(1);
}

function extractInlineScript(html) {
  const start = html.indexOf("<script>");
  const end = html.lastIndexOf("</script>");
  if (start === -1 || end === -1 || end <= start) {
    fail("target inline script not found");
  }
  return html.slice(start + "<script>".length, end);
}

function createDocument(elements) {
  return {
    body: new FakeElement("body"),
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, new FakeElement("span"));
      }
      return elements.get(id);
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createDocumentFragment() {
      return new FakeElement("fragment");
    },
    createTextNode(text) {
      const node = new FakeElement("#text");
      node.textContent = text;
      return node;
    }
  };
}

function createTargetContext(script, params, exposeScript = "") {
  const elements = new Map();
  const document = createDocument(elements);
  const window = {
    location: { search: `?${new URLSearchParams(params).toString()}` },
    setTimeout() {
      return 0;
    },
    clearTimeout() {},
    setInterval() {
      return 0;
    },
    requestAnimationFrame(callback) {
      callback();
    }
  };

  window.window = window;
  window.document = document;

  const context = {
    document,
    window,
    console,
    URLSearchParams,
    Set,
    Map,
    Array,
    Number,
    String,
    Object,
    RegExp,
    Error,
    Math,
    performance: {
      now: () => 2500,
      mark() {}
    },
    PerformanceObserver: class {
      observe() {}
    },
    requestAnimationFrame(callback) {
      callback();
    }
  };

  vm.createContext(context);
  vm.runInContext(`${script}\n${exposeScript}`, context, { timeout: 15000 });
  return { context, elements };
}

function runTargetAudit(script, params) {
  const { elements } = createTargetContext(script, params);

  const fields = {};
  for (const element of elements.values()) {
    const text = element.textContent || "";
    const index = text.indexOf("=");
    if (index !== -1) {
      fields[text.slice(0, index)] = text.slice(index + 1);
    }
  }
  return fields;
}

function validatePrefixParse(script, params, options = {}) {
  const prefixCount = options.prefixCount ?? 30;
  const exposeScript = `
    window.__prefixInspect = {
      buildStreamTokens,
      renderMarkdownInto,
      analyzeContentForAudit,
      resetForPrefix: () => {
        resetHighlightCounters();
        resetNodeChurnMetrics();
        resetClosedCodeBlockMetrics();
      },
      setActivePrefixSource: (source) => {
        activeCaptureIndex = 1;
        streamState = "streaming";
        activeMessage = { source };
      },
      counters: () => ({
        active_unclosed_code_plain_count: activeUnclosedCodePlainCount,
        unclosed_code_highlight_skipped_count: unclosedCodeHighlightSkippedCount,
        closed_code_highlight_call_count: closedCodeHighlightCallCount,
        highlight_call_count: highlightCallCount,
        created_highlight_span_count: createdHighlightSpanCount,
        dom_nodes_created_this_tick: nodeChurnMetrics.domNodesCreatedThisTick,
        dom_nodes_replaced_this_tick: nodeChurnMetrics.domNodesReplacedThisTick,
        dom_nodes_in_closed_blocks_affected_this_tick: nodeChurnMetrics.domNodesInClosedBlocksAffectedThisTick,
        dom_nodes_in_active_unclosed_block_affected_this_tick: nodeChurnMetrics.domNodesInActiveUnclosedBlockAffectedThisTick,
        total_nodes_created: nodeChurnMetrics.totalNodesCreated,
        total_nodes_replaced: nodeChurnMetrics.totalNodesReplaced,
        total_nodes_in_closed_blocks_churned: nodeChurnMetrics.totalNodesInClosedBlocksChurned,
        total_nodes_in_active_unclosed_block_changed: nodeChurnMetrics.totalNodesInActiveUnclosedBlockChanged,
        closed_block_churn_ratio: closedBlockChurnRatio(),
        active_message_closed_code_block_count: nodeChurnMetrics.activeMessageClosedCodeBlockCount,
        active_message_closed_code_block_render_count: nodeChurnMetrics.activeMessageClosedCodeBlockRenderCount,
        active_message_closed_code_block_rerender_factor: activeMessageClosedCodeBlockRerenderFactor(),
        active_message_closed_code_dom_nodes_created: nodeChurnMetrics.activeMessageClosedCodeDomNodesCreated,
        active_message_closed_code_dom_nodes_replaced: nodeChurnMetrics.activeMessageClosedCodeDomNodesReplaced,
        unique_closed_code_block_count: uniqueClosedCodeBlockCount(),
        closed_code_block_encounter_count: closedCodeBlockMetrics.encounterCount,
        closed_code_block_actual_render_count: closedCodeBlockMetrics.actualRenderCount,
        closed_code_block_reuse_count: closedCodeBlockMetrics.reuseCount,
        closed_code_block_cache_hit_count: closedCodeBlockMetrics.cacheHitCount,
        closed_code_block_cache_miss_count: closedCodeBlockMetrics.cacheMissCount,
        actual_render_factor: actualRenderFactor(),
        encounter_factor: encounterFactor(),
        final_rendered_text_hash: closedCodeBlockMetrics.finalRenderedTextHash,
        active_message_block_sequence_hash: closedCodeBlockMetrics.activeMessageBlockSequenceHash,
        code_block_signature_hash: closedCodeBlockMetrics.codeBlockSignatureHash
      })
    };
  `;
  const { context } = createTargetContext(script, params, exposeScript);
  const contentMix = params.content_mix;

  try {
    vm.runInContext(String.raw`
      const tokens = window.__prefixInspect.buildStreamTokens(800);
      const rows = [];
      const container = document.createElement("div");
      let source = "";
      const prefixCount = ${prefixCount};
      window.__prefixInspect.resetForPrefix();
      for (let index = 0; index < prefixCount; index += 1) {
        const token = tokens[index];
        source += token;
        window.__prefixInspect.setActivePrefixSource(source);
        window.__prefixInspect.renderMarkdownInto(container, source);
        const audit = window.__prefixInspect.analyzeContentForAudit(source);
        rows.push({
          token_index: index + 1,
          length: token.length,
          preview: token.replace(/\n/g, "\\n").slice(0, 90),
          cumulative_length: source.length,
          partial_tool_opener: /::tool-output\s*$/.test(source),
          stream_code_block_count: audit.codeBlockCount,
          stream_tool_output_block_count: audit.toolOutputBlockCount
        });
      }
      window.__prefixResult = {
        first_30_prefixes_rendered: rows.length,
        token_14: rows[13],
        max_chunk_length_first_30: rows.reduce((max, row) => Math.max(max, row.length), 0),
        counters: window.__prefixInspect.counters(),
        rows
      };
    `, context, { timeout: Math.max(5000, prefixCount * 60) });
  } catch (error) {
    fail(`${contentMix} prefix-parse validation failed: ${error.message}`);
  }

  const result = context.window.__prefixResult;
  if (!result || result.first_30_prefixes_rendered !== prefixCount) {
    fail(`${contentMix} prefix-parse validation did not render ${prefixCount} prefixes`);
  }
  if (result.rows.some((row) => row.partial_tool_opener)) {
    fail(`${contentMix} prefix-parse validation left a partial tool-output opener`);
  }
  if (
    contentMix === "tool-heavy-no-code" &&
    !String(result.token_14.preview).startsWith("::tool-output ")
  ) {
    fail("tool-heavy-no-code token 14 is not the expected atomic tool-output opener");
  }

  return {
    content_mix: contentMix,
    first_30_prefixes_rendered: result.first_30_prefixes_rendered,
    token_14: result.token_14,
    max_chunk_length_first_30: result.max_chunk_length_first_30,
    counters: result.counters
  };
}

function assertHighlightPolicy(prefixEager, prefixStreamingPlain) {
  const eagerCounters = prefixEager.counters;
  const policyCounters = prefixStreamingPlain.counters;

  if (policyCounters.active_unclosed_code_plain_count <= 0) {
    fail("streaming-plain-until-close did not render any active unclosed code block as plain text");
  }
  if (policyCounters.unclosed_code_highlight_skipped_count <= 0) {
    fail("streaming-plain-until-close did not skip highlighting for active unclosed code");
  }
  if (policyCounters.highlight_call_count >= eagerCounters.highlight_call_count) {
    fail("streaming-plain-until-close did not reduce highlight_call_count versus eager prefix");
  }
  if (policyCounters.created_highlight_span_count >= eagerCounters.created_highlight_span_count) {
    fail("streaming-plain-until-close did not reduce created_highlight_span_count versus eager prefix");
  }

  return {
    eager: {
      highlight_call_count: eagerCounters.highlight_call_count,
      created_highlight_span_count: eagerCounters.created_highlight_span_count
    },
    streaming_plain_until_close: policyCounters
  };
}

function assertNodeChurnProbe(prefixWithProbe) {
  const counters = prefixWithProbe.counters;
  if (counters.active_message_closed_code_block_count <= 0) {
    fail("node_churn_probe did not observe closed code blocks");
  }
  if (counters.active_message_closed_code_block_render_count <= counters.active_message_closed_code_block_count) {
    fail("node_churn_probe did not observe closed code block re-renders");
  }
  if (counters.total_nodes_created <= 0 || counters.total_nodes_replaced <= 0) {
    fail("node_churn_probe did not count created/replaced DOM nodes");
  }
  if (counters.active_message_closed_code_dom_nodes_created <= 0) {
    fail("node_churn_probe did not count closed-code DOM creation");
  }
  if (counters.closed_block_churn_ratio <= 0) {
    fail("node_churn_probe closed_block_churn_ratio was not positive");
  }

  return counters;
}

function renderFinalStreamOnce(script, params) {
  const exposeScript = `
    window.__finalInspect = {
      buildStreamTokens,
      renderMarkdownInto,
      analyzeContentForAudit,
      resetForFinal: () => {
        resetHighlightCounters();
        resetNodeChurnMetrics();
        resetClosedCodeBlockMetrics();
      },
      setActiveSource: (source) => {
        activeCaptureIndex = 1;
        streamState = "streaming";
        activeMessage = { source };
      },
      counters: () => ({
        unique_closed_code_block_count: uniqueClosedCodeBlockCount(),
        closed_code_block_encounter_count: closedCodeBlockMetrics.encounterCount,
        closed_code_block_actual_render_count: closedCodeBlockMetrics.actualRenderCount,
        closed_code_block_reuse_count: closedCodeBlockMetrics.reuseCount,
        closed_code_block_cache_hit_count: closedCodeBlockMetrics.cacheHitCount,
        closed_code_block_cache_miss_count: closedCodeBlockMetrics.cacheMissCount,
        actual_render_factor: actualRenderFactor(),
        encounter_factor: encounterFactor(),
        final_rendered_text_hash: closedCodeBlockMetrics.finalRenderedTextHash,
        active_message_block_sequence_hash: closedCodeBlockMetrics.activeMessageBlockSequenceHash,
        code_block_signature_hash: closedCodeBlockMetrics.codeBlockSignatureHash
      })
    };
  `;
  const { context } = createTargetContext(script, params, exposeScript);

  try {
    vm.runInContext(String.raw`
      const tokens = window.__finalInspect.buildStreamTokens(800);
      const source = tokens.join("");
      const container = document.createElement("div");
      window.__finalInspect.resetForFinal();
      window.__finalInspect.setActiveSource(source);
      window.__finalInspect.renderMarkdownInto(container, source);
      const audit = window.__finalInspect.analyzeContentForAudit(source);
      window.__finalResult = {
        audit: {
          stream_code_block_count: audit.codeBlockCount,
          stream_code_line_count: audit.codeLineCount
        },
        counters: window.__finalInspect.counters()
      };
    `, context, { timeout: 15000 });
  } catch (error) {
    fail(`final stream render validation failed: ${error.message}`);
  }

  return context.window.__finalResult;
}

function assertClosedCodeStableReuse(referenceFinalRender, stablePrefixRender) {
  const reference = referenceFinalRender.counters;
  const stable = stablePrefixRender.counters;

  if (referenceFinalRender.audit.stream_code_block_count !== 13) {
    fail(`final stream_code_block_count expected 13, got ${referenceFinalRender.audit.stream_code_block_count}`);
  }
  if (referenceFinalRender.audit.stream_code_line_count !== 390) {
    fail(`final stream_code_line_count expected 390, got ${referenceFinalRender.audit.stream_code_line_count}`);
  }
  if (stable.unique_closed_code_block_count !== 13) {
    fail(`closed-code-stable-reuse unique_closed_code_block_count expected 13, got ${stable.unique_closed_code_block_count}`);
  }
  if (stable.closed_code_block_reuse_count <= 0) {
    fail("closed-code-stable-reuse did not reuse any closed code blocks");
  }
  if (stable.closed_code_block_cache_hit_count <= 0) {
    fail("closed-code-stable-reuse did not produce cache hits");
  }
  if (stable.closed_code_block_cache_miss_count !== 13) {
    fail(`closed-code-stable-reuse cache misses expected 13, got ${stable.closed_code_block_cache_miss_count}`);
  }
  if (stable.closed_code_block_actual_render_count !== 13) {
    fail(`closed-code-stable-reuse actual renders expected 13, got ${stable.closed_code_block_actual_render_count}`);
  }
  if (stable.actual_render_factor > 1.1) {
    fail(`closed-code-stable-reuse actual_render_factor too high: ${stable.actual_render_factor}`);
  }
  if (stable.encounter_factor <= stable.actual_render_factor) {
    fail("closed-code-stable-reuse encounter_factor did not stay above actual_render_factor");
  }
  if (stable.final_rendered_text_hash !== reference.final_rendered_text_hash) {
    fail("closed-code-stable-reuse final_rendered_text_hash does not match full-rerender reference");
  }
  if (stable.active_message_block_sequence_hash !== reference.active_message_block_sequence_hash) {
    fail("closed-code-stable-reuse active_message_block_sequence_hash does not match full-rerender reference");
  }
  if (stable.code_block_signature_hash !== reference.code_block_signature_hash) {
    fail("closed-code-stable-reuse code_block_signature_hash does not match full-rerender reference");
  }

  return {
    reference,
    stable_reuse: stable,
    audit: referenceFinalRender.audit
  };
}

function numberField(fields, name) {
  const value = Number(fields[name]);
  if (!Number.isFinite(value)) {
    fail(`${name} is not numeric`);
  }
  return value;
}

function formatSet(value) {
  return new Set(String(value || "").split(",").filter(Boolean));
}

function assertFormats(fields, name) {
  const formats = formatSet(fields[name]);
  for (const requiredFormat of ["json", "terminal", "markdown-table", "file-listing"]) {
    if (!formats.has(requiredFormat)) {
      fail(`${name} missing format ${requiredFormat}`);
    }
  }
}

function assertNoCodeNoHighlight(fields, label) {
  const summary = {
    history_code_block_message_pct: numberField(fields, "history_code_block_message_pct"),
    stream_code_block_count: numberField(fields, "stream_code_block_count"),
    stream_code_line_count: numberField(fields, "stream_code_line_count"),
    highlight_call_count: numberField(fields, "highlight_call_count"),
    created_highlight_span_count: numberField(fields, "created_highlight_span_count")
  };

  if (summary.history_code_block_message_pct !== 0) {
    fail(`${label} history_code_block_message_pct must be 0`);
  }
  if (summary.stream_code_block_count !== 0) {
    fail(`${label} stream_code_block_count must be 0`);
  }
  if (summary.stream_code_line_count !== 0) {
    fail(`${label} stream_code_line_count must be 0`);
  }
  if (summary.highlight_call_count !== 0) {
    fail(`${label} highlight_call_count must be 0`);
  }
  if (summary.created_highlight_span_count !== 0) {
    fail(`${label} created_highlight_span_count must be 0`);
  }

  return summary;
}

function assertCodeHeavy(fields) {
  const summary = {
    content_mix: fields.content_mix,
    history_messages: fields.history_messages,
    history_code_block_message_pct: numberField(fields, "history_code_block_message_pct"),
    history_avg_code_block_lines: numberField(fields, "history_avg_code_block_lines"),
    stream_code_block_count: numberField(fields, "stream_code_block_count"),
    stream_code_line_count: numberField(fields, "stream_code_line_count")
  };

  if (summary.content_mix !== "code-heavy") {
    fail("code-heavy content_mix audit mismatch");
  }
  if (summary.history_code_block_message_pct < 60) {
    fail("code-heavy history_code_block_message_pct below 60");
  }
  if (summary.history_avg_code_block_lines < 29 || summary.history_avg_code_block_lines > 31) {
    fail("code-heavy history_avg_code_block_lines outside 29..31");
  }
  if (summary.stream_code_block_count <= 0 || summary.stream_code_line_count <= 0) {
    fail("code-heavy stream code audit missing");
  }

  return summary;
}

function assertToolHeavy(fields) {
  const summary = {
    content_mix: fields.content_mix,
    history_messages: fields.history_messages,
    history_tool_output_message_pct: numberField(fields, "history_tool_output_message_pct"),
    stream_tool_output_block_count: numberField(fields, "stream_tool_output_block_count"),
    tool_output_formats_present: fields.tool_output_formats_present
  };
  const formats = formatSet(summary.tool_output_formats_present);

  if (summary.content_mix !== "tool-heavy") {
    fail("tool-heavy content_mix audit mismatch");
  }
  if (summary.history_tool_output_message_pct < 40) {
    fail("tool-heavy history_tool_output_message_pct below 40");
  }
  if (summary.stream_tool_output_block_count <= 0) {
    fail("tool-heavy stream tool audit missing");
  }
  for (const requiredFormat of ["json", "terminal", "markdown-table", "file-listing"]) {
    if (!formats.has(requiredFormat)) {
      fail(`tool-heavy missing format ${requiredFormat}`);
    }
  }

  return summary;
}

function assertToolHeavyNoCode(fields) {
  const summary = {
    content_mix: fields.content_mix,
    history_messages: fields.history_messages,
    history_tool_output_message_pct: numberField(fields, "history_tool_output_message_pct"),
    stream_tool_output_block_count: numberField(fields, "stream_tool_output_block_count"),
    stream_tool_output_line_count: numberField(fields, "stream_tool_output_line_count"),
    tool_output_formats_present: fields.tool_output_formats_present,
    stream_tool_output_formats_present: fields.stream_tool_output_formats_present,
    ...assertNoCodeNoHighlight(fields, "tool-heavy-no-code")
  };

  if (summary.content_mix !== "tool-heavy-no-code") {
    fail("tool-heavy-no-code content_mix audit mismatch");
  }
  if (summary.history_tool_output_message_pct < 40) {
    fail("tool-heavy-no-code history_tool_output_message_pct below 40");
  }
  if (summary.stream_tool_output_block_count < 20) {
    fail("tool-heavy-no-code stream_tool_output_block_count below 20");
  }
  if (summary.stream_tool_output_line_count < 200) {
    fail("tool-heavy-no-code stream_tool_output_line_count below 200");
  }
  assertFormats(fields, "tool_output_formats_present");
  assertFormats(fields, "stream_tool_output_formats_present");

  return summary;
}

function assertMarkdownHeavyNoCode(fields) {
  const summary = {
    content_mix: fields.content_mix,
    history_messages: fields.history_messages,
    history_rich_markdown_message_pct: numberField(fields, "history_rich_markdown_message_pct"),
    stream_heading_count: numberField(fields, "stream_heading_count"),
    stream_list_item_count: numberField(fields, "stream_list_item_count"),
    stream_markdown_table_count: numberField(fields, "stream_markdown_table_count"),
    stream_blockquote_count: numberField(fields, "stream_blockquote_count"),
    stream_inline_code_count: numberField(fields, "stream_inline_code_count"),
    ...assertNoCodeNoHighlight(fields, "markdown-heavy-no-code")
  };

  if (summary.content_mix !== "markdown-heavy-no-code") {
    fail("markdown-heavy-no-code content_mix audit mismatch");
  }
  if (summary.history_rich_markdown_message_pct < 40) {
    fail("markdown-heavy-no-code history_rich_markdown_message_pct below 40");
  }
  if (summary.stream_heading_count < 8) {
    fail("markdown-heavy-no-code stream_heading_count below 8");
  }
  if (summary.stream_list_item_count < 80) {
    fail("markdown-heavy-no-code stream_list_item_count below 80");
  }
  if (summary.stream_markdown_table_count < 4) {
    fail("markdown-heavy-no-code stream_markdown_table_count below 4");
  }
  if (summary.stream_blockquote_count < 8) {
    fail("markdown-heavy-no-code stream_blockquote_count below 8");
  }
  if (summary.stream_inline_code_count < 20) {
    fail("markdown-heavy-no-code stream_inline_code_count below 20");
  }

  return summary;
}

const html = fs.readFileSync(targetFilePath, "utf8");
const script = extractInlineScript(html);
const commonParams = {
  baseline_id: "optimized-dom",
  history_messages: "1000",
  stream_tokens: "800",
  token_interval_ms: "20",
  scenario_mode: "tail-follow",
  seed: "p1b-audit",
  input_probe: "false"
};

const standard = runTargetAudit(script, {
  ...commonParams,
  history_messages: "160",
  content_mix: "standard"
});
const codeHeavy = assertCodeHeavy(runTargetAudit(script, {
  ...commonParams,
  content_mix: "code-heavy"
}));
const toolHeavy = assertToolHeavy(runTargetAudit(script, {
  ...commonParams,
  content_mix: "tool-heavy"
}));
const toolHeavyNoCode = assertToolHeavyNoCode(runTargetAudit(script, {
  ...commonParams,
  history_messages: "160",
  content_mix: "tool-heavy-no-code"
}));
const markdownHeavyNoCode = assertMarkdownHeavyNoCode(runTargetAudit(script, {
  ...commonParams,
  history_messages: "160",
  content_mix: "markdown-heavy-no-code"
}));
const prefixParse = [
  "standard",
  "code-heavy",
  "tool-heavy",
  "tool-heavy-no-code",
  "markdown-heavy-no-code"
].map((contentMix) => validatePrefixParse(script, {
  ...commonParams,
  history_messages: "160",
  content_mix: contentMix
}));
const codeHeavyEagerPrefix = validatePrefixParse(script, {
  ...commonParams,
  history_messages: "160",
  content_mix: "code-heavy",
  highlight_policy: "eager"
});
const codeHeavyStreamingPlainPrefix = validatePrefixParse(script, {
  ...commonParams,
  history_messages: "160",
  content_mix: "code-heavy",
  highlight_policy: "streaming-plain-until-close"
});
const highlightPolicy = assertHighlightPolicy(codeHeavyEagerPrefix, codeHeavyStreamingPlainPrefix);
const codeHeavyNodeChurnPrefix = validatePrefixParse(script, {
  ...commonParams,
  history_messages: "160",
  content_mix: "code-heavy",
  highlight_policy: "streaming-plain-until-close",
  node_churn_probe: "true"
}, { prefixCount: 140 });
const nodeChurnProbe = assertNodeChurnProbe(codeHeavyNodeChurnPrefix);
const codeHeavyFinalReference = renderFinalStreamOnce(script, {
  ...commonParams,
  history_messages: "160",
  content_mix: "code-heavy",
  highlight_policy: "streaming-plain-until-close",
  active_render_strategy: "full-rerender"
});
const codeHeavyStableReusePrefix = validatePrefixParse(script, {
  ...commonParams,
  history_messages: "160",
  content_mix: "code-heavy",
  highlight_policy: "streaming-plain-until-close",
  active_render_strategy: "closed-code-stable-reuse",
  node_churn_probe: "true"
}, { prefixCount: 800 });
const closedCodeStableReuse = assertClosedCodeStableReuse(codeHeavyFinalReference, codeHeavyStableReusePrefix);

console.log("P1B_CAPABILITY_AUDIT=PASS");
console.log(JSON.stringify({
  standard: {
    content_mix: standard.content_mix,
    history_messages: standard.history_messages,
    input_probe: standard.input_probe
  },
  code_heavy: codeHeavy,
  tool_heavy: toolHeavy,
  tool_heavy_no_code: toolHeavyNoCode,
  markdown_heavy_no_code: markdownHeavyNoCode,
  prefix_parse: prefixParse,
  highlight_policy: highlightPolicy,
  node_churn_probe: nodeChurnProbe,
  closed_code_stable_reuse: closedCodeStableReuse
}, null, 2));
