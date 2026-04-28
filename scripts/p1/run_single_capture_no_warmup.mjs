#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const TRACE_CATEGORIES = "blink.user_timing,devtools.timeline,disabled-by-default-devtools.timeline,toplevel,loading,latencyInfo,cc,v8.execute";
const WINDOW_SIZE = "1440x900";
const READINESS_TIMEOUT_MS = 30000;
const READINESS_POLL_MS = 250;
const MIN_READY_IDLE_MS = 2000;
const VISIBILITY_RAF_MIN_FPS = 20;
const VISIBILITY_RAF_MAX_FPS = 144;

function usage() {
  console.log(`Usage:
  node scripts/p1/run_single_capture_no_warmup.mjs \\
    --browser /path/to/chrome \\
    --target-url http://127.0.0.1:4319/p1_streaming_chat_baseline.html?... \\
    --scenario bench/p1/scenarios/p1a_stream_tail_follow_20ms.json \\
    --out-dir /tmp/streaming-ui-runtime-p1/p1c2a-no-warmup-01 \\
    --remote-debugging-port 9421 \\
    --run-label measure-01

Options:
  --analyze-existing-trace /tmp/.../measure-01.trace.json
             Replay forensics on an existing trace without launching Chrome.
  --meta-out /tmp/.../measure-01.meta.json
             Metadata output path for --analyze-existing-trace.
  --forensics-out /tmp/.../measure-01.forensics.json
             Forensics output path for --analyze-existing-trace.
  --visibility-frame-probe
             Record helper-side visibility/focus/rAF scalar probes in metadata.
  --macos-activate-browser
             Before readiness, ask macOS to activate Google Chrome via osascript.
  --foreground-settle-ms 1000
             Wait this many ms after foreground activation. Defaults to 1000
             when --macos-activate-browser is enabled, otherwise 0.
  --dry-run   Validate paths and write dry-run metadata without launching Chrome.
  --help      Show this help.

This P1 diagnostic helper intentionally performs no warmup capture. It mirrors
the P0 CDP capture order after Chrome launch:
  CDP setup -> scenario settle -> readiness gate -> Tracing.start ->
  p0:capture:start -> scenario phases -> p0:capture:end -> Tracing.end`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    visibilityFrameProbe: false,
    macosActivateBrowser: false,
    foregroundSettleMs: null,
    runLabel: "measure-01"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--browser") {
      args.browser = argv[index + 1];
      index += 1;
    } else if (arg === "--target-url") {
      args.targetUrl = argv[index + 1];
      index += 1;
    } else if (arg === "--scenario") {
      args.scenario = argv[index + 1];
      index += 1;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--remote-debugging-port") {
      args.remoteDebuggingPort = Number(argv[index + 1]);
      index += 1;
    } else if (arg === "--run-label") {
      args.runLabel = argv[index + 1];
      index += 1;
    } else if (arg === "--analyze-existing-trace") {
      args.analyzeExistingTrace = argv[index + 1];
      index += 1;
    } else if (arg === "--meta-out") {
      args.metaOut = argv[index + 1];
      index += 1;
    } else if (arg === "--forensics-out") {
      args.forensicsOut = argv[index + 1];
      index += 1;
    } else if (arg === "--visibility-frame-probe") {
      args.visibilityFrameProbe = true;
    } else if (arg === "--macos-activate-browser") {
      args.macosActivateBrowser = true;
    } else if (arg === "--foreground-settle-ms") {
      args.foregroundSettleMs = Number(argv[index + 1]);
      index += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  if (args.analyzeExistingTrace) {
    if (!args.metaOut) {
      fail("--meta-out is required with --analyze-existing-trace");
    }
    if (!args.forensicsOut) {
      fail("--forensics-out is required with --analyze-existing-trace");
    }
    if (!fs.existsSync(args.analyzeExistingTrace)) {
      fail(`trace file not found: ${args.analyzeExistingTrace}`);
    }
    return args;
  }

  if (args.foregroundSettleMs === null) {
    args.foregroundSettleMs = args.macosActivateBrowser ? 1000 : 0;
  }
  if (!Number.isFinite(args.foregroundSettleMs) || args.foregroundSettleMs < 0) {
    fail("--foreground-settle-ms must be a non-negative number");
  }

  for (const key of ["browser", "targetUrl", "scenario", "outDir"]) {
    if (!args[key]) {
      fail(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`);
    }
  }
  if (!Number.isInteger(args.remoteDebuggingPort) || args.remoteDebuggingPort < 1 || args.remoteDebuggingPort > 65535) {
    fail("--remote-debugging-port must be an integer from 1 to 65535");
  }
  if (!/^measure-\d{2}$/.test(args.runLabel)) {
    fail("--run-label must look like measure-01");
  }
  fs.accessSync(args.browser, fs.constants.X_OK);
  if (!fs.existsSync(args.scenario)) {
    fail(`scenario file not found: ${args.scenario}`);
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  return readJson(filePath);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function portIsListening(port) {
  try {
    await fetchJson(`http://127.0.0.1:${port}/json/version`);
    return true;
  } catch {
    return false;
  }
}

async function ensurePortAvailable(port) {
  if (await portIsListening(port)) {
    fail(`remote debugging port ${port} is already in use`);
  }
}

class CdpConnection {
  constructor(url) {
    this.url = url;
    this.nextId = 0;
    this.pending = new Map();
    this.waiters = new Map();
    this.onEvent = null;
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out opening ${this.url}`)), 10000);
      this.ws = new WebSocket(this.url);
      this.ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.addEventListener("message", (event) => this.#handleMessage(event));
      this.ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error(`WebSocket error for ${this.url}`));
      });
      this.ws.addEventListener("close", () => {
        for (const pending of this.pending.values()) {
          pending.reject(new Error(`Connection closed: ${this.url}`));
        }
        this.pending.clear();
      });
    });
  }

  #handleMessage(event) {
    const message = JSON.parse(event.data);
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result ?? {});
      }
      return;
    }

    if (!message.method) {
      return;
    }
    if (typeof this.onEvent === "function") {
      this.onEvent(message.method, message.params ?? {});
    }

    const waiters = this.waiters.get(message.method);
    if (waiters && waiters.length > 0) {
      const next = waiters.shift();
      next(message.params ?? {});
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  waitFor(method) {
    return new Promise((resolve) => {
      const waiters = this.waiters.get(method) || [];
      waiters.push(resolve);
      this.waiters.set(method, waiters);
    });
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

async function waitForCdp(port) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await fetchJson(`http://127.0.0.1:${port}/json/version`);
      return;
    } catch {
      await sleep(1000);
    }
  }
  throw new Error(`Chrome CDP endpoint did not become ready on port ${port}`);
}

async function resolvePage(port, targetUrl) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const pages = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const pageTargets = pages.filter((entry) => entry.type === "page");
    const chosen =
      pageTargets.find((entry) => entry.url === targetUrl) ||
      pageTargets[pageTargets.length - 1];
    if (chosen) {
      return chosen;
    }
    await sleep(500);
  }
  throw new Error("No page target found for tracing");
}

async function evaluate(page, expression) {
  const response = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) {
    throw new Error(`Runtime.evaluate failed: ${JSON.stringify(response.exceptionDetails)}`);
  }
  return response.result?.value;
}

async function mark(page, label) {
  const expression = `(() => { performance.mark(${JSON.stringify(label)}); return true; })()`;
  await evaluate(page, expression);
}

async function readTargetState(page) {
  return evaluate(page, `(() => {
    const text = (id) => document.getElementById(id)?.textContent || "";
    const afterEquals = (value) => {
      const index = value.indexOf("=");
      return index === -1 ? "" : value.slice(index + 1);
    };
    const numberValue = (id) => {
      const parsed = Number(afterEquals(text(id)));
      return Number.isFinite(parsed) ? parsed : null;
    };
    const marks = performance.getEntriesByType("mark").map((entry) => entry.name);
    return {
      href: location.href,
      document_ready_state: document.readyState,
      ready_text: text("ready-state"),
      ready: text("ready-state") === "ready=true",
      idle_text: text("idle-state"),
      idle_ms: numberValue("idle-state"),
      stream_state_text: text("stream-state"),
      stream_state: afterEquals(text("stream-state")),
      token_count_text: text("token-count"),
      token_count: numberValue("token-count"),
      p0_capture_start_mark_count: marks.filter((name) => name === "p0:capture:start").length,
      p1_stream_start_mark_count: marks.filter((name) => /^p1:capture:\\d+:stream:start$/.test(name)).length
    };
  })()`);
}

function createVisibilityFrameProbe(enabled) {
  return {
    enabled,
    status: enabled ? "not-started" : "disabled",
    errors: [],
    page_bring_to_front_before_readiness_called: false,
    page_bring_to_front_before_readiness_ok: null,
    page_bring_to_front_before_tracing_called: false,
    page_bring_to_front_before_tracing_ok: null,
    before_capture: null,
    after_capture: null,
    readiness_gate: null,
    pre_start_gate: null,
    raf: null
  };
}

function markVisibilityFrameProbeFailed(probe, message) {
  if (!probe.enabled) {
    return;
  }
  probe.status = "failed";
  probe.errors.push(message);
}

function createMacosActivationState(args) {
  return {
    macos_activate_browser_enabled: args.macosActivateBrowser === true,
    macos_activate_browser_attempted: false,
    macos_activate_browser_method: "osascript:tell application id \"com.google.Chrome\" to activate",
    macos_activate_browser_ok: null,
    macos_activate_browser_error: null,
    foreground_settle_ms: Number(args.foregroundSettleMs || 0),
    foreground_settle_completed: false
  };
}

async function activateMacosBrowserIfRequested(args, state) {
  if (!args.macosActivateBrowser) {
    return;
  }
  state.macos_activate_browser_attempted = true;
  if (process.platform !== "darwin") {
    state.macos_activate_browser_ok = false;
    state.macos_activate_browser_error = `unsupported platform: ${process.platform}`;
  } else {
    const result = spawnSync("osascript", [
      "-e",
      'tell application id "com.google.Chrome" to activate'
    ], { encoding: "utf8" });
    state.macos_activate_browser_ok = result.status === 0;
    if (result.status !== 0) {
      state.macos_activate_browser_error = (result.stderr || result.stdout || `osascript exited ${result.status}`).trim();
    }
  }
  if (state.foreground_settle_ms > 0) {
    await sleep(state.foreground_settle_ms);
    state.foreground_settle_completed = true;
  }
}

async function bringToFrontForVisibilityProbe(page, probe, phase) {
  const calledKey = `page_bring_to_front_${phase}_called`;
  const okKey = `page_bring_to_front_${phase}_ok`;
  if (probe.enabled) {
    probe[calledKey] = true;
  }
  try {
    await page.send("Page.bringToFront");
    if (probe.enabled) {
      probe[okKey] = true;
    }
  } catch (error) {
    if (probe.enabled) {
      probe[okKey] = false;
      markVisibilityFrameProbeFailed(probe, `Page.bringToFront ${phase} failed: ${error.message}`);
    }
  }
}

