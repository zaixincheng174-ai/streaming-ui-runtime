#!/usr/bin/env node

import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const reactTargetPath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_production_react_sanity.html", import.meta.url)
);

const CELLS = [
  {
    id: "O0-A_standard_160",
    scenario_mode: "tail-follow",
    history_messages: 160,
    content_mix: "standard",
    stream_tokens: 800,
    token_interval_ms: 20
  },
  {
    id: "O0-B_code_heavy_160",
    scenario_mode: "tail-follow",
    history_messages: 160,
    content_mix: "code-heavy",
    stream_tokens: 800,
    token_interval_ms: 20
  },
  {
    id: "O0-C_code_heavy_500",
    scenario_mode: "tail-follow",
    history_messages: 500,
    content_mix: "code-heavy",
    stream_tokens: 800,
    token_interval_ms: 20
  },
  {
    id: "O0-C_code_heavy_1000",
    scenario_mode: "tail-follow",
    history_messages: 1000,
    content_mix: "code-heavy",
    stream_tokens: 800,
    token_interval_ms: 20
  },
  {
    id: "O0-E1_documented_send_flush_pattern",
    scenario_mode: "documented-send-flush-pattern",
    history_messages: 1000,
    content_mix: "standard",
    stream_tokens: 0,
    token_interval_ms: 0
  }
];

const SEND_PATTERN = {
  grounding_source: "p0-product-trace-attribution",
  source_fidelity: "documented-pattern-only",
  raw_trace_available: false,
  native_pointer_dispatch_measured: false,
  send_trigger_mode: "synthetic-dom-event",
  microtask_flush_chain_enabled: true,
  framework_commit_traversal_enabled: true,
  microtask_chain_length: 2,
  microtask_payload_shape: "documented-pattern-approximation:pointerup-run-microtasks-o-c",
  commit_update_count: 2,
  appended_message_count: 1,
  synthetic_pressure_multiplier: 1
};

function queryForCell(cell) {
  return [
    "baseline_id=production-react-sanity",
    `history_messages=${cell.history_messages}`,
    `content_mix=${cell.content_mix}`,
    `scenario_mode=${cell.scenario_mode}`,
    `stream_tokens=${cell.stream_tokens}`,
    `token_interval_ms=${cell.token_interval_ms}`,
    "highlight_policy=streaming-plain-until-close"
  ].join("&");
}

const REQUIRED_PASS_FIELDS = [
  "config_valid",
  "capture_allowed",
  "baseline_id",
  "history_messages",
  "content_mix",
  "stream_tokens",
  "token_interval_ms",
  "scenario_mode",
  "stream_code_block_count",
  "stream_code_line_count",
  "token_stream_hash",
  "active_message_source_hash",
  "history_source_hash",
  "workload_source_hash",
  "semantic_block_sequence_hash",
  "code_block_signature_hash",
  "future_output_pre_rendered"
];

const SEND_PASS_FIELDS = [
  "grounding_source",
  "source_fidelity",
  "raw_trace_available",
  "native_pointer_dispatch_measured",
  "send_trigger_mode",
  "microtask_flush_chain_enabled",
  "framework_commit_traversal_enabled",
  "microtask_chain_length",
  "microtask_payload_shape",
  "commit_update_count",
  "appended_message_count",
  "synthetic_pressure_multiplier",
  "action_sequence_hash",
  "send_payload_hash"
];

