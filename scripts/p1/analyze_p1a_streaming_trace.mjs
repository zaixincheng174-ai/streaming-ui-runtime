#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const EXPECTED_MEASURED_RUNS = 5;
const EXPECTED_STREAM_TOKENS = 800;
const EXPECTED_TOKEN_SAMPLE_MARKS = Array.from(
  { length: EXPECTED_STREAM_TOKENS / 100 },
  (_, index) => (index + 1) * 100
);
const MIN_READY_IDLE_MS = 2000;

function usage() {
  console.error(`Usage:
  node scripts/p1/analyze_p1a_streaming_trace.mjs --session-dir /tmp/.../<session_id>
  node scripts/p1/analyze_p1a_streaming_trace.mjs --scenario-dir /tmp/.../<scenario_id>`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let scenarioDir = null;
  let sessionDir = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--scenario-dir") {
      scenarioDir = argv[index + 1];
      index += 1;
    } else if (arg === "--session-dir") {
      sessionDir = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  if ((scenarioDir && sessionDir) || (!scenarioDir && !sessionDir)) {
    usage();
    process.exit(1);
  }

  return { scenarioDir, sessionDir };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function traceEvents(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.traceEvents)) {
    return payload.traceEvents;
  }
  return [];
}

function roundMetric(value) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : null;
}

function eventTimestamp(event) {
  return typeof event.ts === "number" ? event.ts : null;
}

function eventDurationMs(event) {
  return typeof event.dur === "number" ? event.dur / 1000 : 0;
}

function eventEndTimestamp(event) {
  const timestamp = eventTimestamp(event);
  if (timestamp === null) {
    return null;
  }
  return timestamp + (typeof event.dur === "number" ? event.dur : 0);
}

function threadKey(event) {
  return `${event.pid}:${event.tid}`;
}

function isMainThreadEvent(event, mainThreads) {
  return mainThreads.size === 0 || mainThreads.has(threadKey(event));
}

function overlapsWindow(event, startTs, endTs) {
  const eventStartTs = eventTimestamp(event);
  const eventEndTs = eventEndTimestamp(event);
  if (eventStartTs === null || eventEndTs === null) {
    return false;
  }
  return eventStartTs < endTs && eventEndTs > startTs;
}

function collectTraceContext(events) {
  const marks = [];
  const mainThreads = new Set();

  for (const event of events) {
    if (event.name === "thread_name" && event.args?.name === "CrRendererMain") {
      mainThreads.add(threadKey(event));
    }
    if (typeof event.name === "string" && eventTimestamp(event) !== null) {
      marks.push(event);
    }
  }

  return { marks, mainThreads };
}

function findFirstMark(marks, exactName) {
  return marks.find((event) => event.name === exactName) ?? null;
}

function findFirstMarkWithPrefix(marks, prefix) {
  return marks.find((event) => event.name.startsWith(prefix)) ?? null;
}