async function readVisibilityFrameState(page) {
  return evaluate(page, `(() => ({
    document_visibility_state: document.visibilityState,
    document_has_focus: document.hasFocus(),
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio
  }))()`);
}

async function startVisibilityFrameProbe(page, probe) {
  if (!probe.enabled) {
    return;
  }
  try {
    const started = await evaluate(page, `(() => {
      const previousProbe = window.__p1VisibilityFrameProbe || null;
      const previousProbeActive = Boolean(previousProbe && previousProbe.active);
      const previousLoopInstanceCount = Number(window.__p1VisibilityFrameProbeLoopInstanceCount) || 0;
      if (previousProbe) {
        previousProbe.active = false;
        if (previousProbe.raf_id !== null && previousProbe.raf_id !== undefined) {
          window.cancelAnimationFrame(previousProbe.raf_id);
        }
        if (typeof previousProbe.cleanup === "function") {
          previousProbe.cleanup();
        }
      }
      const loopInstanceCount = previousLoopInstanceCount + 1;
      window.__p1VisibilityFrameProbeLoopInstanceCount = loopInstanceCount;
      const startMarks = performance.getEntriesByName("p0:capture:start").length;
      const probeId = "p1-vfp-" + loopInstanceCount + "-" + Math.round((performance.timeOrigin + performance.now()) * 1000);
      const probe = {
        probe_id: probeId,
        active: true,
        previous_probe_present: previousProbe !== null,
        previous_probe_active_at_start: previousProbeActive,
        previous_loop_instance_count: previousLoopInstanceCount,
        loop_instance_count: loopInstanceCount,
        multiple_loops_detected: previousProbeActive || loopInstanceCount > 1,
        started_at_ms: performance.now(),
        p0_capture_start_mark_count_at_start: startMarks,
        raf_started_before_p0_capture_start: startMarks === 0,
        raf_count_total: 0,
        raf_count_before_capture: 0,
        raf_count_during_capture: 0,
        raf_count_after_capture: 0,
        raf_gap_count_total: 0,
        raf_gap_total_ms: 0,
        raf_max_gap_ms: 0,
        raf_gap_count_during_capture: 0,
        raf_gap_total_ms_during_capture: 0,
        raf_max_gap_ms_during_capture: 0,
        raf_first_ms: null,
        raf_last_ms: null,
        p0_capture_start_mark_count_final: 0,
        p0_capture_end_mark_count_final: 0,
        raf_continued_until_after_p0_capture_end: false,
        last_raf_ms: null,
        last_capture_raf_ms: null,
        raf_id: null,
        visibility_change_count: 0,
        focus_event_count: 0,
        blur_event_count: 0,
        first_hidden_ms: null,
        first_visible_ms_after_hidden: null,
        first_blur_ms: null,
        first_focus_ms_after_blur: null,
        visibility_state_at_p0_start: null,
        visibility_state_at_p0_end_if_seen: null,
        focus_at_p0_start: null,
        focus_at_p0_end_if_seen: null,
        cleanup: null
      };

      const captureCounts = () => ({
        start: performance.getEntriesByName("p0:capture:start").length,
        end: performance.getEntriesByName("p0:capture:end").length
      });

      const recordBoundaryState = (counts) => {
        if (counts.start > probe.p0_capture_start_mark_count_at_start &&
            probe.visibility_state_at_p0_start === null) {
          probe.visibility_state_at_p0_start = document.visibilityState;
          probe.focus_at_p0_start = document.hasFocus();
        }
        if (counts.end > 0 && probe.visibility_state_at_p0_end_if_seen === null) {
          probe.visibility_state_at_p0_end_if_seen = document.visibilityState;
          probe.focus_at_p0_end_if_seen = document.hasFocus();
        }
      };

      const onVisibilityChange = () => {
        const counts = captureCounts();
        recordBoundaryState(counts);
        if (!(counts.start > probe.p0_capture_start_mark_count_at_start && counts.end === 0)) {
          return;
        }
        probe.visibility_change_count += 1;
        const now = performance.now();
        if (document.visibilityState === "hidden" && probe.first_hidden_ms === null) {
          probe.first_hidden_ms = now;
        }
        if (document.visibilityState === "visible" &&
            probe.first_hidden_ms !== null &&
            probe.first_visible_ms_after_hidden === null) {
          probe.first_visible_ms_after_hidden = now;
        }
      };

      const onFocus = () => {
        const counts = captureCounts();
        recordBoundaryState(counts);
        if (!(counts.start > probe.p0_capture_start_mark_count_at_start && counts.end === 0)) {
          return;
        }
        probe.focus_event_count += 1;
        const now = performance.now();
        if (probe.first_blur_ms !== null && probe.first_focus_ms_after_blur === null) {
          probe.first_focus_ms_after_blur = now;
        }
      };

      const onBlur = () => {
        const counts = captureCounts();
        recordBoundaryState(counts);
        if (!(counts.start > probe.p0_capture_start_mark_count_at_start && counts.end === 0)) {
          return;
        }
        probe.blur_event_count += 1;
        if (probe.first_blur_ms === null) {
          probe.first_blur_ms = performance.now();
        }
      };

      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("focus", onFocus);
      window.addEventListener("blur", onBlur);
      probe.cleanup = () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("blur", onBlur);
      };

      const tick = (timestamp) => {
        if (!probe.active) {
          return;
        }
        const counts = captureCounts();
        const captureStartCount = counts.start;
        const captureEndCount = counts.end;
        const inCapture = captureStartCount > 0 && captureEndCount === 0;
        const afterCapture = captureEndCount > 0;
        recordBoundaryState(counts);

        probe.raf_count_total += 1;
        if (probe.raf_first_ms === null) {
          probe.raf_first_ms = timestamp;
        }
        if (probe.last_raf_ms !== null) {
          const gap = timestamp - probe.last_raf_ms;
          probe.raf_gap_count_total += 1;
          probe.raf_gap_total_ms += gap;
          if (gap > probe.raf_max_gap_ms) {
            probe.raf_max_gap_ms = gap;
          }
        }

        if (inCapture) {
          probe.raf_count_during_capture += 1;
          if (probe.last_capture_raf_ms !== null) {
            const captureGap = timestamp - probe.last_capture_raf_ms;
            probe.raf_gap_count_during_capture += 1;
            probe.raf_gap_total_ms_during_capture += captureGap;
            if (captureGap > probe.raf_max_gap_ms_during_capture) {
              probe.raf_max_gap_ms_during_capture = captureGap;
            }
          }
          probe.last_capture_raf_ms = timestamp;
        } else if (afterCapture) {
          probe.raf_count_after_capture += 1;
          probe.raf_continued_until_after_p0_capture_end = true;
        } else {
          probe.raf_count_before_capture += 1;
        }

        probe.raf_last_ms = timestamp;
        probe.last_raf_ms = timestamp;
        probe.p0_capture_start_mark_count_final = captureStartCount;
        probe.p0_capture_end_mark_count_final = captureEndCount;
        probe.raf_id = window.requestAnimationFrame(tick);
      };

      window.__p1VisibilityFrameProbe = probe;
      probe.raf_id = window.requestAnimationFrame(tick);
      return {
        probe_id: probe.probe_id,
        started_at_ms: probe.started_at_ms,
        previous_probe_present: probe.previous_probe_present,
        previous_probe_active_at_start: probe.previous_probe_active_at_start,
        previous_loop_instance_count: probe.previous_loop_instance_count,
        loop_instance_count: probe.loop_instance_count,
        multiple_loops_detected: probe.multiple_loops_detected,
        p0_capture_start_mark_count_at_start: probe.p0_capture_start_mark_count_at_start,
        raf_started_before_p0_capture_start: probe.raf_started_before_p0_capture_start
      };
    })()`);
    probe.raf = {
      probe_id: started.probe_id,
      started_at_ms: roundedMetric(started.started_at_ms),
      previous_probe_present: started.previous_probe_present,
      previous_probe_active_at_start: started.previous_probe_active_at_start,
      previous_loop_instance_count: started.previous_loop_instance_count,
      loop_instance_count: started.loop_instance_count,
      multiple_loops_detected: started.multiple_loops_detected,
      p0_capture_start_mark_count_at_start: started.p0_capture_start_mark_count_at_start,
      raf_started_before_p0_capture_start: started.raf_started_before_p0_capture_start
    };
    if (started.multiple_loops_detected) {
      markVisibilityFrameProbeFailed(probe, `multiple rAF probe loops detected:loop_instance_count=${started.loop_instance_count};previous_active=${started.previous_probe_active_at_start}`);
    }
    if (probe.status !== "failed") {
      probe.status = "running";
    }
  } catch (error) {
    markVisibilityFrameProbeFailed(probe, `rAF probe start failed: ${error.message}`);
  }
}