function fieldsForCell(cell) {
  const fields = [...REQUIRED_PASS_FIELDS];
  if (cell.scenario_mode === "documented-send-flush-pattern") {
    fields.push(...SEND_PASS_FIELDS);
  }
  fields.push("final_rendered_text_hash", "final_rendered_text_hash_definition");
  return fields;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeCodeLines(sequence, lineCount, language) {
  const lines = [];
  if (language === "json") {
    lines.push("{");
    for (let line = 1; line <= lineCount - 2; line += 1) {
      const suffix = line === lineCount - 2 ? "" : ",";
      lines.push(`  "metric_${String(line).padStart(2, "0")}": ${sequence * 100 + line}${suffix}`);
    }
    lines.push("}");
    return lines;
  }

  if (language === "sh") {
    for (let line = 1; line <= lineCount; line += 1) {
      lines.push(`node scripts/p1/task-${sequence}.mjs --row ${line} --mode deterministic`);
    }
    return lines;
  }

  for (let line = 1; line <= lineCount; line += 1) {
    lines.push(`const value_${sequence}_${line} = normalizeToken(${sequence + line});`);
  }
  return lines;
}

function fencedBlock(language, lines) {
  return ["```" + language, ...lines, "```"].join("\n");
}

function toolOutputLines(sequence, format) {
  if (format === "json") {
    return [
      "format: json",
      "{",
      `  "tool": "retrieval-${sequence}",`,
      `  "rows": ${24 + (sequence % 13)},`,
      "  \"status\": \"ok\"",
      "}"
    ];
  }
  if (format === "terminal") {
    return [
      "format: terminal",
      `$ rg --json "needle-${sequence}" ./workspace`,
      `./src/item-${sequence}.ts:12:export const item = ${sequence};`,
      `./src/item-${sequence}.ts:19:return item + 1;`,
      "exit_code=0"
    ];
  }
  if (format === "markdown-table") {
    return [
      "format: markdown-table",
      "| file | rows | status |",
      "| --- | ---: | --- |",
      `| report-${sequence}.md | ${10 + (sequence % 9)} | parsed |`,
      `| trace-${sequence}.json | ${20 + (sequence % 11)} | indexed |`
    ];
  }
  return [
    "format: file-listing",
    `src/session/${sequence}/index.ts`,
    `src/session/${sequence}/renderer.ts`,
    `logs/session-${sequence}.jsonl`,
    `artifacts/session-${sequence}/summary.md`
  ];
}

function standardHistorySource(sequence) {
  const bucket = sequence % 5;
  if (bucket === 0) {
    return [
      `# History checkpoint ${sequence}`,
      "",
      `The assistant maintains a stable tail while handling message ${sequence} with \`inlineState${sequence % 7}\` and deterministic content.`,
      "",
      "- preserve prior context",
      "- keep the input responsive",
      "- avoid dropping streamed output"
    ].join("\n");
  }
  if (bucket === 1) {
    return [
      `## Tool result ${sequence}`,
      "",
      "```tool-output",
      `tool: ledger-search-${sequence % 9}`,
      `rows: ${20 + (sequence % 11)}`,
      "status: ok",
      `checksum: ${sequence * 37}`,
      "```"
    ].join("\n");
  }
  if (bucket === 2) {
    return [
      `The user asks for a compact explanation of batch ${sequence}.`,
      "",
      "```js",
      `const row${sequence} = { id: ${sequence}, visible: true };`,
      `function format${sequence}(value) {`,
      "  return String(value).trim().toUpperCase();",
      "}",
      "```"
    ].join("\n");
  }
  if (bucket === 3) {
    return [
      `### JSON payload ${sequence}`,
      "",
      "```json",
      "{",
      `  "message_id": ${sequence},`,
      "  \"kind\": \"history\",",
      `  "priority": ${sequence % 4},`,
      "  \"complete\": true",
      "}",
      "```"
    ].join("\n");
  }
  return [
    `Paragraph ${sequence} covers long-running stream context with markdown rendering and code-adjacent prose.`,
    "",
    "- first item uses `inline_code`",
    "- second item keeps variable height",
    "- third item adds enough body text to exercise wrapping and layout"
  ].join("\n");
}

function codeHeavyHistorySource(sequence) {
  const bucket = sequence % 5;
  const language = bucket === 0 ? "js" : bucket === 2 ? "ts" : "json";
  if (bucket === 0 || bucket === 2 || bucket === 3) {
    return [
      `# Code-heavy checkpoint ${sequence}`,
      "",
      `This history message contains a 30-line fenced ${language} block and inline \`code_${sequence}\`.`,
      "",
      "- preserve streaming semantics",
      "- keep syntax highlighting active",
      "- keep the full history mounted",
      "",
      fencedBlock(language, makeCodeLines(sequence, 30, language))
    ].join("\n");
  }
  if (bucket === 1) {
    return [
      `## Review note ${sequence}`,
      "",
      "The assistant compares parsed code regions with surrounding prose while keeping markdown structure stable.",
      "",
      "- code-heavy non-code control row",
      "- deterministic message height"
    ].join("\n");
  }
  return [
    `### Tool side note ${sequence}`,
    "",
    "```tool-output",
    ...toolOutputLines(sequence, "terminal"),
    "```"
  ].join("\n");
}

function buildHistorySources(count, contentMix) {
  const sources = [];
  for (let index = 1; index <= count; index += 1) {
    sources.push(contentMix === "code-heavy"
      ? codeHeavyHistorySource(index)
      : standardHistorySource(index));
  }
  return sources;
}

function standardStreamSectionTokens(sectionIndex) {
  const suffix = String(sectionIndex).padStart(2, "0");
  return [
    `# Streaming section ${suffix}\n\n`,
    "The ", "assistant ", "streams ", "a ", "mixed ", "markdown ", "answer ", "while ", "the ", "input ", "box ", "remains ", "present. ",
    "It ", "includes ", "`inline_state_", suffix, "` ", "and ", "structured ", "content.\n\n",
    "- token ", "cadence ", "is ", "deterministic\n",
    "- tail ", "follow ", "must ", "remain ", "stable\n",
    "- parsing ", "and ", "highlighting ", "still ", "run\n\n",
    "```js\n",
    "const ", `value${sectionIndex}`, " = ", String(sectionIndex), ";\n",
    "function ", `render${sectionIndex}`, "(token) {\n",
    "  return ", "String", "(token)", ".trim", "();\n",
    "}\n",
    "```\n\n",
    "```json\n",
    "{\n",
    `  "section": ${sectionIndex},\n`,
    "  \"streaming\": true,\n",
    "  \"kind\": \"p1a\"\n",
    "}\n",
    "```\n\n",
    "```tool-output\n",
    `tool: diagnostic-${sectionIndex}\n`,
    "status: ok\n",
    `rows: ${12 + (sectionIndex % 8)}\n`,
    "```\n\n"
  ];
}

function codeHeavyStreamSectionTokens(sectionIndex) {
  const suffix = String(sectionIndex).padStart(2, "0");
  const language = sectionIndex % 3 === 0 ? "json" : sectionIndex % 3 === 1 ? "js" : "sh";
  return [
    `# Code-heavy streaming section ${suffix}\n\n`,
    "The ", "assistant ", "streams ", "code-heavy ", "markdown ", "while ", "keeping ", "`inline_code` ", "active.\n\n",
    "- each ", "section ", "includes ", "a ", "30-line ", "fenced ", "code ", "block\n",
    "- syntax ", "highlighting ", "uses ", "the ", "same ", "local ", "path\n\n",
    "```", language, "\n",
    ...makeCodeLines(1000 + sectionIndex, 30, language).map((line) => `${line}\n`),
    "```\n\n"
  ];
}

function streamSectionTokens(sectionIndex, contentMix) {
  if (contentMix === "code-heavy") {
    return codeHeavyStreamSectionTokens(sectionIndex);
  }
  return standardStreamSectionTokens(sectionIndex);
}

function fillerTokens(remaining) {
  const source = [
    "Final ", "stream ", "paragraph ", "keeps ", "markdown ", "valid ", "and ", "closes ", "without ", "opening ", "a ", "new ", "fence. ",
    "- trailing ", "list ", "item ", "with ", "`inline_code`", "\n"
  ];
  const result = [];
  while (result.length < remaining) {
    result.push(source[result.length % source.length]);
  }
  return result;
}

function buildStreamTokens(count, contentMix) {
  const tokens = [];
  let sectionIndex = 1;
  while (tokens.length < count) {
    const section = streamSectionTokens(sectionIndex, contentMix);
    if (tokens.length + section.length <= count) {
      tokens.push(...section);
    } else {
      tokens.push(...fillerTokens(count - tokens.length));
    }
    sectionIndex += 1;
  }
  return tokens.slice(0, count);
}

function documentedSendPayloadSource() {
  return [
    "# Documented send flush pattern",
    "",
    "The visible send surface dispatches a synthetic pointerup and click sequence.",
    "",
    "- grounding source: p0-product-trace-attribution",
    "- source fidelity: documented-pattern-only",
    "- dominant family: app-side async microtask / flush overhead",
    "- secondary family: framework commit traversal overhead",
    "",
    "The payload is appended only after the microtask chain completes."
  ].join("\n");
}

function documentedSendActionSequence() {
  return [
    "send:start",
    "send:trigger:start",
    "send:synthetic-pointerup",
    "send:synthetic-click",
    "send:trigger:end",
    "send:microtask:start",
    "send:microtask:end",
    "send:commit:start",
    "send:commit:end",
    "send:end"
  ].join("|");
}

function startsBlock(line) {
  return (
    /^#{1,3}\s+/.test(line) ||
    /^-\s+/.test(line) ||
    /^```/.test(line) ||
    /^::tool-output\s+/.test(line) ||
    /^>\s+/.test(line)
  );
}

function parseMarkdown(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const nodes = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const fence = line.match(/^```([A-Za-z0-9_-]+)?\s*$/);
    if (fence) {
      const language = fence[1] || "text";
      index += 1;
      const codeLines = [];
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      const closed = index < lines.length;
      if (index < lines.length) {
        index += 1;
      }
      nodes.push({
        type: language === "tool-output" || language === "tool" ? "tool" : "code",
        language,
        text: codeLines.join("\n"),
        closed
      });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      nodes.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^-\s+/, ""));
        index += 1;
      }
      nodes.push({ type: "list", items });
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !startsBlock(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    if (paragraphLines.length === 0) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    nodes.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return nodes;
}

