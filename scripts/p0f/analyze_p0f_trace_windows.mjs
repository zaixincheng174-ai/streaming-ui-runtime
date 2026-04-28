#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error(`Usage:
  node scripts/p0f/analyze_p0f_trace_windows.mjs --session-dir /tmp/.../<session_id>
  node scripts/p0f/analyze_p0f_trace_windows.mjs --scenario-dir /tmp/.../<scenario_id>`);
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

function roundMetric(value) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : null;
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

function threadKey(event) {
  return `${event.pid}:${event.tid}`;
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

function rendererMainThreads(events) {
  const keys = new Set();
  for (const event of events) {
    if (event.name === "thread_name" && event.args?.name === "CrRendererMain") {
      keys.add(threadKey(event));
    }
  }
  return keys;
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

function markEvents(events) {
  return events.filter((event) => typeof event.name === "string" && eventTimestamp(event) !== null);
}

function findFirstMark(marks, prefix) {
  return marks.find((event) => event.name === prefix || event.name.startsWith(`${prefix}:`)) ?? null;
}

function detectMarkFamily(marks) {
  if (marks.some((event) => event.name.startsWith("p0f:click:"))) {
    return {
      name: "p0f",
      prefixes: ["p0f:click", "p0f:batch:start", "p0f:batch:end"]
    };
  }

  if (marks.some((event) => event.name.startsWith("p1:click:"))) {
    return {
      name: "p1",
      prefixes: ["p1:click", "p1:batch:start", "p1:batch:end"]
    };
  }

  if (marks.some((event) => event.name.startsWith("p0e:click"))) {
    return {
      name: "p0e",
      prefixes: ["p0e:click", "p0e:batch:start", "p0e:batch:end"]
    };
  }

  return {
    name: "unknown",
    prefixes: ["p0f:click", "p0f:batch:start", "p0f:batch:end"]
  };
}

function expectedTraceNames(runsDir) {
  const metadataFiles = fs
    .readdirSync(runsDir)
    .filter((entry) => entry.endsWith(".meta.json"))
    .sort();

  const metadata = metadataFiles.map((entry) => readJson(path.join(runsDir, entry)));
  const measuredTarget =
    metadata.find((entry) => entry.run_kind === "measured")?.measured_runs_target ?? 5;

  return [
    "warmup-01.trace.json",
    ...Array.from({ length: measuredTarget }, (_, index) => `measure-${String(index + 1).padStart(2, "0")}.trace.json`)
  ];
}

function analyzeTrace(tracePath) {
  const payload = readJson(tracePath);
  const events = traceEvents(payload);
  const marks = markEvents(events);
  const mainThreads = rendererMainThreads(events);
  const family = detectMarkFamily(marks);
  const missingMarks = [];
  const foundMarks = {};

  for (const prefix of family.prefixes) {
    const mark = findFirstMark(marks, prefix);
    if (!mark) {
      missingMarks.push(prefix);
    } else {
      foundMarks[prefix] = mark;
    }
  }

  const startMark = foundMarks[family.prefixes[1]] ?? null;
  const endMark = foundMarks[family.prefixes[2]] ?? null;
  let batchWindowMs = null;
  let runTaskMaxMs = null;
  let runMicrotasksMs = null;
  let microtaskShareOfWindow = null;
  let renderingNamedSumMs = null;

  if (startMark && endMark) {
    const startTs = eventTimestamp(startMark);
    const endTs = eventTimestamp(endMark);
    if (startTs !== null && endTs !== null && endTs > startTs) {
      batchWindowMs = (endTs - startTs) / 1000;
      const windowEvents = events.filter((event) =>
        event.ph === "X" &&
        isMainThreadEvent(event, mainThreads) &&
        overlapsWindow(event, startTs, endTs)
      );
      const runTasks = windowEvents.filter((event) => event.name === "RunTask");
      const microtasks = windowEvents.filter((event) => event.name === "RunMicrotasks");
      const renderingNames = new Set(["Layout", "Paint", "PrePaint", "UpdateLayoutTree", "CompositeLayers"]);
      const renderingEvents = windowEvents.filter((event) => renderingNames.has(event.name));

      runTaskMaxMs = runTasks.length > 0
        ? Math.max(...runTasks.map((event) => eventDurationMs(event)))
        : 0;
      runMicrotasksMs = microtasks.reduce((sum, event) => sum + eventDurationMs(event), 0);
      microtaskShareOfWindow = batchWindowMs > 0 ? runMicrotasksMs / batchWindowMs : null;
      renderingNamedSumMs = renderingEvents.reduce((sum, event) => sum + eventDurationMs(event), 0);
    }
  }

  return {
    mark_family: family.name,
    mark_check: missingMarks.length === 0 ? "PASS" : "FAIL",
    missing_marks: missingMarks,
    batch_window_ms: roundMetric(batchWindowMs),
    run_task_max_ms: roundMetric(runTaskMaxMs),
    run_microtasks_ms: roundMetric(runMicrotasksMs),
    microtask_share_of_window: roundMetric(microtaskShareOfWindow),
    rendering_named_sum_ms: roundMetric(renderingNamedSumMs)
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

function analyzeScenario(scenarioDir) {
  const runsDir = path.join(scenarioDir, "runs");
  if (!fs.existsSync(runsDir)) {
    fail(`runs directory not found: ${runsDir}`);
  }

  const traces = [];
  let failed = false;

  for (const traceName of expectedTraceNames(runsDir)) {
    const tracePath = path.join(runsDir, traceName);
    if (!fs.existsSync(tracePath)) {
      traces.push({
        trace: traceName,
        mark_check: "FAIL",
        missing_marks: ["trace-file"],
        error: "trace file missing"
      });
      console.error(`MARK_CHECK=FAIL ${traceName} trace file missing`);
      failed = true;
      continue;
    }

    try {
      const analysis = analyzeTrace(tracePath);
      traces.push({ trace: traceName, ...analysis });
      if (analysis.mark_check === "PASS") {
        console.log(`MARK_CHECK=PASS ${traceName} family=${analysis.mark_family}`);
      } else {
        console.error(`MARK_CHECK=FAIL ${traceName} missing ${analysis.missing_marks.join(",")}`);
        failed = true;
      }
    } catch (error) {
      traces.push({
        trace: traceName,
        mark_check: "FAIL",
        missing_marks: ["parseable-trace"],
        error: error.message
      });
      console.error(`MARK_CHECK=FAIL ${traceName} unreadable ${error.message}`);
      failed = true;
    }
  }

  const measured = traces.filter((entry) => entry.trace.startsWith("measure-") && entry.mark_check === "PASS");

  return {
    scenario_id: path.basename(scenarioDir),
    failed,
    aggregate: {
      max_batch_window_ms: roundMetric(Math.max(0, ...measured.map((entry) => entry.batch_window_ms ?? 0))),
      median_batch_window_ms: roundMetric(median(measured.map((entry) => entry.batch_window_ms))),
      max_run_task_ms: roundMetric(Math.max(0, ...measured.map((entry) => entry.run_task_max_ms ?? 0))),
      max_run_microtasks_ms: roundMetric(Math.max(0, ...measured.map((entry) => entry.run_microtasks_ms ?? 0))),
      median_microtask_share_of_window: roundMetric(median(measured.map((entry) => entry.microtask_share_of_window))),
      max_rendering_named_sum_ms: roundMetric(Math.max(0, ...measured.map((entry) => entry.rendering_named_sum_ms ?? 0)))
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