async function collectVisibilityFrameProbe(page, probe) {
  if (!probe.enabled) {
    return;
  }
  try {
    const summary = await evaluate(page, `(() => {
      const probe = window.__p1VisibilityFrameProbe;
      if (!probe) {
        return null;
      }
      probe.active = false;
      if (probe.raf_id !== null) {
        window.cancelAnimationFrame(probe.raf_id);
      }
      if (typeof probe.cleanup === "function") {
        probe.cleanup();
        probe.cleanup = null;
      }
      return {
        probe_id: probe.probe_id,
        previous_probe_present: probe.previous_probe_present,
        previous_probe_active_at_start: probe.previous_probe_active_at_start,
        previous_loop_instance_count: probe.previous_loop_instance_count,
        loop_instance_count: probe.loop_instance_count,
        multiple_loops_detected: probe.multiple_loops_detected,
        started_at_ms: probe.started_at_ms,
        raf_count_total: probe.raf_count_total,
        raf_count_before_capture: probe.raf_count_before_capture,
        raf_count_during_capture: probe.raf_count_during_capture,
        raf_count_after_capture: probe.raf_count_after_capture,
        raf_gap_count_total: probe.raf_gap_count_total,
        raf_average_gap_ms: probe.raf_gap_count_total > 0
          ? probe.raf_gap_total_ms / probe.raf_gap_count_total
          : null,
        raf_max_gap_ms: probe.raf_max_gap_ms,
        raf_gap_count_during_capture: probe.raf_gap_count_during_capture,
        raf_average_gap_ms_during_capture: probe.raf_gap_count_during_capture > 0
          ? probe.raf_gap_total_ms_during_capture / probe.raf_gap_count_during_capture
          : null,
        raf_max_gap_ms_during_capture: probe.raf_max_gap_ms_during_capture,
        raf_first_ms: probe.raf_first_ms,
        raf_last_ms: probe.raf_last_ms,
        p0_capture_start_mark_count_at_start: probe.p0_capture_start_mark_count_at_start,
        p0_capture_start_mark_count_final: probe.p0_capture_start_mark_count_final,
        p0_capture_end_mark_count_final: probe.p0_capture_end_mark_count_final,
        raf_started_before_p0_capture_start: probe.raf_started_before_p0_capture_start,
        raf_continued_until_after_p0_capture_end: probe.raf_continued_until_after_p0_capture_end,
        visibility_change_count: probe.visibility_change_count,
        focus_event_count: probe.focus_event_count,
        blur_event_count: probe.blur_event_count,
        first_hidden_ms: probe.first_hidden_ms,
        first_visible_ms_after_hidden: probe.first_visible_ms_after_hidden,
        first_blur_ms: probe.first_blur_ms,
        first_focus_ms_after_blur: probe.first_focus_ms_after_blur,
        visibility_state_at_p0_start: probe.visibility_state_at_p0_start,
        visibility_state_at_p0_end_if_seen: probe.visibility_state_at_p0_end_if_seen,
        focus_at_p0_start: probe.focus_at_p0_start,
        focus_at_p0_end_if_seen: probe.focus_at_p0_end_if_seen
      };
    })()`);
    if (!summary) {
      markVisibilityFrameProbeFailed(probe, "rAF probe summary missing");
      return;
    }
    probe.raf = {
      ...summary,
      probe_id: summary.probe_id,
      previous_probe_present: summary.previous_probe_present,
      previous_probe_active_at_start: summary.previous_probe_active_at_start,
      previous_loop_instance_count: summary.previous_loop_instance_count,
      loop_instance_count: summary.loop_instance_count,
      multiple_loops_detected: summary.multiple_loops_detected,
      started_at_ms: roundedMetric(summary.started_at_ms),
      raf_average_gap_ms: roundedMetric(summary.raf_average_gap_ms),
      raf_max_gap_ms: roundedMetric(summary.raf_max_gap_ms),
      raf_average_gap_ms_during_capture: roundedMetric(summary.raf_average_gap_ms_during_capture),
      raf_max_gap_ms_during_capture: roundedMetric(summary.raf_max_gap_ms_during_capture),
      raf_first_ms: roundedMetric(summary.raf_first_ms),
      raf_last_ms: roundedMetric(summary.raf_last_ms),
      first_hidden_ms: roundedMetric(summary.first_hidden_ms),
      first_visible_ms_after_hidden: roundedMetric(summary.first_visible_ms_after_hidden),
      first_blur_ms: roundedMetric(summary.first_blur_ms),
      first_focus_ms_after_blur: roundedMetric(summary.first_focus_ms_after_blur)
    };
    if (summary.multiple_loops_detected) {
      markVisibilityFrameProbeFailed(probe, `multiple rAF probe loops detected:loop_instance_count=${summary.loop_instance_count};previous_active=${summary.previous_probe_active_at_start}`);
    }
  } catch (error) {
    markVisibilityFrameProbeFailed(probe, `rAF probe collect failed: ${error.message}`);
  }
}

function finalizeVisibilityFrameProbe(probe) {
  if (!probe.enabled) {
    probe.status = "disabled";
    return probe;
  }

  const hasBefore = probe.before_capture &&
    typeof probe.before_capture.document_visibility_state === "string" &&
    typeof probe.before_capture.document_has_focus === "boolean";
  const hasAfter = probe.after_capture &&
    typeof probe.after_capture.document_visibility_state === "string" &&
    typeof probe.after_capture.document_has_focus === "boolean";
  const hasRaf = probe.raf &&
    typeof probe.raf.raf_count_during_capture === "number" &&
    typeof probe.raf.raf_max_gap_ms_during_capture === "number";
  if (probe.raf?.multiple_loops_detected === true || Number(probe.raf?.loop_instance_count) > 1) {
    markVisibilityFrameProbeFailed(probe, `multiple rAF probe loops detected:loop_instance_count=${probe.raf?.loop_instance_count};previous_active=${probe.raf?.previous_probe_active_at_start}`);
  }

  if (!hasBefore) {
    markVisibilityFrameProbeFailed(probe, "before-capture visibility/focus fields missing");
  }
  if (!hasAfter) {
    markVisibilityFrameProbeFailed(probe, "after-capture visibility/focus fields missing");
  }
  if (!hasRaf) {
    markVisibilityFrameProbeFailed(probe, "rAF scalar fields missing");
  }
  if (probe.page_bring_to_front_before_readiness_ok !== true) {
    markVisibilityFrameProbeFailed(probe, "Page.bringToFront before readiness did not succeed");
  }
  if (probe.page_bring_to_front_before_tracing_ok !== true) {
    markVisibilityFrameProbeFailed(probe, "Page.bringToFront before tracing did not succeed");
  }

  if (probe.status !== "failed") {
    probe.status = "ok";
  }
  return probe;
}

function createVisibilityFrameParity(probe, captureMs) {
  const aggregateFailReasons = [];
  const streamFailReasons = [];
  const postCaptureReasons = [];
  const probeErrors = [];
  const pushUnique = (items, reason) => {
    if (!items.includes(reason)) {
      items.push(reason);
    }
  };
  const enabled = probe?.enabled === true;
  const raf = probe?.raf || {};
  const before = probe?.before_capture || {};
  const after = probe?.after_capture || {};
  const captureDurationMs = numericField(captureMs);
  const captureDurationMsForRaf = Number.isFinite(captureDurationMs) && captureDurationMs > 0
    ? captureDurationMs
    : null;
  const rafExpectedMinCount = captureDurationMsForRaf !== null
    ? Math.max(1, Math.floor((captureDurationMs / 1000) * VISIBILITY_RAF_MIN_FPS))
    : null;
  const rafObservedCount = numericField(raf.raf_count_during_capture);
  const rafCoverageRatio = Number.isFinite(rafExpectedMinCount) && Number.isFinite(rafObservedCount)
    ? rafObservedCount / rafExpectedMinCount
    : null;
  const rafEffectiveFps = captureDurationMsForRaf !== null && Number.isFinite(rafObservedCount)
    ? rafObservedCount / (captureDurationMsForRaf / 1000)
    : null;
  const rafLoopInstanceCount = numericField(raf.loop_instance_count);
  const p0CaptureEndMarkCountFinal = numericField(raf.p0_capture_end_mark_count_final);
  const captureEndSeenByRaf = p0CaptureEndMarkCountFinal !== null && p0CaptureEndMarkCountFinal >= 1;
  const rafObservedUntilCaptureEnd = raf.raf_continued_until_after_p0_capture_end === true;
  const visibilityBeforeOk = before.document_visibility_state === "visible";
  const focusBeforeOk = before.document_has_focus === true;
  const visibilityAfterOk = after.document_visibility_state === "visible";
  const focusAfterOk = after.document_has_focus === true;

  if (enabled && probe.raf && typeof probe.raf === "object") {
    probe.raf.raf_loop_instance_count = rafLoopInstanceCount;
    probe.raf.raf_expected_min_count = rafExpectedMinCount;
    probe.raf.raf_coverage_ratio = roundedMetric(rafCoverageRatio);
    probe.raf.raf_effective_fps = roundedMetric(rafEffectiveFps);
    probe.raf.capture_duration_ms_for_raf = captureDurationMsForRaf;
  }

  if (!enabled) {
    pushUnique(aggregateFailReasons, "visibility-frame-probe-disabled");
  }

  const failProbe = (reason, failStream = true) => {
    pushUnique(probeErrors, reason);
    pushUnique(aggregateFailReasons, reason);
    if (failStream) {
      pushUnique(streamFailReasons, reason);
    }
  };
  const missingRequiredRafScalar = (field) => {
    const reason = `missing-required-raf-scalar:${field}`;
    failProbe(reason);
  };
  if (enabled) {
    const hasBefore = typeof before.document_visibility_state === "string" &&
      typeof before.document_has_focus === "boolean";
    const hasAfter = typeof after.document_visibility_state === "string" &&
      typeof after.document_has_focus === "boolean";
    const hasRafSummary = Number.isFinite(rafObservedCount) &&
      Number.isFinite(numericField(raf.raf_max_gap_ms_during_capture));
    if (!hasBefore) {
      failProbe("before-capture visibility/focus fields missing");
    }
    if (!hasAfter) {
      failProbe("after-capture visibility/focus fields missing");
    }
    if (!hasRafSummary) {
      failProbe("rAF scalar fields missing");
    }
    if (probe?.page_bring_to_front_before_readiness_ok !== true) {
      failProbe("Page.bringToFront before readiness did not succeed");
    }
    if (probe?.page_bring_to_front_before_tracing_ok !== true) {
      failProbe("Page.bringToFront before tracing did not succeed");
    }
    const requiredRafScalars = [
      ["raf_loop_instance_count", rafLoopInstanceCount],
      ["raf_expected_min_count", rafExpectedMinCount],
      ["raf_coverage_ratio", rafCoverageRatio],
      ["raf_effective_fps", rafEffectiveFps],
      ["capture_duration_ms_for_raf", captureDurationMsForRaf]
    ];
    for (const [field, value] of requiredRafScalars) {
      if (!Number.isFinite(value)) {
        missingRequiredRafScalar(field);
      }
    }
  }
  if (Number.isFinite(rafLoopInstanceCount) && rafLoopInstanceCount !== 1) {
    const reason = `raf-loop-instance-count-invalid:${rafLoopInstanceCount}`;
    failProbe(reason);
  }

  if (enabled && probe) {
    probe.status = probeErrors.length === 0 ? "ok" : "failed";
    probe.errors = probeErrors;
  }
  if (enabled && probe?.status !== "ok") {
    pushUnique(aggregateFailReasons, `visibility-frame-probe-status=${probe?.status || "missing"}`);
  }
  if (!visibilityBeforeOk) {
    pushUnique(streamFailReasons, `before-capture-not-visible:visibility=${before.document_visibility_state}`);
  } else if (!focusBeforeOk) {
    pushUnique(postCaptureReasons, `before-capture-not-focused:focus=${before.document_has_focus}`);
  }
  if (raf.raf_started_before_p0_capture_start !== true) {
    pushUnique(streamFailReasons, "raf-did-not-start-before-p0-capture-start");
  }
  if (!rafObservedUntilCaptureEnd) {
    pushUnique(streamFailReasons, "raf-did-not-continue-until-after-p0-capture-end");
  }
  if (!captureEndSeenByRaf) {
    pushUnique(streamFailReasons, `p0-capture-end-not-seen-by-raf:count=${raf.p0_capture_end_mark_count_final}`);
  }
  if (!visibilityAfterOk || !focusAfterOk) {
    pushUnique(postCaptureReasons, `after-capture-not-visible-focused:visibility=${after.document_visibility_state};focus=${after.document_has_focus}`);
  }
  if (raf.visibility_state_at_p0_start === "hidden") {
    pushUnique(streamFailReasons, "visibility-hidden-at-p0-capture-start");
  }
  if (raf.visibility_state_at_p0_end_if_seen === "hidden") {
    pushUnique(streamFailReasons, "visibility-hidden-at-p0-capture-end");
  }
  if (numericField(raf.first_hidden_ms) !== null) {
    pushUnique(streamFailReasons, `visibility-hidden-during-capture:first_hidden_ms=${roundedMetric(numericField(raf.first_hidden_ms))}`);
  }
  if (!Number.isFinite(rafExpectedMinCount) || !Number.isFinite(rafObservedCount)) {
    pushUnique(streamFailReasons, "raf-coverage-unavailable");
  } else if (rafObservedCount < rafExpectedMinCount) {
    pushUnique(streamFailReasons, `raf-coverage-low:observed=${rafObservedCount};expected_min=${rafExpectedMinCount}`);
  }
  if (Number.isFinite(rafEffectiveFps) && rafEffectiveFps > VISIBILITY_RAF_MAX_FPS) {
    pushUnique(streamFailReasons, `raf-effective-fps-implausible:fps=${roundedMetric(rafEffectiveFps)};max=${VISIBILITY_RAF_MAX_FPS}`);
  }
  if (raf.multiple_loops_detected === true || (rafLoopInstanceCount !== null && rafLoopInstanceCount > 1)) {
    pushUnique(aggregateFailReasons, `multiple-raf-probe-loops:loop_instance_count=${raf.loop_instance_count}`);
  }
  const streamFrameParityStatus = streamFailReasons.length === 0 ? "pass" : "fail";
  const postCaptureVisibilityStatus = postCaptureReasons.length === 0 ? "pass" : "warning";
  const visibilityFrameParityFailReasons = [];
  for (const reason of [...aggregateFailReasons, ...streamFailReasons]) {
    pushUnique(visibilityFrameParityFailReasons, reason);
  }
  const visibilityFrameParityStatus = visibilityFrameParityFailReasons.length > 0
    ? "fail"
    : (postCaptureVisibilityStatus === "warning" ? "pass_with_warning" : "pass");

  return {
    visibility_frame_parity_status: visibilityFrameParityStatus,
    visibility_frame_parity_fail_reasons: visibilityFrameParityFailReasons,
    stream_frame_parity_status: streamFrameParityStatus,
    stream_frame_parity_fail_reasons: streamFailReasons,
    post_capture_visibility_status: postCaptureVisibilityStatus,
    post_capture_visibility_reasons: postCaptureReasons,
    raf_coverage_ratio: roundedMetric(rafCoverageRatio),
    raf_expected_min_count: rafExpectedMinCount,
    raf_effective_fps: roundedMetric(rafEffectiveFps),
    capture_duration_ms_for_raf: captureDurationMsForRaf,
    raf_loop_instance_count: rafLoopInstanceCount,
    raf_observed_until_capture_end: rafObservedUntilCaptureEnd,
    capture_end_seen_by_raf: captureEndSeenByRaf,
    visibility_focus_before_ok: visibilityBeforeOk && focusBeforeOk,
    visibility_focus_after_ok: visibilityAfterOk && focusAfterOk,
    visibility_change_count: numericField(raf.visibility_change_count),
    focus_event_count: numericField(raf.focus_event_count),
    blur_event_count: numericField(raf.blur_event_count),
    first_hidden_ms: roundedMetric(numericField(raf.first_hidden_ms)),
    first_visible_ms_after_hidden: roundedMetric(numericField(raf.first_visible_ms_after_hidden)),
    first_blur_ms: roundedMetric(numericField(raf.first_blur_ms)),
    first_focus_ms_after_blur: roundedMetric(numericField(raf.first_focus_ms_after_blur)),
    visibility_state_at_p0_start: typeof raf.visibility_state_at_p0_start === "string"
      ? raf.visibility_state_at_p0_start
      : null,
    visibility_state_at_p0_end_if_seen: typeof raf.visibility_state_at_p0_end_if_seen === "string"
      ? raf.visibility_state_at_p0_end_if_seen
      : null,
    focus_at_p0_start: typeof raf.focus_at_p0_start === "boolean"
      ? raf.focus_at_p0_start
      : null,
    focus_at_p0_end_if_seen: typeof raf.focus_at_p0_end_if_seen === "boolean"
      ? raf.focus_at_p0_end_if_seen
      : null
  };
}