function inlineRenderedText(text) {
  return String(text).split("`").join("");
}

function renderedTextFromNodes(nodes) {
  let renderedText = "";
  for (const node of nodes) {
    if (node.type === "heading" || node.type === "paragraph" || node.type === "blockquote") {
      renderedText += inlineRenderedText(node.text);
    } else if (node.type === "list") {
      for (const item of node.items) {
        renderedText += inlineRenderedText(item);
      }
    } else if (node.type === "code" || node.type === "tool") {
      renderedText += node.text;
    }
  }
  return renderedText;
}

function referenceValues(cell) {
  const historySources = buildHistorySources(cell.history_messages, cell.content_mix);
  const isSendMode = cell.scenario_mode === "documented-send-flush-pattern";
  const streamTokens = isSendMode ? [] : buildStreamTokens(cell.stream_tokens, cell.content_mix);
  const source = streamTokens.join("");
  const sendPayloadSource = isSendMode ? documentedSendPayloadSource() : "";
  const measuredSource = isSendMode ? sendPayloadSource : source;
  const actionSequence = isSendMode ? documentedSendActionSequence() : "";
  const historySource = historySources.join("\u001d");
  const nodes = parseMarkdown(measuredSource);
  let streamCodeBlockCount = 0;
  let streamCodeLineCount = 0;
  let closedCodeOrdinal = 0;
  const semanticParts = [];
  const codeSignatureParts = [];

  for (const node of parseMarkdown(source)) {
    if (node.type === "code") {
      streamCodeBlockCount += 1;
      streamCodeLineCount += node.text === "" ? 0 : node.text.split("\n").length;
    }
  }

  for (const node of nodes) {
    if (node.type === "heading") {
      semanticParts.push(`heading:${node.level}:${hashString(node.text)}`);
    } else if (node.type === "paragraph") {
      semanticParts.push(`paragraph:${hashString(node.text)}`);
    } else if (node.type === "list") {
      semanticParts.push(`list:${node.items.length}:${hashString(node.items.join("\n"))}`);
    } else if (node.type === "tool") {
      semanticParts.push(`tool:${node.language || "tool"}:${hashString(node.text)}`);
    } else if (node.type === "code") {
      const contentHash = hashString(node.text);
      semanticParts.push(`code:${closedCodeOrdinal}:${node.language}:${contentHash}`);
      codeSignatureParts.push(`${closedCodeOrdinal}:${node.language}:${contentHash}`);
      closedCodeOrdinal += 1;
    }
  }

  return {
    config_valid: true,
    capture_allowed: true,
    baseline_id: "production-react-sanity",
    history_messages: cell.history_messages,
    content_mix: cell.content_mix,
    stream_tokens: cell.stream_tokens,
    token_interval_ms: cell.token_interval_ms,
    scenario_mode: cell.scenario_mode,
    stream_code_block_count: streamCodeBlockCount,
    stream_code_line_count: streamCodeLineCount,
    token_stream_hash: hashString(streamTokens.join("\u001e")),
    active_message_source_hash: hashString(measuredSource),
    history_source_hash: hashString(historySource),
    workload_source_hash: hashString(`${historySource}\u001f${measuredSource}`),
    semantic_block_sequence_hash: hashString(semanticParts.join("|")),
    code_block_signature_hash: hashString(codeSignatureParts.join("|")),
    final_rendered_text_hash: hashString(renderedTextFromNodes(nodes)),
    final_rendered_text_hash_definition: "active-message-rendered-textContent-fnv1a",
    grounding_source: isSendMode ? SEND_PATTERN.grounding_source : "not-applicable",
    source_fidelity: isSendMode ? SEND_PATTERN.source_fidelity : "not-applicable",
    raw_trace_available: isSendMode ? SEND_PATTERN.raw_trace_available : false,
    native_pointer_dispatch_measured: isSendMode ? SEND_PATTERN.native_pointer_dispatch_measured : false,
    send_trigger_mode: isSendMode ? SEND_PATTERN.send_trigger_mode : "not-applicable",
    microtask_flush_chain_enabled: isSendMode ? SEND_PATTERN.microtask_flush_chain_enabled : false,
    framework_commit_traversal_enabled: isSendMode ? SEND_PATTERN.framework_commit_traversal_enabled : false,
    microtask_chain_length: isSendMode ? SEND_PATTERN.microtask_chain_length : 0,
    microtask_payload_shape: isSendMode ? SEND_PATTERN.microtask_payload_shape : "not-applicable",
    commit_update_count: isSendMode ? SEND_PATTERN.commit_update_count : 0,
    appended_message_count: isSendMode ? SEND_PATTERN.appended_message_count : 0,
    synthetic_pressure_multiplier: isSendMode ? SEND_PATTERN.synthetic_pressure_multiplier : 1,
    action_sequence_hash: hashString(actionSequence),
    send_payload_hash: hashString(sendPayloadSource),
    future_output_pre_rendered: false
  };
}