function captureIndexFromMarks(marks) {
  let streamStartCaptureIndex = null;
  for (const mark of marks) {
    const match = mark.name.match(/^p1:capture:(\d+):stream:start$/);
    if (match) {
      streamStartCaptureIndex = Number(match[1]);
    }
  }
  if (streamStartCaptureIndex !== null) {
    return streamStartCaptureIndex;
  }

  for (const mark of marks) {
    const match = mark.name.match(/^p1:capture:(\d+):/);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

function parseMetricMark(marks, captureIndex, metricName) {
  const prefix = `p1:capture:${captureIndex}:metric:${metricName}=`;
  const mark = findFirstMarkWithPrefix(marks, prefix);
  if (!mark) {
    return { value: null, mark: null };
  }

  const rawValue = mark.name.slice(prefix.length);
  const value = Number(rawValue);
  return {
    value: Number.isFinite(value) ? value : null,
    mark
  };
}

function parseReadyIdleMark(marks, captureIndex) {
  const prefix = `p1:capture:${captureIndex}:ready:idle-ms=`;
  const mark = findFirstMarkWithPrefix(marks, prefix);
  if (!mark) {
    return { value: null, mark: null };
  }
  const rawValue = mark.name.slice(prefix.length);
  const value = Number(rawValue);
  return {
    value: Number.isFinite(value) ? value : null,
    mark
  };
}

function parseAuditMarks(marks, captureIndex) {
  const prefix = `p1:capture:${captureIndex}:audit:`;
  const audit = {};

  for (const mark of marks) {
    if (!mark.name.startsWith(prefix)) {
      continue;
    }

    const payload = mark.name.slice(prefix.length);
    const separatorIndex = payload.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = payload.slice(0, separatorIndex);
    const rawValue = payload.slice(separatorIndex + 1);
    const numericValue = Number(rawValue);
    audit[key] = Number.isFinite(numericValue) && rawValue.trim() !== ""
      ? numericValue
      : rawValue;
  }

  return audit;
}

function measuredRunTarget(runsDir) {
  const metadataFiles = fs
    .readdirSync(runsDir)
    .filter((entry) => entry.endsWith(".meta.json"))
    .sort();

  const metadata = metadataFiles.map((entry) => readJson(path.join(runsDir, entry)));
  return metadata.find((entry) => entry.run_kind === "measured")?.measured_runs_target ?? EXPECTED_MEASURED_RUNS;
}

function expectedTraceNames(runsDir) {
  const measuredTarget = measuredRunTarget(runsDir);
  return [
    "warmup-01.trace.json",
    ...Array.from({ length: measuredTarget }, (_, index) => `measure-${String(index + 1).padStart(2, "0")}.trace.json`)
  ];
}

function scenarioRequiresScrollback(scenarioDir) {
  const scenarioId = path.basename(scenarioDir);
  return scenarioId.includes("scrollback");
}

function analyzeTrace(tracePath, { requireScrollback }) {
  const payload = readJson(tracePath);
  const events = traceEvents(payload);
  const { marks, mainThreads } = collectTraceContext(events);
  const captureIndex = captureIndexFromMarks(marks);
  const missing = [];

  if (!captureIndex) {
    missing.push("p1:capture:<n>");
    return {
      mark_check: "FAIL",
      capture_index: null,
      missing_marks: missing,
      ready_idle_ms: null,
      final_token_count: null,
      tail_miss_count: null,
      stream_window_ms: null,
      stream_run_task_max_ms: null,
      stream_long_task_count_50ms: null
    };
  }

  const requiredExactMarks = [
    `p1:capture:${captureIndex}:stream:start`,
    `p1:capture:${captureIndex}:stream:end`,
    ...EXPECTED_TOKEN_SAMPLE_MARKS.map((token) => `p1:capture:${captureIndex}:stream:token-${token}`)
  ];

  if (requireScrollback) {
    requiredExactMarks.push(
      `p1:capture:${captureIndex}:scrollback:start`,
      `p1:capture:${captureIndex}:scrollback:resume-tail`
    );
  }

  for (const markName of requiredExactMarks) {
    if (!findFirstMark(marks, markName)) {
      missing.push(markName);
    }
  }

  const readyIdle = parseReadyIdleMark(marks, captureIndex);
  if (!readyIdle.mark) {
    missing.push(`p1:capture:${captureIndex}:ready:idle-ms=<n>`);
  } else if (readyIdle.value === null || readyIdle.value < MIN_READY_IDLE_MS) {
    missing.push(`ready-idle-ms>=${MIN_READY_IDLE_MS}`);
  }

  const finalTokenCount = parseMetricMark(marks, captureIndex, "final-token-count");
  if (!finalTokenCount.mark) {
    missing.push(`p1:capture:${captureIndex}:metric:final-token-count=${EXPECTED_STREAM_TOKENS}`);
  } else if (finalTokenCount.value !== EXPECTED_STREAM_TOKENS) {
    missing.push(`final-token-count=${EXPECTED_STREAM_TOKENS}`);
  }

  const tailMissCount = parseMetricMark(marks, captureIndex, "tail_miss_count");
  if (!tailMissCount.mark || tailMissCount.value === null) {
    missing.push(`p1:capture:${captureIndex}:metric:tail_miss_count=<n>`);
  }

  const scriptedInputProbeCount = parseMetricMark(marks, captureIndex, "scripted_input_probe_count");
  const scriptedInputProbeMaxMs = parseMetricMark(marks, captureIndex, "scripted_input_probe_max_ms");
  const scriptedInputProbeTotalMs = parseMetricMark(marks, captureIndex, "scripted_input_probe_total_ms");
  const activeUnclosedCodePlainCount = parseMetricMark(marks, captureIndex, "active_unclosed_code_plain_count");
  const unclosedCodeHighlightSkippedCount = parseMetricMark(marks, captureIndex, "unclosed_code_highlight_skipped_count");
  const closedCodeHighlightCallCount = parseMetricMark(marks, captureIndex, "closed_code_highlight_call_count");
  const highlightCallCount = parseMetricMark(marks, captureIndex, "highlight_call_count");
  const createdHighlightSpanCount = parseMetricMark(marks, captureIndex, "created_highlight_span_count");
  const domNodesCreatedThisTick = parseMetricMark(marks, captureIndex, "dom_nodes_created_this_tick");
  const domNodesReplacedThisTick = parseMetricMark(marks, captureIndex, "dom_nodes_replaced_this_tick");
  const domNodesInClosedBlocksAffectedThisTick = parseMetricMark(marks, captureIndex, "dom_nodes_in_closed_blocks_affected_this_tick");
  const domNodesInActiveUnclosedBlockAffectedThisTick = parseMetricMark(marks, captureIndex, "dom_nodes_in_active_unclosed_block_affected_this_tick");
  const totalNodesCreated = parseMetricMark(marks, captureIndex, "total_nodes_created");
  const totalNodesReplaced = parseMetricMark(marks, captureIndex, "total_nodes_replaced");
  const totalNodesInClosedBlocksChurned = parseMetricMark(marks, captureIndex, "total_nodes_in_closed_blocks_churned");
  const totalNodesInActiveUnclosedBlockChanged = parseMetricMark(marks, captureIndex, "total_nodes_in_active_unclosed_block_changed");
  const closedBlockChurnRatio = parseMetricMark(marks, captureIndex, "closed_block_churn_ratio");
  const activeMessageClosedCodeBlockCount = parseMetricMark(marks, captureIndex, "active_message_closed_code_block_count");
  const activeMessageClosedCodeBlockRenderCount = parseMetricMark(marks, captureIndex, "active_message_closed_code_block_render_count");
  const activeMessageClosedCodeBlockRerenderFactor = parseMetricMark(marks, captureIndex, "active_message_closed_code_block_rerender_factor");
  const activeMessageClosedCodeDomNodesCreated = parseMetricMark(marks, captureIndex, "active_message_closed_code_dom_nodes_created");
  const activeMessageClosedCodeDomNodesReplaced = parseMetricMark(marks, captureIndex, "active_message_closed_code_dom_nodes_replaced");
  const uniqueClosedCodeBlockCount = parseMetricMark(marks, captureIndex, "unique_closed_code_block_count");
  const closedCodeBlockEncounterCount = parseMetricMark(marks, captureIndex, "closed_code_block_encounter_count");
  const closedCodeBlockActualRenderCount = parseMetricMark(marks, captureIndex, "closed_code_block_actual_render_count");
  const closedCodeBlockReuseCount = parseMetricMark(marks, captureIndex, "closed_code_block_reuse_count");
  const closedCodeBlockCacheHitCount = parseMetricMark(marks, captureIndex, "closed_code_block_cache_hit_count");
  const closedCodeBlockCacheMissCount = parseMetricMark(marks, captureIndex, "closed_code_block_cache_miss_count");
  const actualRenderFactor = parseMetricMark(marks, captureIndex, "actual_render_factor");
  const encounterFactor = parseMetricMark(marks, captureIndex, "encounter_factor");
  const finalRenderedTextHash = parseMetricMark(marks, captureIndex, "final_rendered_text_hash");
  const activeMessageBlockSequenceHash = parseMetricMark(marks, captureIndex, "active_message_block_sequence_hash");
  const codeBlockSignatureHash = parseMetricMark(marks, captureIndex, "code_block_signature_hash");

  const streamStart = findFirstMark(marks, `p1:capture:${captureIndex}:stream:start`);
  const streamEnd = findFirstMark(marks, `p1:capture:${captureIndex}:stream:end`);
  let streamWindowMs = null;
  let streamRunTaskMaxMs = null;
  let streamLongTaskCount50Ms = null;

  if (streamStart && streamEnd) {
    const startTs = eventTimestamp(streamStart);
    const endTs = eventTimestamp(streamEnd);
    if (startTs !== null && endTs !== null && endTs > startTs) {
      streamWindowMs = (endTs - startTs) / 1000;
      streamRunTaskMaxMs = 0;
      streamLongTaskCount50Ms = 0;
      for (const event of events) {
        if (
          event.name !== "RunTask" ||
          event.ph !== "X" ||
          !isMainThreadEvent(event, mainThreads) ||
          !overlapsWindow(event, startTs, endTs)
        ) {
          continue;
        }

        const durationMs = eventDurationMs(event);
        if (durationMs > streamRunTaskMaxMs) {
          streamRunTaskMaxMs = durationMs;
        }
        if (durationMs >= 50) {
          streamLongTaskCount50Ms += 1;
        }
      }
    }
  }

  return {
    mark_check: missing.length === 0 ? "PASS" : "FAIL",
    capture_index: captureIndex,
    missing_marks: missing,
    ready_idle_ms: readyIdle.value,
    final_token_count: finalTokenCount.value,
    tail_miss_count: tailMissCount.value,
    scripted_input_probe_count: scriptedInputProbeCount.value,
    scripted_input_probe_max_ms: roundMetric(scriptedInputProbeMaxMs.value),
    scripted_input_probe_total_ms: roundMetric(scriptedInputProbeTotalMs.value),
    active_unclosed_code_plain_count: activeUnclosedCodePlainCount.value,
    unclosed_code_highlight_skipped_count: unclosedCodeHighlightSkippedCount.value,
    closed_code_highlight_call_count: closedCodeHighlightCallCount.value,
    highlight_call_count: highlightCallCount.value,
    created_highlight_span_count: createdHighlightSpanCount.value,
    dom_nodes_created_this_tick: domNodesCreatedThisTick.value,
    dom_nodes_replaced_this_tick: domNodesReplacedThisTick.value,
    dom_nodes_in_closed_blocks_affected_this_tick: domNodesInClosedBlocksAffectedThisTick.value,
    dom_nodes_in_active_unclosed_block_affected_this_tick: domNodesInActiveUnclosedBlockAffectedThisTick.value,
    total_nodes_created: totalNodesCreated.value,
    total_nodes_replaced: totalNodesReplaced.value,
    total_nodes_in_closed_blocks_churned: totalNodesInClosedBlocksChurned.value,
    total_nodes_in_active_unclosed_block_changed: totalNodesInActiveUnclosedBlockChanged.value,
    closed_block_churn_ratio: roundMetric(closedBlockChurnRatio.value),
    active_message_closed_code_block_count: activeMessageClosedCodeBlockCount.value,
    active_message_closed_code_block_render_count: activeMessageClosedCodeBlockRenderCount.value,
    active_message_closed_code_block_rerender_factor: roundMetric(activeMessageClosedCodeBlockRerenderFactor.value),
    active_message_closed_code_dom_nodes_created: activeMessageClosedCodeDomNodesCreated.value,
    active_message_closed_code_dom_nodes_replaced: activeMessageClosedCodeDomNodesReplaced.value,
    unique_closed_code_block_count: uniqueClosedCodeBlockCount.value,
    closed_code_block_encounter_count: closedCodeBlockEncounterCount.value,
    closed_code_block_actual_render_count: closedCodeBlockActualRenderCount.value,
    closed_code_block_reuse_count: closedCodeBlockReuseCount.value,
    closed_code_block_cache_hit_count: closedCodeBlockCacheHitCount.value,
    closed_code_block_cache_miss_count: closedCodeBlockCacheMissCount.value,
    actual_render_factor: roundMetric(actualRenderFactor.value),
    encounter_factor: roundMetric(encounterFactor.value),
    final_rendered_text_hash: finalRenderedTextHash.value,
    active_message_block_sequence_hash: activeMessageBlockSequenceHash.value,
    code_block_signature_hash: codeBlockSignatureHash.value,
    content_audit: parseAuditMarks(marks, captureIndex),
    stream_window_ms: roundMetric(streamWindowMs),
    stream_run_task_max_ms: roundMetric(streamRunTaskMaxMs),
    stream_long_task_count_50ms: streamLongTaskCount50Ms
  };
}

function listScenarioDirs(sessionDir) {
  return fs
    .readdirSync(sessionDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(sessionDir, entry.name))
    .filter((dirPath) => fs.existsSync(path.join(dirPath, "runs")));
}

function median(values) {
  const filtered = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (filtered.length === 0) {
    return null;
  }
  const sorted = [...filtered].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function maxMetric(entries, key) {
  let maxValue = 0;
  for (const entry of entries) {
    const value = entry[key];
    if (typeof value === "number" && Number.isFinite(value) && value > maxValue) {
      maxValue = value;
    }
  }
  return maxValue;
}

function analyzeScenario(scenarioDir) {
  const runsDir = path.join(scenarioDir, "runs");
  if (!fs.existsSync(runsDir)) {
    fail(`runs directory not found: ${runsDir}`);
  }

  const measuredTarget = measuredRunTarget(runsDir);
  const requireScrollback = scenarioRequiresScrollback(scenarioDir);
  const traces = [];
  let failed = measuredTarget !== EXPECTED_MEASURED_RUNS;

  if (measuredTarget !== EXPECTED_MEASURED_RUNS) {
    console.error(`P1A_CHECK=FAIL measured_runs_target=${measuredTarget}; expected ${EXPECTED_MEASURED_RUNS}`);
  }

  for (const traceName of expectedTraceNames(runsDir)) {
    const tracePath = path.join(runsDir, traceName);
    if (!fs.existsSync(tracePath)) {
      traces.push({
        trace: traceName,
        mark_check: "FAIL",
        missing_marks: ["trace-file"],
        error: "trace file missing"
      });
      const prefix = traceName.startsWith("measure-") ? "P1A_CHECK" : "P1A_WARMUP_CHECK";
      console.error(`${prefix}=FAIL ${traceName} trace file missing`);
      if (traceName.startsWith("measure-")) {
        failed = true;
      }
      continue;
    }

    try {
      const analysis = analyzeTrace(tracePath, { requireScrollback });
      traces.push({ trace: traceName, ...analysis });
      const prefix = traceName.startsWith("measure-") ? "P1A_CHECK" : "P1A_WARMUP_CHECK";
      if (analysis.mark_check === "PASS") {
        console.log(`${prefix}=PASS ${traceName} capture=${analysis.capture_index}`);
      } else {
        console.error(`${prefix}=FAIL ${traceName} missing ${analysis.missing_marks.join(",")}`);
        if (traceName.startsWith("measure-")) {
          failed = true;
        }
      }
    } catch (error) {
      traces.push({
        trace: traceName,
        mark_check: "FAIL",
        missing_marks: ["parseable-trace"],
        error: error.message
      });
      const prefix = traceName.startsWith("measure-") ? "P1A_CHECK" : "P1A_WARMUP_CHECK";
      console.error(`${prefix}=FAIL ${traceName} unreadable ${error.message}`);
      if (traceName.startsWith("measure-")) {
        failed = true;
      }
    }
  }

  const measured = traces.filter((entry) => entry.trace.startsWith("measure-") && entry.mark_check === "PASS");
  if (measured.length !== EXPECTED_MEASURED_RUNS) {
    failed = true;
  }

  return {
    scenario_id: path.basename(scenarioDir),
    failed,
    measured_runs_valid: measured.length,
    measured_runs_expected: EXPECTED_MEASURED_RUNS,
    requires_scrollback_marks: requireScrollback,
    aggregate: {
      median_ready_idle_ms: roundMetric(median(measured.map((entry) => entry.ready_idle_ms))),
      median_stream_window_ms: roundMetric(median(measured.map((entry) => entry.stream_window_ms))),
      max_stream_run_task_ms: roundMetric(maxMetric(measured, "stream_run_task_max_ms")),
      max_stream_long_task_count_50ms: maxMetric(measured, "stream_long_task_count_50ms"),
      max_tail_miss_count: maxMetric(measured, "tail_miss_count"),
      max_scripted_input_probe_max_ms: roundMetric(maxMetric(measured, "scripted_input_probe_max_ms")),
      max_scripted_input_probe_count: maxMetric(measured, "scripted_input_probe_count"),
      max_active_unclosed_code_plain_count: maxMetric(measured, "active_unclosed_code_plain_count"),
      max_unclosed_code_highlight_skipped_count: maxMetric(measured, "unclosed_code_highlight_skipped_count"),
      max_closed_code_highlight_call_count: maxMetric(measured, "closed_code_highlight_call_count"),
      max_highlight_call_count: maxMetric(measured, "highlight_call_count"),
      max_created_highlight_span_count: maxMetric(measured, "created_highlight_span_count"),
      max_dom_nodes_created_this_tick: maxMetric(measured, "dom_nodes_created_this_tick"),
      max_dom_nodes_replaced_this_tick: maxMetric(measured, "dom_nodes_replaced_this_tick"),
      max_dom_nodes_in_closed_blocks_affected_this_tick: maxMetric(measured, "dom_nodes_in_closed_blocks_affected_this_tick"),
      max_dom_nodes_in_active_unclosed_block_affected_this_tick: maxMetric(measured, "dom_nodes_in_active_unclosed_block_affected_this_tick"),
      max_total_nodes_created: maxMetric(measured, "total_nodes_created"),
      max_total_nodes_replaced: maxMetric(measured, "total_nodes_replaced"),
      max_total_nodes_in_closed_blocks_churned: maxMetric(measured, "total_nodes_in_closed_blocks_churned"),
      max_total_nodes_in_active_unclosed_block_changed: maxMetric(measured, "total_nodes_in_active_unclosed_block_changed"),
      max_closed_block_churn_ratio: roundMetric(maxMetric(measured, "closed_block_churn_ratio")),
      max_active_message_closed_code_block_count: maxMetric(measured, "active_message_closed_code_block_count"),
      max_active_message_closed_code_block_render_count: maxMetric(measured, "active_message_closed_code_block_render_count"),
      max_active_message_closed_code_block_rerender_factor: roundMetric(maxMetric(measured, "active_message_closed_code_block_rerender_factor")),
      max_active_message_closed_code_dom_nodes_created: maxMetric(measured, "active_message_closed_code_dom_nodes_created"),
      max_active_message_closed_code_dom_nodes_replaced: maxMetric(measured, "active_message_closed_code_dom_nodes_replaced"),
      max_unique_closed_code_block_count: maxMetric(measured, "unique_closed_code_block_count"),
      max_closed_code_block_encounter_count: maxMetric(measured, "closed_code_block_encounter_count"),
      max_closed_code_block_actual_render_count: maxMetric(measured, "closed_code_block_actual_render_count"),
      max_closed_code_block_reuse_count: maxMetric(measured, "closed_code_block_reuse_count"),
      max_closed_code_block_cache_hit_count: maxMetric(measured, "closed_code_block_cache_hit_count"),
      max_closed_code_block_cache_miss_count: maxMetric(measured, "closed_code_block_cache_miss_count"),
      max_actual_render_factor: roundMetric(maxMetric(measured, "actual_render_factor")),
      max_encounter_factor: roundMetric(maxMetric(measured, "encounter_factor")),
      max_final_rendered_text_hash: maxMetric(measured, "final_rendered_text_hash"),
      max_active_message_block_sequence_hash: maxMetric(measured, "active_message_block_sequence_hash"),
      max_code_block_signature_hash: maxMetric(measured, "code_block_signature_hash")
    },
    traces
  };
}

const { scenarioDir, sessionDir } = parseArgs(process.argv.slice(2));
const scenarioDirs = scenarioDir ? [scenarioDir] : listScenarioDirs(sessionDir);

if (scenarioDirs.length === 0) {
  fail(`no scenario directories found under ${sessionDir}`);
}

const summaries = scenarioDirs.map((dirPath) => analyzeScenario(dirPath));
console.log(JSON.stringify(summaries, null, 2));

if (summaries.some((summary) => summary.failed)) {
  process.exit(1);
}