function createAttributionValidity(visibilityFrameProbe, visibilityFrameParity) {
  const invalidReasons = [];
  const warnings = [];
  const probeStatus = visibilityFrameProbe?.status || "missing";
  const streamStatus = visibilityFrameParity?.stream_frame_parity_status || "missing";
  const streamReasons = Array.isArray(visibilityFrameParity?.stream_frame_parity_fail_reasons)
    ? visibilityFrameParity.stream_frame_parity_fail_reasons
    : [];
  const postReasons = Array.isArray(visibilityFrameParity?.post_capture_visibility_reasons)
    ? visibilityFrameParity.post_capture_visibility_reasons
    : [];

  if (probeStatus !== "ok") {
    invalidReasons.push(`visibility-frame-probe-status=${probeStatus}`);
  }
  if (streamStatus !== "pass") {
    invalidReasons.push(`stream-frame-parity-status=${streamStatus}`);
    for (const reason of streamReasons) {
      invalidReasons.push(`stream-frame-parity:${reason}`);
    }
  }
  if (visibilityFrameParity?.post_capture_visibility_status === "warning") {
    for (const reason of postReasons) {
      warnings.push(`post-capture-visibility:${reason}`);
    }
  }

  return {
    stream_frame_parity_usable: invalidReasons.length === 0,
    attribution_validity_status: invalidReasons.length === 0 ? "valid" : "invalid",
    attribution_invalid_reasons: invalidReasons,
    attribution_warnings: warnings
  };
}

function readinessErrors(state) {
  const errors = [];
  if (state.document_ready_state !== "complete") {
    errors.push(`document.readyState=${state.document_ready_state}`);
  }
  if (state.ready !== true) {
    errors.push(`ready_text=${state.ready_text}`);
  }
  if (!Number.isFinite(state.idle_ms) || state.idle_ms < MIN_READY_IDLE_MS) {
    errors.push(`idle_ms=${state.idle_ms}`);
  }
  if (state.stream_state !== "idle") {
    errors.push(`stream_state=${state.stream_state}`);
  }
  if (state.token_count !== 0) {
    errors.push(`token_count=${state.token_count}`);
  }
  if (state.p0_capture_start_mark_count !== 0) {
    errors.push(`p0_capture_start_mark_count=${state.p0_capture_start_mark_count}`);
  }
  if (state.p1_stream_start_mark_count !== 0) {
    errors.push(`p1_stream_start_mark_count=${state.p1_stream_start_mark_count}`);
  }
  return errors;
}

async function waitForReadiness(page) {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  let latestState = null;
  while (Date.now() < deadline) {
    latestState = await readTargetState(page);
    if (readinessErrors(latestState).length === 0) {
      return latestState;
    }
    await sleep(READINESS_POLL_MS);
  }

  const errors = readinessErrors(latestState || {});
  throw new Error(`readiness gate failed closed: ${errors.join("; ")}`);
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

function overlaps(event, startTs, endTs) {
  const start = eventTimestamp(event);
  const end = eventEndTimestamp(event);
  return start !== null && end !== null && start < endTs && end > startTs;
}

function intersectsWindow(event, startTs, endTs) {
  const start = eventTimestamp(event);
  if (start === null) {
    return false;
  }
  if (typeof event.dur === "number") {
    return overlaps(event, startTs, endTs);
  }
  return start >= startTs && start <= endTs;
}

function classifyEventName(name) {
  if (name === "MajorGC" || name === "V8.GC_MARK_COMPACTOR") {
    return "major_gc_or_mark_compactor";
  }
  if (/Compile|Parse|EvaluateScript/.test(name)) {
    return "compile_parse_evaluate";
  }
  if (name === "TimerFire" || name === "FunctionCall") {
    return "timer_fire_function_call";
  }
  if (/Layout|Paint/.test(name)) {
    return "layout_paint";
  }
  return "other";
}

const FRAME_EVENT_KEYS = [
  "paint",
  "pre_paint",
  "scheduler_begin_frame",
  "scheduler_begin_impl_frame",
  "proxy_main_begin_main_frame",
  "commit",
  "layerize",
  "raster_task"
];

function frameEventKey(name) {
  if (name === "Paint") {
    return "paint";
  }
  if (name === "PrePaint") {
    return "pre_paint";
  }
  if (name === "Scheduler::BeginFrame") {
    return "scheduler_begin_frame";
  }
  if (name === "Scheduler::BeginImplFrame") {
    return "scheduler_begin_impl_frame";
  }
  if (name === "ProxyMain::BeginMainFrame") {
    return "proxy_main_begin_main_frame";
  }
  if (name === "Commit") {
    return "commit";
  }
  if (name === "Layerize") {
    return "layerize";
  }
  if (name === "RasterTask") {
    return "raster_task";
  }
  return null;
}

function addMetric(map, key, duration) {
  const entry = map.get(key) || { count: 0, total_ms: 0, max_ms: 0 };
  entry.count += 1;
  entry.total_ms += duration;
  entry.max_ms = Math.max(entry.max_ms, duration);
  map.set(key, entry);
}

function emptyFrameEventMetrics() {
  const metrics = {};
  for (const key of FRAME_EVENT_KEYS) {
    metrics[key] = { count: 0, total_ms: 0, max_ms: 0 };
  }
  return metrics;
}

function addFrameEventMetric(metrics, key, duration) {
  const entry = metrics[key];
  entry.count += 1;
  entry.total_ms += duration;
  entry.max_ms = Math.max(entry.max_ms, duration);
}

function serializeFrameEventMetrics(metrics) {
  const serialized = {};
  for (const key of FRAME_EVENT_KEYS) {
    const entry = metrics[key];
    serialized[key] = {
      count: entry.count,
      total_ms: roundedMetric(entry.total_ms),
      max_ms: roundedMetric(entry.max_ms)
    };
  }
  return serialized;
}

function flattenFrameEventMetrics(metrics) {
  const flattened = {};
  for (const key of FRAME_EVENT_KEYS) {
    const entry = metrics[key];
    flattened[`${key}_count`] = entry.count;
    flattened[`${key}_total_ms`] = roundedMetric(entry.total_ms);
    flattened[`${key}_max_ms`] = roundedMetric(entry.max_ms);
  }
  return flattened;
}

function roundedMetric(value) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : null;
}