function createNode(id) {
  return {
    id,
    textContent: "",
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 500,
    addEventListener() {},
    dispatchEvent() {
      return true;
    },
    appendChild() {},
    replaceChildren() {},
    setAttribute() {},
    classList: {
      add() {},
      remove() {},
      toggle() {}
    }
  };
}

function reactAuditValues(query) {
  const html = fs.readFileSync(reactTargetPath, "utf8");
  const scripts = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => script.trim().length > 0);
  const inlineScript = scripts.at(-1);
  if (!inlineScript) {
    throw new Error(`No inline script found in ${reactTargetPath}`);
  }

  const nodes = new Map();
  const nodeFor = (id) => {
    if (!nodes.has(id)) {
      nodes.set(id, createNode(id));
    }
    return nodes.get(id);
  };

  const windowObject = {
    location: { search: `?${query}` },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    requestAnimationFrame() {
      return 1;
    }
  };

  const context = {
    window: windowObject,
    document: {
      getElementById: nodeFor,
      querySelector: (selector) => selector === ".composer button" || selector === "#send-button"
        ? nodeFor("send-button")
        : null,
      createElement: (tagName) => ({
        tagName: tagName.toUpperCase(),
        textContent: "",
        className: "",
        appendChild() {},
        replaceChildren() {},
        setAttribute() {}
      }),
      createTextNode: (text) => ({ nodeType: 3, textContent: text })
    },
    React: {
      version: "18.3.1",
      createElement: (...args) => ({ args }),
      memo: (component) => component,
      useEffect() {},
      useLayoutEffect() {},
      useMemo: (factory) => factory(),
      useRef: (initialValue) => ({ current: initialValue }),
      useState: (initialValue) => [initialValue, () => {}],
      Fragment: Symbol.for("react.fragment")
    },
    ReactDOM: {
      createRoot: () => ({ render() {} })
    },
    performance: {
      now: () => 0,
      mark() {}
    },
    PerformanceObserver: function PerformanceObserver() {
      this.observe = function observe() {};
    },
    URLSearchParams,
    console
  };

  windowObject.React = context.React;
  windowObject.ReactDOM = context.ReactDOM;
  windowObject.performance = context.performance;
  windowObject.PerformanceObserver = context.PerformanceObserver;
  vm.createContext(context);
  vm.runInContext(inlineScript, context, { filename: reactTargetPath });

  const audit = context.window.__p1ProductionReactSanity?.audit;
  if (!audit) {
    throw new Error("React target did not expose window.__p1ProductionReactSanity.audit");
  }
  return audit;
}

function formatValue(value) {
  return typeof value === "boolean" ? String(value) : value;
}

function main() {
  let overallPass = true;

  console.log("P1 production-react-sanity equivalence audit");
  console.log(`React target: ${reactTargetPath}`);
  console.log("");
  console.log("cell,field,react,reference,status");

  for (const cell of CELLS) {
    const react = reactAuditValues(queryForCell(cell));
    const reference = referenceValues(cell);
    const requiredFields = fieldsForCell(cell);
    for (const field of requiredFields) {
      const reactValue = react[field];
      const referenceValue = reference[field];
      const pass = reactValue === referenceValue;
      if (requiredFields.includes(field) && !pass) {
        overallPass = false;
      }
      console.log(`${cell.id},${field},${formatValue(reactValue)},${formatValue(referenceValue)},${pass ? "PASS" : "FAIL"}`);
    }
  }

  console.log("");
  console.log(`overall=${overallPass ? "PASS" : "FAIL"}`);
  if (!overallPass) {
    process.exitCode = 1;
  }
}

main();
