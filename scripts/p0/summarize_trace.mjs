#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error(`Usage:
  node scripts/p0/summarize_trace.mjs --scenario-dir /tmp/.../<scenario_id>
  node scripts/p0/summarize_trace.mjs --session-dir /tmp/.../<session_id>`);
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

function listScenarioDirs(sessionDir) {
  return fs
    .readdirSync(sessionDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(sessionDir, entry.name))
    .filter((dirPath) => fs.existsSync(path.join(dirPath, "runs")));
}

function readInvalidRunsLog(scenarioDir) {
  const logPath = path.join(scenarioDir, "invalid-runs.log");
  const invalidations = new Map();

  if (!fs.existsSync(logPath)) {
    return invalidations;
  }

  const lines = fs
    .readFileSync(logPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  for (const line of lines) {
    const [status, filename, timestamp, reason] = line.split("\t");
    if (!filename) {
      continue;
    }
    invalidations.set(filename, {
      status,
      timestamp: timestamp ?? null,
      reason: reason ?? null
    });
  }

  return invalidations;
}

function traceEvents(tracePayload) {
  if (Array.isArray(tracePayload)) {
    return tracePayload;
  }
  if (Array.isArray(tracePayload.traceEvents)) {
    return tracePayload.traceEvents;
  }
  return [];
}

function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (percentileValue / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
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

function threadKey(event) {
  return `${event.pid}:${event.tid}`;
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

function markTimestamps(events) {
  const marks = new Map();
  for (const event of events) {
    if (typeof event.name === "string" && event.name.startsWith("p0:")) {
      const timestamp = eventTimestamp(event);
      if (timestamp !== null && !marks.has(event.name)) {
        marks.set(event.name, timestamp);
      }
    }
  }
  return marks;
}

function phaseScheduleWithOffsets(phases) {
  if (!Array.isArray(phases)) {
    return [];
  }

  let nextOffsetMs = 0;

  return phases.map((phase) => {
    const durationMs = Number(phase.duration_ms) || 0;
    const explicitStartOffsetMs = Number(phase.start_offset_ms);
    const explicitEndOffsetMs = Number(phase.end_offset_ms);
    const startOffsetMs = Number.isFinite(explicitStartOffsetMs) ? explicitStartOffsetMs : nextOffsetMs;
    const endOffsetMs = Number.isFinite(explicitEndOffsetMs) ? explicitEndOffsetMs : startOffsetMs + durationMs;

    nextOffsetMs = endOffsetMs;

    return {
      ...phase,
      duration_ms: durationMs,
      start_offset_ms: startOffsetMs,
      end_offset_ms: endOffsetMs
    };
  });
}

function inWindow(event, startTs, endTs) {
  const timestamp = eventTimestamp(event);
  if (timestamp === null) {
    return false;
  }
  return timestamp >= startTs && timestamp < endTs;
}

function analyzeRun(tracePayload, metadata) {
  const events = traceEvents(tracePayload);
  const marks = markTimestamps(events);
  const mainThreads = rendererMainThreads(events);
  const notes = [];

  if (mainThreads.size === 0) {
    notes.push("renderer_main_thread_metadata_missing; used all RunTask events");
  }

  const captureStartTs = marks.get("p0:capture:start") ?? null;
  const captureWindowMs = Number(metadata.capture_ms) || 0;
  const captureEndTs =
    captureStartTs !== null ? captureStartTs + captureWindowMs * 1000 : null;

  const eligibleRunTasks = events.filter((event) => {
    if (event.name !== "RunTask" || event.ph !== "X") {
      return false;
    }
    const durationMs = eventDurationMs(event);
    if (durationMs < 1) {
      return false;
    }
    if (mainThreads.size > 0 && !mainThreads.has(threadKey(event))) {
      return false;
    }
    if (captureStartTs !== null && captureEndTs !== null && !inWindow(event, captureStartTs, captureEndTs)) {
      return false;
    }
    return true;
  });

  const durationsMs = eligibleRunTasks.map((event) => eventDurationMs(event));
  const totalBusyMs = durationsMs.reduce((sum, value) => sum + value, 0);

  const layoutEvents = events.filter((event) => {
    if (event.name !== "Layout") {
      return false;
    }
    if (mainThreads.size > 0 && !mainThreads.has(threadKey(event))) {
      return false;
    }
    if (captureStartTs !== null && captureEndTs !== null && !inWindow(event, captureStartTs, captureEndTs)) {
      return false;
    }
    return true;
  });

  const paintEvents = events.filter((event) => {
    if (event.name !== "Paint") {
      return false;
    }
    if (mainThreads.size > 0 && !mainThreads.has(threadKey(event))) {
      return false;
    }
    if (captureStartTs !== null && captureEndTs !== null && !inWindow(event, captureStartTs, captureEndTs)) {
      return false;
    }
    return true;
  });

  const metrics = {
    trace_window_ms: roundMetric(captureWindowMs),
    run_task_p95_ms: roundMetric(percentile(durationsMs, 95)),
    run_task_max_ms: roundMetric(durationsMs.length > 0 ? Math.max(...durationsMs) : 0),
    run_task_busy_pct: roundMetric(captureWindowMs > 0 ? (totalBusyMs / captureWindowMs) * 100 : 0),
    long_task_count_50ms: durationsMs.filter((value) => value >= 50).length,
    layout_event_count: layoutEvents.length,
    paint_event_count: paintEvents.length
  };

  const userTimingMarks = [...marks.keys()].sort();

  let manualScrollMetrics = null;
  const manualScrollPhase = phaseScheduleWithOffsets(metadata.phase_schedule)
    .find((phase) => phase.id === "manual_scroll");

  if (captureStartTs !== null && manualScrollPhase) {
    const phaseStartTs = captureStartTs + Number(manualScrollPhase.start_offset_ms) * 1000;
    const phaseEndTs = captureStartTs + Number(manualScrollPhase.end_offset_ms) * 1000;

    const phaseRunTasks = eligibleRunTasks.filter((event) => inWindow(event, phaseStartTs, phaseEndTs));
    const phaseDurations = phaseRunTasks.map((event) => eventDurationMs(event));
    const phaseLayoutPaintCount = events.filter((event) => {
      if (event.name !== "Layout" && event.name !== "Paint") {
        return false;
      }
      if (mainThreads.size > 0 && !mainThreads.has(threadKey(event))) {
        return false;
      }
      return inWindow(event, phaseStartTs, phaseEndTs);
    }).length;

    const phaseSeconds = Number(manualScrollPhase.duration_ms) / 1000;
    manualScrollMetrics = {
      run_task_p95_ms: roundMetric(percentile(phaseDurations, 95)),
      long_task_count_50ms: phaseDurations.filter((value) => value >= 50).length,
      layout_paint_events_per_s: roundMetric(phaseSeconds > 0 ? phaseLayoutPaintCount / phaseSeconds : 0)
    };
  }

  return {
    metrics,
    manualScrollMetrics,
    userTimingMarks,
    notes
  };
}

function loadRunArtifacts(scenarioDir) {
  const runsDir = path.join(scenarioDir, "runs");
  if (!fs.existsSync(runsDir)) {
    fail(`runs directory not found: ${runsDir}`);
  }

  const metadataFiles = fs
    .readdirSync(runsDir)
    .filter((entry) => entry.endsWith(".meta.json"))
    .sort();

  return metadataFiles.map((entry) => {
    const metadataPath = path.join(runsDir, entry);
    const metadata = readJson(metadataPath);
    const tracePath = path.join(runsDir, metadata.trace_filename);
    const tracePresent = fs.existsSync(tracePath);
    const traceParseable = tracePresent ? (() => {
      try {
        const payload = readJson(tracePath);
        return Array.isArray(traceEvents(payload));
      } catch {
        return false;
      }
    })() : false;

    let tracePayload = null;
    if (traceParseable) {
      tracePayload = readJson(tracePath);
    }

    return {
      metadataPath,
      metadata,
      tracePath,
      tracePayload,
      tracePresent,
      traceParseable
    };
  });
}

function scenarioSummary(scenarioDir, baselineCache) {
  const invalidations = readInvalidRunsLog(scenarioDir);
  const runArtifacts = loadRunArtifacts(scenarioDir);
  const measuredTarget = runArtifacts.find((artifact) => artifact.metadata.run_kind === "measured")?.metadata.measured_runs_target ?? 5;
  const warmupTarget = runArtifacts.find((artifact) => artifact.metadata.run_kind === "warmup")?.metadata.warmup_runs_target ?? 1;
  const sessionId = runArtifacts[0]?.metadata.session_id ?? path.basename(path.dirname(scenarioDir));
  const scenarioId = runArtifacts[0]?.metadata.scenario_id ?? path.basename(scenarioDir);
  const targetId = runArtifacts[0]?.metadata.target_id ?? null;
  const targetClass = runArtifacts[0]?.metadata.target_class ?? null;
  const notes = [];

  const warmups = runArtifacts.filter((artifact) => artifact.metadata.run_kind === "warmup");
  const measuredCandidates = runArtifacts
    .filter((artifact) => artifact.metadata.run_kind === "measured")
    .map((artifact) => {
      const invalidation = invalidations.get(artifact.metadata.trace_filename);
      return {
        ...artifact,
        invalidationStatus: invalidation?.status ?? null,
        invalidationReason: invalidation?.reason ?? null
      };
    });

  const eligibleMeasured = measuredCandidates
    .filter((artifact) => artifact.traceParseable)
    .filter((artifact) => artifact.invalidationStatus !== "confirmed")
    .sort((left, right) => left.metadata.attempt_sequence - right.metadata.attempt_sequence);

  const eligibleBySlot = new Map();
  for (const artifact of eligibleMeasured) {
    const slot = Number(artifact.metadata.run_slot);
    const entries = eligibleBySlot.get(slot) ?? [];
    entries.push(artifact);
    eligibleBySlot.set(slot, entries);
  }

  const includedMeasured = [];
  let ignoredExtraMeasured = 0;

  for (let slot = 1; slot <= measuredTarget; slot += 1) {
    const slotCandidates = eligibleBySlot.get(slot) ?? [];
    if (slotCandidates.length === 0) {
      continue;
    }

    const canonicalTraceName = `measure-${String(slot).padStart(2, "0")}.trace.json`;
    const canonicalCandidate =
      slotCandidates.find((artifact) => artifact.metadata.trace_filename === canonicalTraceName) ?? null;
    const selectedCandidate = canonicalCandidate ?? slotCandidates[slotCandidates.length - 1];
    includedMeasured.push(selectedCandidate);

    if (slotCandidates.length > 1) {
      ignoredExtraMeasured += slotCandidates.length - 1;
      notes.push(
        `slot ${String(slot).padStart(2, "0")} had ${slotCandidates.length} eligible measured traces; counted ${selectedCandidate.metadata.trace_filename}`
      );
    }
  }

  if (ignoredExtraMeasured > 0) {
    notes.push(`ignored ${ignoredExtraMeasured} extra eligible measured trace(s) because only one trace per measured slot is counted`);
  }

  const pendingInvalidations = [...invalidations.values()].filter((entry) => entry.status === "pending").length;
  if (pendingInvalidations > 0) {
    notes.push(`${pendingInvalidations} invalidation(s) remain pending and are not excluded by the summarizer`);
  }

  const analyzedRuns = includedMeasured.map((artifact) => {
    const analysis = analyzeRun(artifact.tracePayload, artifact.metadata);
    return {
      ...artifact,
      analysis
    };
  });

  for (const artifact of analyzedRuns) {
    notes.push(...artifact.analysis.notes);
  }

  const metricMedians = {
    run_task_p95_ms: roundMetric(median(analyzedRuns.map((run) => run.analysis.metrics.run_task_p95_ms))),
    run_task_max_ms: roundMetric(median(analyzedRuns.map((run) => run.analysis.metrics.run_task_max_ms))),
    run_task_busy_pct: roundMetric(median(analyzedRuns.map((run) => run.analysis.metrics.run_task_busy_pct))),
    long_task_count_50ms: roundMetric(median(analyzedRuns.map((run) => run.analysis.metrics.long_task_count_50ms))),
    layout_event_count: roundMetric(median(analyzedRuns.map((run) => run.analysis.metrics.layout_event_count))),
    paint_event_count: roundMetric(median(analyzedRuns.map((run) => run.analysis.metrics.paint_event_count)))
  };

  const anchorLevels = analyzedRuns.map((run) => run.metadata.operator_notes?.anchor_level).filter(Boolean);
  const anchorRawNotes = analyzedRuns.map((run) => ({
    run: run.metadata.trace_filename,
    level: run.metadata.operator_notes?.anchor_level ?? null,
    note: run.metadata.operator_notes?.anchor_note ?? null
  }));

  const anchorSummary = {
    none_count: anchorLevels.filter((level) => level === "none").length,
    minor_count: anchorLevels.filter((level) => level === "minor").length,
    major_count: anchorLevels.filter((level) => level === "major").length,
    raw_notes: anchorRawNotes,
    signal_positive: anchorLevels.filter((level) => level === "minor" || level === "major").length >= 2
  };

  const proxySignals = {};
  let scenarioSignalName = null;
  let scenarioSignalPositive = null;

  if (scenarioId === "s03_scroll_jump_resume") {
    const manualScrollRuns = analyzedRuns
      .map((run) => run.analysis.manualScrollMetrics)
      .filter(Boolean);
    const scrollP95 = roundMetric(median(manualScrollRuns.map((run) => run.run_task_p95_ms)));
    const scrollLongTasks = roundMetric(median(manualScrollRuns.map((run) => run.long_task_count_50ms)));
    const scrollRate = roundMetric(median(manualScrollRuns.map((run) => run.layout_paint_events_per_s)));
    scenarioSignalName = "scroll_jank_proxy";
    scenarioSignalPositive = (scrollP95 ?? 0) > 16.7 || (scrollLongTasks ?? 0) >= 1;
    proxySignals.scroll_jank_proxy = {
      run_task_p95_ms: scrollP95,
      long_task_count_50ms: scrollLongTasks,
      layout_paint_events_per_s: scrollRate,
      signal_positive: scenarioSignalPositive
    };
  }

  if (scenarioId === "s02_append_scrollback") {
    scenarioSignalName = "append_under_scrollback_proxy";
    const baseline = baselineCache.get("s01_tail_append") ?? null;
    let busyRatio = null;
    let longTaskDelta = null;
    let layoutPaintRateRatio = null;

    const scenarioLayoutPaintRate = (() => {
      const captureSeconds = includedMeasured[0]?.metadata.capture_ms ? Number(includedMeasured[0].metadata.capture_ms) / 1000 : 0;
      if (captureSeconds <= 0) {
        return 0;
      }
      return median(
        analyzedRuns.map((run) =>
          (run.analysis.metrics.layout_event_count + run.analysis.metrics.paint_event_count) / captureSeconds
        )
      );
    })();

    if (baseline) {
      busyRatio = baseline.metrics.run_task_busy_pct > 0
        ? roundMetric(metricMedians.run_task_busy_pct / baseline.metrics.run_task_busy_pct)
        : null;
      longTaskDelta = roundMetric(metricMedians.long_task_count_50ms - baseline.metrics.long_task_count_50ms);
      layoutPaintRateRatio = baseline.layoutPaintRate > 0
        ? roundMetric(scenarioLayoutPaintRate / baseline.layoutPaintRate)
        : null;
      scenarioSignalPositive = (busyRatio ?? 0) >= 1.5 || (layoutPaintRateRatio ?? 0) >= 1.5;
    } else {
      notes.push("baseline scenario s01_tail_append was not available; append_under_scrollback ratios are null");
      scenarioSignalPositive = null;
    }

    proxySignals.append_under_scrollback_proxy = {
      busy_pct_ratio_vs_tail: busyRatio,
      long_task_delta_vs_tail: longTaskDelta,
      layout_paint_rate_ratio_vs_tail: layoutPaintRateRatio,
      signal_positive: scenarioSignalPositive
    };
  }

  const summary = {
    session_id: sessionId,
    scenario_id: scenarioId,
    target_id: targetId,
    target_class: targetClass,
    warmup_runs: warmupTarget,
    measured_runs: measuredTarget,
    valid_measured_runs: includedMeasured.length,
    metrics: metricMedians,
    proxy_signals: proxySignals,
    anchor_notes_summary: anchorSummary,
    gate_eval: {
      scenario_signal: {
        name: scenarioSignalName,
        positive: scenarioSignalPositive
      },
      session_gate: {
        eligible: false,
        thesis_signal_count: null,
        recommendation: "not-evaluated",
        reason: "session-level gate not computed yet"
      }
    },
    notes
  };

  const captureSeconds = includedMeasured[0]?.metadata.capture_ms ? Number(includedMeasured[0].metadata.capture_ms) / 1000 : 0;
  baselineCache.set(scenarioId, {
    metrics: metricMedians,
    layoutPaintRate:
      captureSeconds > 0
        ? median(
            analyzedRuns.map((run) =>
              (run.analysis.metrics.layout_event_count + run.analysis.metrics.paint_event_count) / captureSeconds
            )
          )
        : 0,
    anchorPositive: anchorSummary.signal_positive,
    scenarioSignalPositive
  });

  return summary;
}

function applySessionGate(summaries) {
  const byScenario = new Map(summaries.map((summary) => [summary.scenario_id, summary]));
  const controlled = summaries.every((summary) => summary.target_class === "controlled");
  const complete = ["s01_tail_append", "s02_append_scrollback", "s03_scroll_jump_resume"].every(
    (scenarioId) => byScenario.has(scenarioId) && byScenario.get(scenarioId).valid_measured_runs === 5
  );

  let thesisSignalCount = null;
  let recommendation = "not-evaluated";
  let reason = "session is incomplete";

  if (controlled && complete) {
    const appendSignal = byScenario.get("s02_append_scrollback").proxy_signals.append_under_scrollback_proxy?.signal_positive === true;
    const scrollSignal = byScenario.get("s03_scroll_jump_resume").proxy_signals.scroll_jank_proxy?.signal_positive === true;
    const anchorSignal =
      byScenario.get("s02_append_scrollback").anchor_notes_summary.signal_positive === true ||
      byScenario.get("s03_scroll_jump_resume").anchor_notes_summary.signal_positive === true;
    thesisSignalCount = [appendSignal, scrollSignal, anchorSignal].filter(Boolean).length;
    recommendation = thesisSignalCount >= 2 ? "advance-to-p1" : "stay-in-p0";
    reason = thesisSignalCount >= 2
      ? "controlled target produced at least two positive thesis signals"
      : "controlled target did not produce two positive thesis signals";
  } else if (!controlled) {
    reason = "session target_class is not controlled";
  }

  for (const summary of summaries) {
    summary.gate_eval.session_gate = {
      eligible: controlled && complete,
      thesis_signal_count: thesisSignalCount,
      recommendation,
      reason
    };
    if (summary.valid_measured_runs < 5) {
      summary.notes.push("summary is partial; final gate use requires five valid measured runs");
    }
  }
}

function buildSummaries(sessionDir) {
  const baselineCache = new Map();
  const scenarioDirs = listScenarioDirs(sessionDir).sort();
  if (scenarioDirs.length === 0) {
    fail(`no scenario directories found under ${sessionDir}`);
  }
  const summaries = scenarioDirs.map((scenarioDir) => scenarioSummary(scenarioDir, baselineCache));
  applySessionGate(summaries);
  return summaries;
}

const { scenarioDir, sessionDir } = parseArgs(process.argv.slice(2));

if (sessionDir) {
  const summaries = buildSummaries(sessionDir);
  console.log(JSON.stringify(summaries, null, 2));
} else {
  const summaries = buildSummaries(path.dirname(scenarioDir));
  const requested = path.basename(scenarioDir);
  const summary = summaries.find((entry) => entry.scenario_id === requested);
  if (!summary) {
    fail(`scenario summary not found for ${requested}`);
  }
  console.log(JSON.stringify(summary, null, 2));
}