function numericField(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeP1FieldName(name) {
  return String(name).replace(/-/g, "_");
}

function parseP1MarkValue(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return value;
}

function parseP1AuditMetricMark(name) {
  const match = name.match(/^p1:capture:(\d+):(audit|metric):([^=]+)=(.*)$/);
  if (!match) {
    return null;
  }
  return {
    capture_index: Number(match[1]),
    kind: match[2],
    raw_key: match[3],
    key: normalizeP1FieldName(match[3]),
    value: parseP1MarkValue(match[4])
  };
}

function topMetrics(map, limit) {
  const top = [];
  for (const [name, value] of map.entries()) {
    const row = {
      name,
      count: value.count,
      total_ms: roundedMetric(value.total_ms),
      max_ms: roundedMetric(value.max_ms)
    };
    let insertAt = top.length;
    for (let index = 0; index < top.length; index += 1) {
      if (row.total_ms > top[index].total_ms) {
        insertAt = index;
        break;
      }
    }
    top.splice(insertAt, 0, row);
    if (top.length > limit) {
      top.pop();
    }
  }
  return top;
}

function analyzeWindowMetrics(traceEvents, mainThreads, startTs, endTs) {
  const byName = new Map();
  const byClass = new Map();
  const frameEventMetrics = emptyFrameEventMetrics();
  const longTasks = [];
  const gcEvents = [];
  let maxRunTaskMs = 0;
  let longTaskCount50Ms = 0;
  let runTaskTotalMs = 0;
  let functionCallTotalMs = 0;
  let runMicrotasksTotalMs = 0;
  let layoutPaintStyleTotalMs = 0;

  for (const event of traceEvents) {
    if (typeof event.name === "string" && intersectsWindow(event, startTs, endTs)) {
      const key = frameEventKey(event.name);
      if (key !== null) {
        addFrameEventMetric(frameEventMetrics, key, eventDurationMs(event));
      }
    }
    if (
      event.ph !== "X" ||
      typeof event.name !== "string" ||
      !overlaps(event, startTs, endTs) ||
      (mainThreads.size !== 0 && !mainThreads.has(threadKey(event)))
    ) {
      continue;
    }
    const duration = eventDurationMs(event);
    addMetric(byName, event.name, duration);
    addMetric(byClass, classifyEventName(event.name), duration);
    if (event.name === "RunTask") {
      runTaskTotalMs += duration;
      if (duration > maxRunTaskMs) {
        maxRunTaskMs = duration;
      }
      if (duration >= 50) {
        longTaskCount50Ms += 1;
        longTasks.push({
          start: eventTimestamp(event),
          end: eventEndTimestamp(event),
          duration_ms: duration
        });
      }
    } else if (event.name === "MajorGC" || event.name === "V8.GC_MARK_COMPACTOR") {
      gcEvents.push({
        start: eventTimestamp(event),
        end: eventEndTimestamp(event),
        duration_ms: duration
      });
    }
    if (event.name === "FunctionCall") {
      functionCallTotalMs += duration;
    }
    if (event.name === "RunMicrotasks") {
      runMicrotasksTotalMs += duration;
    }
    if (/Layout|Paint|Style/.test(event.name)) {
      layoutPaintStyleTotalMs += duration;
    }
  }

  const classificationTotals = {};
  for (const [name, value] of byClass.entries()) {
    classificationTotals[name] = {
      count: value.count,
      total_ms: roundedMetric(value.total_ms),
      max_ms: roundedMetric(value.max_ms)
    };
  }

  let gcDominantLongTasks = 0;
  for (const task of longTasks) {
    let gcOverlapMs = 0;
    for (const event of gcEvents) {
      if (event.start === null || event.end === null || task.start === null || task.end === null) {
        continue;
      }
      const overlapMs = Math.max(0, Math.min(task.end, event.end) - Math.max(task.start, event.start)) / 1000;
      gcOverlapMs += overlapMs;
    }
    if (gcOverlapMs >= task.duration_ms * 0.5 || gcOverlapMs >= 50) {
      gcDominantLongTasks += 1;
    }
  }

  return {
    window_ms: roundedMetric((endTs - startTs) / 1000),
    max_run_task_ms: roundedMetric(maxRunTaskMs),
    run_task_total_ms: roundedMetric(runTaskTotalMs),
    function_call_total_ms: roundedMetric(functionCallTotalMs),
    run_microtasks_total_ms: roundedMetric(runMicrotasksTotalMs),
    layout_paint_style_total_ms: roundedMetric(layoutPaintStyleTotalMs),
    long_task_count_50ms: longTaskCount50Ms,
    gc_dominant_long_task_count: gcDominantLongTasks,
    major_gc_or_mark_compactor_dominates: gcDominantLongTasks > 0,
    top_main_thread_events: topMetrics(byName, 15),
    classification_totals: classificationTotals,
    frame_event_parity: serializeFrameEventMetrics(frameEventMetrics),
    flat_frame_event_metrics: flattenFrameEventMetrics(frameEventMetrics)
  };
}

const SEND_REQUIRED_MARKS = [
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
];

const F0_REQUIRED_MARKS = [
  "f0:start",
  "f0:trigger:start",
  "f0:synthetic-pointerup",
  "f0:synthetic-click",
  "f0:trigger:end",
  "f0:flush:start",
  "f0:microtask:start",
  "f0:react-commit:start",
  "f0:react-commit:end",
  "f0:flush:end",
  "f0:end"
];

const F1_REQUIRED_MARKS = [
  "f1:start",
  "f1:trigger:start",
  "f1:trigger:end",
  "f1:dispatch-to-worker:start",
  "f1:dispatch-to-worker:end",
  "f1:worker-result:received",
  "f1:projection-commit:start",
  "f1:projection-commit:end",
  "f1:end"
];

const F2_REQUIRED_MARKS = [
  "f2:start",
  "f2:trigger:start",
  "f2:trigger:end",
  "f2:heavy-dispatch:start",
  "f2:heavy-dispatch:end",
  "f2:urgent-request:start",
  "f2:urgent-request:end",
  "f2:urgent-result:received",
  "f2:urgent-projection-commit:start",
  "f2:urgent-projection-commit:end",
  "f2:heavy-result:received",
  "f2:heavy-projection-commit:start",
  "f2:heavy-projection-commit:end",
  "f2:end"
];

function createEmptyF0Metrics() {
  return {
    f0_marks_complete: false,
    f0_window_ms: null,
    f0_trigger_window_ms: null,
    f0_flush_window_ms: null,
    f0_microtask_window_ms: null,
    f0_module_flush_count: 0,
    f0_subscriber_notify_count: 0,
    f0_react_commit_count: 0,
    f0_run_task_max_ms: null,
    f0_long_task_count_50ms: null,
    f0_major_gc_or_mark_compactor_dominates: false
  };
}

function createEmptyF1Metrics() {
  return {
    f1_marks_complete: false,
    f1_window_ms: null,
    f1_trigger_window_ms: null,
    f1_dispatch_to_worker_window_ms: null,
    f1_worker_roundtrip_mark_window_ms: null,
    f1_projection_commit_window_ms: null,
    f1_visible_update_window_ms: null,
    f1_main_run_task_max_ms: null,
    f1_main_long_task_count_50ms: null,
    f1_main_run_task_total_ms: null,
    f1_main_function_call_total_ms: null,
    f1_main_run_microtasks_total_ms: null,
    f1_main_layout_paint_style_total_ms: null,
    f1_main_major_gc_or_mark_compactor_dominates: false
  };
}

function createEmptyF2Metrics() {
  return {
    f2_marks_complete: false,
    f2_window_ms: null,
    f2_trigger_window_ms: null,
    f2_heavy_dispatch_window_ms: null,
    f2_urgent_request_window_ms: null,
    f2_urgent_roundtrip_mark_window_ms: null,
    f2_urgent_projection_commit_window_ms: null,
    f2_heavy_roundtrip_mark_window_ms: null,
    f2_heavy_projection_commit_window_ms: null,
    f2_main_max_task_ms: null,
    f2_main_long_task_count_50ms: null,
    f2_main_run_task_total_ms: null,
    f2_main_function_call_total_ms: null,
    f2_main_run_microtasks_total_ms: null,
    f2_main_layout_paint_style_total_ms: null,
    f2_main_major_gc_or_mark_compactor_dominates: false
  };
}

const F2_SAME_CLOCK_URGENT_METRIC_KEYS = [
  "heavy_sent_at_main",
  "urgent_sent_at_main",
  "urgent_ack_received_at_main",
  "urgent_main_ack_latency_ms",
  "urgent_projection_visible_at_main",
  "urgent_end_to_end_visible_ms"
];

function f2SameClockUrgentMetrics(p1Metrics) {
  return Object.fromEntries(
    F2_SAME_CLOCK_URGENT_METRIC_KEYS.map((key) => [
      key,
      Object.hasOwn(p1Metrics, key) ? p1Metrics[key] : null
    ])
  );
}

function windowDurationMs(start, end) {
  if (!start || !end) {
    return null;
  }
  const startTs = eventTimestamp(start);
  const endTs = eventTimestamp(end);
  if (startTs === null || endTs === null || endTs < startTs) {
    return null;
  }
  return roundedMetric((endTs - startTs) / 1000);
}

function analyzeForensics(traceEvents, tracePath) {
  const mainThreads = new Set();
  let streamStart = null;
  let streamEnd = null;
  let sendStart = null;
  let sendEnd = null;
  let f0Start = null;
  let f0End = null;
  let f0TriggerStart = null;
  let f0TriggerEnd = null;
  let f0FlushStart = null;
  let f0FlushEnd = null;
  let f0MicrotaskStart = null;
  let f1Start = null;
  let f1End = null;
  let f1TriggerStart = null;
  let f1TriggerEnd = null;
  let f1DispatchToWorkerStart = null;
  let f1DispatchToWorkerEnd = null;
  let f1WorkerResultReceived = null;
  let f1ProjectionCommitStart = null;
  let f1ProjectionCommitEnd = null;
  let f2Start = null;
  let f2End = null;
  let f2TriggerStart = null;
  let f2TriggerEnd = null;
  let f2HeavyDispatchStart = null;
  let f2HeavyDispatchEnd = null;
  let f2UrgentRequestStart = null;
  let f2UrgentRequestEnd = null;
  let f2UrgentResultReceived = null;
  let f2UrgentProjectionCommitStart = null;
  let f2UrgentProjectionCommitEnd = null;
  let f2HeavyResultReceived = null;
  let f2HeavyProjectionCommitStart = null;
  let f2HeavyProjectionCommitEnd = null;
  let token800Present = false;
  let finalTokenCount = null;
  const sendMarks = new Set();
  const f0Marks = new Set();
  const f1Marks = new Set();
  const f2Marks = new Set();
  let f0ModuleFlushCount = 0;
  let f0SubscriberNotifyCount = 0;
  let f0ReactCommitCount = 0;
  const p1Audit = {};
  const p1Metrics = {};
  const p1AuditRaw = {};
  const p1MetricsRaw = {};

  for (const event of traceEvents) {
    if (event.name === "thread_name" && event.args?.name === "CrRendererMain") {
      mainThreads.add(threadKey(event));
    }
    if (typeof event.name !== "string" || eventTimestamp(event) === null) {
      continue;
    }
    if (!streamStart && /^p1:capture:\d+:stream:start$/.test(event.name)) {
      streamStart = event;
    } else if (/^p1:capture:\d+:stream:end$/.test(event.name)) {
      streamEnd = event;
    } else {
      const sendMatch = event.name.match(/^p1:capture:\d+:(send:[^=]+)$/);
      if (sendMatch) {
        sendMarks.add(sendMatch[1]);
        if (sendMatch[1] === "send:start" && !sendStart) {
          sendStart = event;
        } else if (sendMatch[1] === "send:end") {
          sendEnd = event;
        }
      }
      const f0Match = event.name.match(/^p1:capture:\d+:(f0:[^=]+)$/);
      if (f0Match) {
        const markName = f0Match[1];
        f0Marks.add(markName);
        if (markName === "f0:start" && !f0Start) {
          f0Start = event;
        } else if (markName === "f0:end") {
          f0End = event;
        } else if (markName === "f0:trigger:start" && !f0TriggerStart) {
          f0TriggerStart = event;
        } else if (markName === "f0:trigger:end") {
          f0TriggerEnd = event;
        } else if (markName === "f0:flush:start" && !f0FlushStart) {
          f0FlushStart = event;
        } else if (markName === "f0:flush:end") {
          f0FlushEnd = event;
        } else if (markName === "f0:microtask:start" && !f0MicrotaskStart) {
          f0MicrotaskStart = event;
        }

        if (/^f0:module-flush:end(?:$|:)/.test(markName)) {
          f0ModuleFlushCount += 1;
        } else if (/^f0:subscriber-notify:end(?:$|:)/.test(markName)) {
          f0SubscriberNotifyCount += 1;
        } else if (markName === "f0:react-commit:end") {
          f0ReactCommitCount += 1;
        }
      }
      const f1Match = event.name.match(/^p1:capture:\d+:(f1:[^=]+)$/);
      if (f1Match) {
        const markName = f1Match[1];
        f1Marks.add(markName);
        if (markName === "f1:start" && !f1Start) {
          f1Start = event;
        } else if (markName === "f1:end") {
          f1End = event;
        } else if (markName === "f1:trigger:start" && !f1TriggerStart) {
          f1TriggerStart = event;
        } else if (markName === "f1:trigger:end") {
          f1TriggerEnd = event;
        } else if (markName === "f1:dispatch-to-worker:start" && !f1DispatchToWorkerStart) {
          f1DispatchToWorkerStart = event;
        } else if (markName === "f1:dispatch-to-worker:end") {
          f1DispatchToWorkerEnd = event;
        } else if (markName === "f1:worker-result:received") {
          f1WorkerResultReceived = event;
        } else if (markName === "f1:projection-commit:start" && !f1ProjectionCommitStart) {
          f1ProjectionCommitStart = event;
        } else if (markName === "f1:projection-commit:end") {
          f1ProjectionCommitEnd = event;
        }
      }
      const f2Match = event.name.match(/^p1:capture:\d+:(f2:[^=]+)$/);
      if (f2Match) {
        const markName = f2Match[1];
        f2Marks.add(markName);
        if (markName === "f2:start" && !f2Start) {
          f2Start = event;
        } else if (markName === "f2:end") {
          f2End = event;
        } else if (markName === "f2:trigger:start" && !f2TriggerStart) {
          f2TriggerStart = event;
        } else if (markName === "f2:trigger:end") {
          f2TriggerEnd = event;
        } else if (markName === "f2:heavy-dispatch:start" && !f2HeavyDispatchStart) {
          f2HeavyDispatchStart = event;
        } else if (markName === "f2:heavy-dispatch:end") {
          f2HeavyDispatchEnd = event;
        } else if (markName === "f2:urgent-request:start" && !f2UrgentRequestStart) {
          f2UrgentRequestStart = event;
        } else if (markName === "f2:urgent-request:end") {
          f2UrgentRequestEnd = event;
        } else if (markName === "f2:urgent-result:received") {
          f2UrgentResultReceived = event;
        } else if (markName === "f2:urgent-projection-commit:start" && !f2UrgentProjectionCommitStart) {
          f2UrgentProjectionCommitStart = event;
        } else if (markName === "f2:urgent-projection-commit:end") {
          f2UrgentProjectionCommitEnd = event;
        } else if (markName === "f2:heavy-result:received") {
          f2HeavyResultReceived = event;
        } else if (markName === "f2:heavy-projection-commit:start" && !f2HeavyProjectionCommitStart) {
          f2HeavyProjectionCommitStart = event;
        } else if (markName === "f2:heavy-projection-commit:end") {
          f2HeavyProjectionCommitEnd = event;
        }
      }
    }
    if (/^p1:capture:\d+:stream:token-800$/.test(event.name)) {
      token800Present = true;
    } else {
      const finalTokenMatch = event.name.match(/^p1:capture:\d+:metric:final-token-count=(\d+)$/);
      if (finalTokenMatch) {
        finalTokenCount = Number(finalTokenMatch[1]);
      }
    }

    const p1Mark = parseP1AuditMetricMark(event.name);
    if (p1Mark) {
      if (p1Mark.kind === "audit") {
        p1Audit[p1Mark.key] = p1Mark.value;
        p1AuditRaw[p1Mark.raw_key] = p1Mark.value;
      } else {
        p1Metrics[p1Mark.key] = p1Mark.value;
        p1MetricsRaw[p1Mark.raw_key] = p1Mark.value;
        if (p1Mark.key === "final_token_count" && finalTokenCount === null) {
          finalTokenCount = Number(p1Mark.value);
        }
      }
    }
  }

  const f0MarksComplete = F0_REQUIRED_MARKS.every((markName) => f0Marks.has(markName));
  let f0Metrics = createEmptyF0Metrics();
  if (f0Start && f0End) {
    const f0Window = analyzeWindowMetrics(traceEvents, mainThreads, eventTimestamp(f0Start), eventTimestamp(f0End));
    f0Metrics = {
      f0_start_mark: f0Start.name,
      f0_end_mark: f0End.name,
      f0_marks_complete: f0MarksComplete,
      f0_window_ms: f0Window.window_ms,
      f0_trigger_window_ms: windowDurationMs(f0TriggerStart, f0TriggerEnd),
      f0_flush_window_ms: windowDurationMs(f0FlushStart, f0FlushEnd),
      f0_microtask_window_ms: windowDurationMs(f0MicrotaskStart, f0FlushEnd),
      f0_module_flush_count: f0ModuleFlushCount,
      f0_subscriber_notify_count: f0SubscriberNotifyCount,
      f0_react_commit_count: f0ReactCommitCount,
      f0_run_task_max_ms: f0Window.max_run_task_ms,
      f0_long_task_count_50ms: f0Window.long_task_count_50ms,
      f0_major_gc_or_mark_compactor_dominates: f0Window.major_gc_or_mark_compactor_dominates,
      f0_gc_dominant_long_task_count: f0Window.gc_dominant_long_task_count,
      f0_top_main_thread_events: f0Window.top_main_thread_events,
      f0_classification_totals: f0Window.classification_totals
    };
  } else {
    f0Metrics = {
      ...f0Metrics,
      f0_marks_complete: f0MarksComplete,
      f0_module_flush_count: f0ModuleFlushCount,
      f0_subscriber_notify_count: f0SubscriberNotifyCount,
      f0_react_commit_count: f0ReactCommitCount
    };
  }

  const sendMarksComplete = SEND_REQUIRED_MARKS.every((markName) => sendMarks.has(markName));
  let sendMetrics = {
    send_marks_complete: sendMarksComplete,
    send_window_ms: null,
    send_run_task_max_ms: null,
    send_long_task_count_50ms: null,
    send_major_gc_or_mark_compactor_dominates: false
  };
  if (sendStart && sendEnd) {
    const sendWindow = analyzeWindowMetrics(traceEvents, mainThreads, eventTimestamp(sendStart), eventTimestamp(sendEnd));
    sendMetrics = {
      send_start_mark: sendStart.name,
      send_end_mark: sendEnd.name,
      send_marks_complete: sendMarksComplete,
      send_window_ms: sendWindow.window_ms,
      send_run_task_max_ms: sendWindow.max_run_task_ms,
      send_long_task_count_50ms: sendWindow.long_task_count_50ms,
      send_major_gc_or_mark_compactor_dominates: sendWindow.major_gc_or_mark_compactor_dominates,
      send_gc_dominant_long_task_count: sendWindow.gc_dominant_long_task_count,
      send_top_main_thread_events: sendWindow.top_main_thread_events,
      send_classification_totals: sendWindow.classification_totals
    };
  }

  const f1MarksComplete = F1_REQUIRED_MARKS.every((markName) => f1Marks.has(markName));
  let f1Metrics = createEmptyF1Metrics();
  if (f1Start && f1End) {
    const f1Window = analyzeWindowMetrics(traceEvents, mainThreads, eventTimestamp(f1Start), eventTimestamp(f1End));
    f1Metrics = {
      f1_start_mark: f1Start.name,
      f1_end_mark: f1End.name,
      f1_marks_complete: f1MarksComplete,
      f1_window_ms: f1Window.window_ms,
      f1_trigger_window_ms: windowDurationMs(f1TriggerStart, f1TriggerEnd),
      f1_dispatch_to_worker_window_ms: windowDurationMs(f1DispatchToWorkerStart, f1DispatchToWorkerEnd),
      f1_worker_roundtrip_mark_window_ms: windowDurationMs(f1DispatchToWorkerStart, f1WorkerResultReceived),
      f1_projection_commit_window_ms: windowDurationMs(f1ProjectionCommitStart, f1ProjectionCommitEnd),
      f1_visible_update_window_ms: windowDurationMs(f1WorkerResultReceived, f1End),
      f1_main_run_task_max_ms: f1Window.max_run_task_ms,
      f1_main_long_task_count_50ms: f1Window.long_task_count_50ms,
      f1_main_run_task_total_ms: f1Window.run_task_total_ms,
      f1_main_function_call_total_ms: f1Window.function_call_total_ms,
      f1_main_run_microtasks_total_ms: f1Window.run_microtasks_total_ms,
      f1_main_layout_paint_style_total_ms: f1Window.layout_paint_style_total_ms,
      f1_main_major_gc_or_mark_compactor_dominates: f1Window.major_gc_or_mark_compactor_dominates,
      f1_main_gc_dominant_long_task_count: f1Window.gc_dominant_long_task_count,
      f1_top_main_thread_events: f1Window.top_main_thread_events,
      f1_classification_totals: f1Window.classification_totals
    };
  } else {
    f1Metrics = {
      ...f1Metrics,
      f1_marks_complete: f1MarksComplete
    };
  }

  const f2MarksComplete = F2_REQUIRED_MARKS.every((markName) => f2Marks.has(markName));
  let f2Metrics = createEmptyF2Metrics();
  const f2SameClockMetrics = f2SameClockUrgentMetrics(p1Metrics);
  if (f2Start && f2End) {
    const f2Window = analyzeWindowMetrics(traceEvents, mainThreads, eventTimestamp(f2Start), eventTimestamp(f2End));
    f2Metrics = {
      f2_start_mark: f2Start.name,
      f2_end_mark: f2End.name,
      f2_marks_complete: f2MarksComplete,
      f2_window_ms: f2Window.window_ms,
      f2_trigger_window_ms: windowDurationMs(f2TriggerStart, f2TriggerEnd),
      f2_heavy_dispatch_window_ms: windowDurationMs(f2HeavyDispatchStart, f2HeavyDispatchEnd),
      f2_urgent_request_window_ms: windowDurationMs(f2UrgentRequestStart, f2UrgentRequestEnd),
      f2_urgent_roundtrip_mark_window_ms: windowDurationMs(f2UrgentRequestStart, f2UrgentResultReceived),
      f2_urgent_projection_commit_window_ms: windowDurationMs(f2UrgentProjectionCommitStart, f2UrgentProjectionCommitEnd),
      f2_heavy_roundtrip_mark_window_ms: windowDurationMs(f2HeavyDispatchStart, f2HeavyResultReceived),
      f2_heavy_projection_commit_window_ms: windowDurationMs(f2HeavyProjectionCommitStart, f2HeavyProjectionCommitEnd),
      f2_main_max_task_ms: f2Window.max_run_task_ms,
      f2_main_long_task_count_50ms: f2Window.long_task_count_50ms,
      f2_main_run_task_total_ms: f2Window.run_task_total_ms,
      f2_main_function_call_total_ms: f2Window.function_call_total_ms,
      f2_main_run_microtasks_total_ms: f2Window.run_microtasks_total_ms,
      f2_main_layout_paint_style_total_ms: f2Window.layout_paint_style_total_ms,
      f2_main_major_gc_or_mark_compactor_dominates: f2Window.major_gc_or_mark_compactor_dominates,
      f2_main_gc_dominant_long_task_count: f2Window.gc_dominant_long_task_count,
      f2_top_main_thread_events: f2Window.top_main_thread_events,
      f2_classification_totals: f2Window.classification_totals,
      ...f2SameClockMetrics
    };
  } else {
    f2Metrics = {
      ...f2Metrics,
      f2_marks_complete: f2MarksComplete,
      ...f2SameClockMetrics
    };
  }

  if (!streamStart || !streamEnd) {
    const hasSendWindow = Boolean(sendStart && sendEnd);
    const hasF0Window = Boolean(f0Start && f0End);
    const hasF1Window = Boolean(f1Start && f1End);
    const hasF2Window = Boolean(f2Start && f2End);
    return {
      trace: tracePath,
      error: hasSendWindow || hasF0Window || hasF1Window || hasF2Window ? null : "missing stream start/end marks",
      stream_window_ms: null,
      max_run_task_ms: null,
      long_task_count_50ms: null,
      top_main_thread_events: [],
      classification_totals: {},
      p1_audit: p1Audit,
      p1_metrics: p1Metrics,
      p1_audit_raw: p1AuditRaw,
      p1_metrics_raw: p1MetricsRaw,
      ...sendMetrics,
      ...f0Metrics,
      ...p1Audit,
      ...p1Metrics,
      ...f1Metrics,
      ...f2Metrics
    };
  }

  const streamWindow = analyzeWindowMetrics(traceEvents, mainThreads, eventTimestamp(streamStart), eventTimestamp(streamEnd));

  return {
    trace: tracePath,
    stream_start_mark: streamStart.name,
    stream_end_mark: streamEnd.name,
    token_800_present: token800Present,
    final_token_count: finalTokenCount,
    stream_window_ms: streamWindow.window_ms,
    max_run_task_ms: streamWindow.max_run_task_ms,
    long_task_count_50ms: streamWindow.long_task_count_50ms,
    gc_dominant_long_task_count: streamWindow.gc_dominant_long_task_count,
    major_gc_or_mark_compactor_dominates: streamWindow.major_gc_or_mark_compactor_dominates,
    top_main_thread_events: streamWindow.top_main_thread_events,
    classification_totals: streamWindow.classification_totals,
    p1_audit: p1Audit,
    p1_metrics: p1Metrics,
    p1_audit_raw: p1AuditRaw,
    p1_metrics_raw: p1MetricsRaw,
    frame_event_parity: streamWindow.frame_event_parity,
    ...streamWindow.flat_frame_event_metrics,
    ...sendMetrics,
    ...f0Metrics,
    ...p1Audit,
    ...p1Metrics,
    ...f1Metrics,
    ...f2Metrics,
    final_token_count: finalTokenCount
  };
}

function browserVersion(browser) {
  const result = spawnSync(browser, ["--version"], { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim().replace(/\r/g, "");
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function parseableTrace(filePath) {
  const payload = readJson(filePath);
  return Array.isArray(payload.traceEvents) && payload.traceEvents.length > 0;
}

function captureMsFromMetadata(meta) {
  const direct = numericField(meta?.capture_ms);
  if (direct !== null) {
    return direct;
  }
  if (Array.isArray(meta?.phase_schedule)) {
    let total = 0;
    let sawDuration = false;
    for (const phase of meta.phase_schedule) {
      const duration = numericField(phase?.duration_ms);
      if (duration !== null) {
        total += duration;
        sawDuration = true;
      }
    }
    return sawDuration ? total : null;
  }
  return null;
}

async function analyzeExistingTrace(args) {
  const tracePath = args.analyzeExistingTrace;
  const payload = readJson(tracePath);
  const traceEvents = Array.isArray(payload.traceEvents) ? payload.traceEvents : [];
  const traceStats = fs.statSync(tracePath);
  const runLabel = path.basename(tracePath).replace(/\.trace\.json$/, "");
  const runsDir = path.basename(path.dirname(tracePath)) === "runs" ? path.dirname(tracePath) : null;
  const scenarioDir = runsDir ? path.dirname(runsDir) : null;
  const scenarioId = scenarioDir ? path.basename(scenarioDir) : null;
  const sessionId = scenarioDir ? path.basename(path.dirname(scenarioDir)) : null;
  const sourceMetaPath = runsDir ? path.join(runsDir, `${runLabel}.meta.json`) : null;
  const sourceMeta = readJsonIfExists(sourceMetaPath);
  const visibilityFrameProbe = sourceMeta?.visibility_frame_probe || createVisibilityFrameProbe(false);
  const replayCaptureMs = captureMsFromMetadata(sourceMeta);
  const visibilityFrameParity = createVisibilityFrameParity(visibilityFrameProbe, replayCaptureMs);
  const attributionValidity = createAttributionValidity(visibilityFrameProbe, visibilityFrameParity);
  const replayForegroundMetadata = {
    macos_activate_browser_enabled: sourceMeta?.macos_activate_browser_enabled === true,
    macos_activate_browser_attempted: sourceMeta?.macos_activate_browser_attempted === true,
    macos_activate_browser_method: sourceMeta?.macos_activate_browser_method || null,
    macos_activate_browser_ok: typeof sourceMeta?.macos_activate_browser_ok === "boolean"
      ? sourceMeta.macos_activate_browser_ok
      : null,
    macos_activate_browser_error: sourceMeta?.macos_activate_browser_error || null,
    foreground_settle_ms: numericField(sourceMeta?.foreground_settle_ms),
    foreground_settle_completed: sourceMeta?.foreground_settle_completed === true
  };
  let forensicsError = null;
  let forensics = null;

  try {
    forensics = analyzeForensics(traceEvents, tracePath);
    Object.assign(forensics, visibilityFrameParity);
    Object.assign(forensics, attributionValidity);
    Object.assign(forensics, replayForegroundMetadata);
    if (sourceMeta?.visibility_frame_probe) {
      forensics.visibility_frame_probe_status = visibilityFrameProbe.status;
      forensics.visibility_frame_probe = visibilityFrameProbe;
    }
    await fsp.mkdir(path.dirname(args.forensicsOut), { recursive: true });
    await writeJson(args.forensicsOut, forensics);
  } catch (error) {
    forensicsError = error.message;
    await fsp.mkdir(path.dirname(args.forensicsOut), { recursive: true });
    await writeJson(args.forensicsOut, {
      trace: tracePath,
      error: forensicsError,
      ...visibilityFrameParity,
      ...attributionValidity,
      ...replayForegroundMetadata,
      visibility_frame_probe_status: visibilityFrameProbe.status,
      visibility_frame_probe: sourceMeta?.visibility_frame_probe ? visibilityFrameProbe : undefined
    });
  }

  await fsp.mkdir(path.dirname(args.metaOut), { recursive: true });
  await writeJson(args.metaOut, {
    session_id: sessionId,
    scenario_id: scenarioId,
    run_kind: "measured",
    run_index: 1,
    run_slot: 1,
    attempt_sequence: 1,
    warmup_runs_target: 0,
    measured_runs_target: 1,
    trace_filename: path.basename(tracePath),
    trace_path: tracePath,
    trace_size_bytes: traceStats.size,
    trace_event_count: traceEvents.length,
    forensics_filename: path.basename(args.forensicsOut),
    forensics_path: args.forensicsOut,
    source_meta_path: sourceMetaPath,
    visibility_frame_probe_enabled: sourceMeta?.visibility_frame_probe_enabled === true,
    visibility_frame_probe_status: visibilityFrameProbe.status,
    visibility_frame_probe: sourceMeta?.visibility_frame_probe ? visibilityFrameProbe : undefined,
    ...visibilityFrameParity,
    ...attributionValidity,
    replay_analysis: true,
    no_warmup: true,
    fresh_lifecycle: true,
    trace_categories: TRACE_CATEGORIES.split(","),
    ...replayForegroundMetadata,
    capture_ms: replayCaptureMs,
    forensics_error: forensicsError,
    invalidation: { status: "not-applicable", reason: null }
  });

  if (forensicsError) {
    console.error(`REPLAY_FORENSICS_ERROR ${forensicsError}`);
    process.exitCode = 1;
    return;
  }

  console.log(`REPLAY_FORENSICS_OK trace=${tracePath}`);
  console.log(`REPLAY_META=${args.metaOut}`);
  console.log(`REPLAY_FORENSICS=${args.forensicsOut}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.analyzeExistingTrace) {
    await analyzeExistingTrace(args);
    return;
  }

  const scenario = readJson(args.scenario);
  const scenarioId = scenario.id;
  const sessionId = path.basename(args.outDir);
  const scenarioDir = path.join(args.outDir, scenarioId);
  const runsDir = path.join(scenarioDir, "runs");
  const tracePath = path.join(runsDir, `${args.runLabel}.trace.json`);
  const metaPath = path.join(runsDir, `${args.runLabel}.meta.json`);
  const forensicsPath = path.join(runsDir, `${args.runLabel}.forensics.json`);
  const chromeLogPath = path.join(scenarioDir, "chrome.log");
  const profileDir = path.join(scenarioDir, "chrome-profile");
  const version = browserVersion(args.browser);
  const phaseSchedule = scenario.phases || [];
  let chrome = null;
  let cleanupStatus = "not-run";
  let readinessState = null;
  let preStartState = null;
  let traceStartUtc = null;
  let traceEndUtc = null;
  let traceEventCount = 0;
  let forensicsStatus = "not-run";
  let forensicsError = null;
  const visibilityFrameProbe = createVisibilityFrameProbe(args.visibilityFrameProbe);
  const foregroundMetadata = createMacosActivationState(args);
  let visibilityFrameParity = null;
  let attributionValidity = null;

  await fsp.mkdir(runsDir, { recursive: true });
  if (!args.dryRun && fs.existsSync(tracePath)) {
    fail(`trace file already exists: ${tracePath}`);
  }

  const baseMetadata = {
    session_id: sessionId,
    scenario_id: scenarioId,
    run_kind: "measured",
    run_index: 1,
    run_slot: 1,
    attempt_sequence: 1,
    target_url: args.targetUrl,
    browser_path: args.browser,
    browser_version: version,
    os: process.platform,
    arch: process.arch,
    window_size: WINDOW_SIZE,
    trace_categories: TRACE_CATEGORIES.split(","),
    capture_method: "cdp-tracing-p1-no-warmup",
    machine_label: null,
    machine_class: null,
    network_mode: "local",
    operator: process.env.USER || null,
    warmup_runs_target: 0,
    measured_runs_target: 1,
    trace_filename: `${args.runLabel}.trace.json`,
    forensics_filename: `${args.runLabel}.forensics.json`,
    phase_schedule: phaseSchedule,
    capture_ms: Number(scenario.capture_ms ?? phaseSchedule.reduce((sum, phase) => sum + Number(phase.duration_ms || 0), 0)),
    settle_ms: Number(scenario.settle_ms || 0),
    remote_debugging_port: args.remoteDebuggingPort,
    profile_dir: profileDir,
    chrome_pid: null,
    no_warmup: true,
    fresh_lifecycle: true,
    visibility_frame_probe_enabled: args.visibilityFrameProbe,
    dry_run: args.dryRun
  };
  visibilityFrameParity = createVisibilityFrameParity(visibilityFrameProbe, baseMetadata.capture_ms);
  attributionValidity = createAttributionValidity(visibilityFrameProbe, visibilityFrameParity);

  if (args.dryRun) {
    if (args.visibilityFrameProbe) {
      visibilityFrameProbe.status = "dry-run";
    }
    visibilityFrameParity = createVisibilityFrameParity(visibilityFrameProbe, baseMetadata.capture_ms);
    attributionValidity = createAttributionValidity(visibilityFrameProbe, visibilityFrameParity);
    await writeJson(metaPath, {
      ...baseMetadata,
      ...foregroundMetadata,
      trace_start_utc: null,
      trace_end_utc: null,
      readiness_gate: null,
      pre_start_gate: null,
      visibility_frame_probe_status: visibilityFrameProbe.status,
      visibility_frame_probe: visibilityFrameProbe,
      ...visibilityFrameParity,
      ...attributionValidity,
      cleanup_status: "dry-run-no-chrome-launched",
      invalidation: { status: "not-applicable", reason: null }
    });
    await fsp.rm(profileDir, { recursive: true, force: true });
    console.log(`DRY_RUN_OK meta=${metaPath}`);
    return;
  }

  async function cleanup() {
    if (cleanupStatus !== "not-run") {
      return;
    }
    cleanupStatus = "started";
    if (chrome && !chrome.killed) {
      chrome.kill("SIGTERM");
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (!chrome.killed) {
            chrome.kill("SIGKILL");
          }
          resolve();
        }, 3000);
        chrome.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    try {
      await fsp.rm(profileDir, { recursive: true, force: true });
      cleanupStatus = "profile-removed";
    } catch (error) {
      cleanupStatus = `profile-remove-failed:${error.message}`;
    }
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
      await cleanup();
      process.exit(signal === "SIGINT" ? 130 : 143);
    });
  }

  try {
    await ensurePortAvailable(args.remoteDebuggingPort);
    await fsp.rm(profileDir, { recursive: true, force: true });
    await fsp.mkdir(profileDir, { recursive: true });
    const chromeLog = fs.openSync(chromeLogPath, "a");
    const chromeArgs = [
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${args.remoteDebuggingPort}`,
      "--new-window",
      "--window-size=1440,900",
      "--no-first-run",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-extensions",
      "--enable-precise-memory-info",
      "--disable-background-timer-throttling",
      args.targetUrl
    ];
    chrome = spawn(args.browser, chromeArgs, {
      stdio: ["ignore", chromeLog, chromeLog]
    });
    baseMetadata.chrome_pid = chrome.pid ?? null;

    await waitForCdp(args.remoteDebuggingPort);
    const browserInfo = await fetchJson(`http://127.0.0.1:${args.remoteDebuggingPort}/json/version`);
    const pageTarget = await resolvePage(args.remoteDebuggingPort, args.targetUrl);
    const browser = new CdpConnection(browserInfo.webSocketDebuggerUrl);
    const page = new CdpConnection(pageTarget.webSocketDebuggerUrl);

    await browser.open();
    await page.open();

    const traceEvents = [];
    browser.onEvent = (method, params) => {
      if (method === "Tracing.dataCollected" && Array.isArray(params.value)) {
        for (const event of params.value) {
          traceEvents.push(event);
        }
      }
    };

    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await activateMacosBrowserIfRequested(args, foregroundMetadata);
    await bringToFrontForVisibilityProbe(page, visibilityFrameProbe, "before_readiness");

    if (scenario.settle_ms > 0) {
      console.log(`[${args.runLabel}] Settle phase before tracing: ${scenario.settle_ms} ms`);
      await sleep(Number(scenario.settle_ms));
    }

    readinessState = await waitForReadiness(page);
    visibilityFrameProbe.readiness_gate = readinessState;
    await startVisibilityFrameProbe(page, visibilityFrameProbe);
    const tracingComplete = browser.waitFor("Tracing.tracingComplete");
    await bringToFrontForVisibilityProbe(page, visibilityFrameProbe, "before_tracing");
    await browser.send("Tracing.start", {
      categories: TRACE_CATEGORIES,
      transferMode: "ReportEvents"
    });

    if (args.visibilityFrameProbe) {
      try {
        visibilityFrameProbe.before_capture = await readVisibilityFrameState(page);
      } catch (error) {
        markVisibilityFrameProbeFailed(visibilityFrameProbe, `before-capture visibility/focus read failed: ${error.message}`);
      }
    }
    preStartState = await readTargetState(page);
    visibilityFrameProbe.pre_start_gate = preStartState;
    const preStartErrors = readinessErrors(preStartState);
    if (preStartErrors.length > 0) {
      throw new Error(`pre-start gate failed closed after Tracing.start: ${preStartErrors.join("; ")}`);
    }

    traceStartUtc = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    await mark(page, "p0:capture:start");

    for (const phase of phaseSchedule) {
      console.log(`[${args.runLabel}] Phase ${phase.id}: ${phase.label} (${phase.duration_ms} ms)`);
      await mark(page, `p0:phase:${phase.id}:start`);
      await sleep(Number(phase.duration_ms));
      await mark(page, `p0:phase:${phase.id}:end`);
    }

    await mark(page, "p0:capture:end");
    await browser.send("Tracing.end");
    await tracingComplete;
    await sleep(250);
    traceEndUtc = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    if (args.visibilityFrameProbe) {
      try {
        visibilityFrameProbe.after_capture = await readVisibilityFrameState(page);
      } catch (error) {
        markVisibilityFrameProbeFailed(visibilityFrameProbe, `after-capture visibility/focus read failed: ${error.message}`);
      }
      await collectVisibilityFrameProbe(page, visibilityFrameProbe);
    }
    finalizeVisibilityFrameProbe(visibilityFrameProbe);
    visibilityFrameParity = createVisibilityFrameParity(visibilityFrameProbe, baseMetadata.capture_ms);
    attributionValidity = createAttributionValidity(visibilityFrameProbe, visibilityFrameParity);

    if (traceEvents.length === 0) {
      throw new Error("Trace completed but produced zero events");
    }

    traceEventCount = traceEvents.length;
    await fsp.writeFile(tracePath, `${JSON.stringify({ traceEvents })}\n`);
    forensicsStatus = "pending";
    await writeJson(metaPath, {
      ...baseMetadata,
      ...foregroundMetadata,
      trace_start_utc: traceStartUtc,
      trace_end_utc: traceEndUtc,
      readiness_gate: readinessState,
      pre_start_gate: preStartState,
      visibility_frame_probe_status: visibilityFrameProbe.status,
      visibility_frame_probe: visibilityFrameProbe,
      ...visibilityFrameParity,
      ...attributionValidity,
      cleanup_status: "pending",
      trace_event_count: traceEventCount,
      forensics_status: forensicsStatus,
      forensics_error: null,
      invalidation: { status: "not-applicable", reason: null }
    });

    try {
      const forensics = analyzeForensics(traceEvents, tracePath);
      Object.assign(forensics, foregroundMetadata);
      if (args.visibilityFrameProbe) {
        forensics.visibility_frame_probe_status = visibilityFrameProbe.status;
        forensics.visibility_frame_probe = visibilityFrameProbe;
      }
      Object.assign(forensics, visibilityFrameParity);
      Object.assign(forensics, attributionValidity);
      await writeJson(forensicsPath, forensics);
      forensicsStatus = "ok";
    } catch (error) {
      forensicsStatus = "error";
      forensicsError = error.message;
      await writeJson(forensicsPath, {
        trace: tracePath,
        error: forensicsError,
        ...foregroundMetadata,
        visibility_frame_probe_status: visibilityFrameProbe.status,
        visibility_frame_probe: args.visibilityFrameProbe ? visibilityFrameProbe : undefined,
        ...visibilityFrameParity,
        ...attributionValidity
      });
      console.error(`Forensics failed after trace write: ${forensicsError}`);
    }
    page.close();
    browser.close();
  } finally {
    await cleanup();
  }

  await writeJson(metaPath, {
    ...baseMetadata,
    ...foregroundMetadata,
    trace_start_utc: traceStartUtc,
    trace_end_utc: traceEndUtc,
    readiness_gate: readinessState,
    pre_start_gate: preStartState,
    visibility_frame_probe_status: visibilityFrameProbe.status,
    visibility_frame_probe: visibilityFrameProbe,
    ...visibilityFrameParity,
    ...attributionValidity,
    cleanup_status: cleanupStatus,
    trace_event_count: traceEventCount,
    forensics_status: forensicsStatus,
    forensics_error: forensicsError,
    invalidation: { status: "not-applicable", reason: null }
  });

  console.log(`NO_WARMUP_CAPTURE_OK trace=${tracePath}`);
  console.log(`NO_WARMUP_META=${metaPath}`);
  console.log(`NO_WARMUP_FORENSICS=${forensicsPath}`);
}

main().catch(async (error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
