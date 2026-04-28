#!/usr/bin/env node

import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const targetPath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_worker_flush_fanout_baseline.html", import.meta.url)
);

const DEFAULT_QUERY = [
  "baseline_id=p1-worker-offload-fanout",
  "scenario_mode=p1-f1-worker-offload-ab",
  "calibration_level=derived",
  "session_size=2500",
  "module_count=20",
  "subscribers_per_module=96",
  "fanout_width=192",
  "queued_effect_count=2048",
  "state_nodes_touched=32768",
  "flush_batch_size=2048",
  "commit_update_count=4",
  "microtask_chain_length=8",
  "payload_shape=derived-json",
  "history_mount_size=2500",
  "content_richness=derived",
  "synthetic_pressure_multiplier=1",
  "derived_work_enabled=true",
  "selector_passes_per_subscriber=8",
  "queue_drain_steps_per_module=256",
  "state_read_stride=7",
  "derived_hash_rounds=4",
  "projection_update_count=6",
  "worker_offload_enabled=true",
  "worker_mode=dedicated-worker",
  "equivalent_work_required=true",
  "precompute_before_click=false"
].join("&");

const REQUIRED_AUDIT_FIELDS = [
  "baseline_id",
  "scenario_mode",
  "worker_offload_enabled",
  "worker_mode",
  "equivalent_work_required",
  "synthetic_pressure_multiplier",
  "no_precompute_before_click",
  "config_valid",
  "capture_allowed",
  "config_errors",
  "calibration_level",
  "session_size",
  "module_count",
  "subscribers_per_module",
  "fanout_width",
  "queued_effect_count",
  "state_nodes_touched",
  "flush_batch_size",
  "commit_update_count",
  "microtask_chain_length",
  "payload_shape",
  "history_mount_size",
  "content_richness",
  "derived_work_enabled",
  "selector_passes_per_subscriber",
  "queue_drain_steps_per_module",
  "state_read_stride",
  "derived_hash_rounds",
  "projection_update_count",
  "worker_result_checksum",
  "workload_source_hash",
  "action_sequence_hash"
];

const REQUIRED_SIMULATED_F1_MARKS = [
  "p1:capture:1:f1:start",
  "p1:capture:1:f1:trigger:start",
  "p1:capture:1:f1:trigger:end",
  "p1:capture:1:f1:dispatch-to-worker:start",
  "p1:capture:1:f1:dispatch-to-worker:end",
  "p1:capture:1:f1:worker-result:received",
  "p1:capture:1:f1:projection-commit:start",
  "p1:capture:1:f1:projection-commit:end",
  "p1:capture:1:f1:end"
];

const REQUIRED_SIMULATED_METRICS = [
  "f1_worker_compute_ms",
  "f1_worker_flush_ms",
  "f1_worker_module_flush_count",
  "f1_worker_subscriber_notify_count",
  "f1_worker_queue_drain_step_count",
  "f1_worker_derived_selector_eval_count",
  "f1_worker_state_nodes_touched_observed",
  "f1_worker_derived_hash_rounds_observed",
  "f1_worker_projection_update_count_observed",
  "f1_worker_result_bytes",
  "f1_worker_roundtrip_ms",
  "f1_worker_error",
  "f1_main_click_window_ms",
  "f1_main_dispatch_window_ms",
  "f1_main_projection_commit_ms",
  "f1_main_total_visible_update_ms",
  "react_commit_count",
  "react_root_render_count",
  "react_component_render_count",
  "worker_result_checksum"
];

function usage() {
  console.log(`Usage:
  node scripts/p1/audit_p1f1_worker_offload.mjs [--query QUERY] [--expect-valid true|false] [--simulate-capture]
       [--simulate-missing-worker-checksum] [--simulate-reduced-counters]

Examples:
  node scripts/p1/audit_p1f1_worker_offload.mjs
  node scripts/p1/audit_p1f1_worker_offload.mjs --simulate-capture
  node scripts/p1/audit_p1f1_worker_offload.mjs --query "synthetic_pressure_multiplier=2" --expect-valid false`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let query = DEFAULT_QUERY;
  let expectValid = true;
  let simulateCapture = false;
  const auditOptions = {
    missingWorkerChecksum: false,
    reducedCounters: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--query") {
      query = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--expect-valid") {
      const value = argv[index + 1];
      if (value !== "true" && value !== "false") {
        fail(`invalid --expect-valid value: ${value}`);
      }
      expectValid = value === "true";
      index += 1;
    } else if (arg === "--simulate-capture") {
      simulateCapture = true;
    } else if (arg === "--simulate-missing-worker-checksum") {
      auditOptions.missingWorkerChecksum = true;
    } else if (arg === "--simulate-reduced-counters") {
      auditOptions.reducedCounters = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  return { query, expectValid, simulateCapture, auditOptions };
}

function createNode(id) {
  const listeners = new Map();
  const node = {
    id,
    innerHTML: "",
    textContent: "",
    value: "",
    disabled: false,
    addEventListener(type, listener) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(listener);
    },
    dispatchEvent(event) {
      event.target = this;
      event.currentTarget = this;
      for (const listener of listeners.get(event.type) || []) {
        listener.call(this, event);
      }
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
  return node;
}

function extractInlineScript(html) {
  const scripts = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => script.trim().length > 0);
  const inlineScript = scripts.at(-1);
  if (!inlineScript) {
    throw new Error(`No inline script found in ${targetPath}`);
  }
  return inlineScript;
}

function auditValues(query, options = {}) {
  const html = fs.readFileSync(targetPath, "utf8");
  const inlineScript = extractInlineScript(html);
  const nodes = new Map();
  const nodeFor = (id) => {
    if (!nodes.has(id)) {
      nodes.set(id, createNode(id));
    }
    return nodes.get(id);
  };
  const microtasks = [];
  const marks = [];
  const markObservers = [];
  let rootElement = null;
  let hookStates = [];
  let hookIndex = 0;
  let nowValue = 0;

  const drainMicrotasks = () => {
    let guard = 0;
    while (microtasks.length > 0) {
      const task = microtasks.shift();
      nowValue += 0.25;
      task();
      guard += 1;
      if (guard > 10000) {
        throw new Error("microtask drain exceeded guard");
      }
    }
  };

  const runElement = (element) => {
    if (!element || typeof element !== "object") {
      return;
    }
    if (Array.isArray(element)) {
      for (const child of element) {
        runElement(child);
      }
      return;
    }
    if (typeof element.type === "function") {
      runElement(element.type({ ...(element.props || {}), children: element.children || [] }));
      return;
    }
    if (element.type === context.React.Fragment) {
      for (const child of element.children || []) {
        runElement(child);
      }
    }
  };

  const renderRoot = () => {
    hookIndex = 0;
    runElement(rootElement);
  };

  const notifyMarkObservers = (entry) => {
    const list = { getEntries: () => [entry] };
    for (const observer of markObservers) {
      observer.callback(list);
    }
  };

  const windowObject = {
    location: { search: query ? `?${query}` : "" },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    requestAnimationFrame() {
      return 1;
    },
    Event: function Event(type) {
      this.type = type;
      this.preventDefault = function preventDefault() {};
    },
    PointerEvent: function PointerEvent(type) {
      this.type = type;
      this.preventDefault = function preventDefault() {};
    },
    queueMicrotask(callback) {
      microtasks.push(callback);
    },
    addEventListener() {},
    removeEventListener() {}
  };

  const context = {
    window: windowObject,
    document: {
      getElementById: nodeFor,
      querySelector: () => null,
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
      createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
      memo: (component) => component,
      useLayoutEffect(callback) {
        callback();
      },
      useState(initialValue) {
        const stateIndex = hookIndex;
        hookIndex += 1;
        if (hookStates[stateIndex] === undefined) {
          hookStates[stateIndex] = initialValue;
        }
        const setState = (nextValue) => {
          const currentValue = hookStates[stateIndex];
          hookStates[stateIndex] = typeof nextValue === "function" ? nextValue(currentValue) : nextValue;
          renderRoot();
        };
        return [hookStates[stateIndex], setState];
      },
      Fragment: Symbol.for("react.fragment")
    },
    ReactDOM: {
      createRoot: () => ({
        render(element) {
          rootElement = element;
          renderRoot();
        }
      })
    },
    performance: {
      mark(name) {
        const entry = { name, entryType: "mark", startTime: nowValue };
        marks.push(entry);
        notifyMarkObservers(entry);
      },
      getEntriesByType(type) {
        return type === "mark" ? marks.slice() : [];
      },
      getEntriesByName(name) {
        return marks.filter((entry) => entry.name === name);
      },
      now: () => nowValue
    },
    PerformanceObserver: function PerformanceObserver(callback) {
      this.callback = callback;
      this.observe = function observe() {
        markObservers.push(this);
      };
    },
    URLSearchParams,
    Blob: function Blob() {},
    URL: { createObjectURL: () => "blob:audit", revokeObjectURL() {} },
    Worker: function Worker() {
      throw new Error("Worker should not be constructed during audit simulation");
    },
    console
  };

  windowObject.React = context.React;
  windowObject.ReactDOM = context.ReactDOM;
  windowObject.performance = context.performance;
  windowObject.PerformanceObserver = context.PerformanceObserver;
  context.queueMicrotask = windowObject.queueMicrotask;
  vm.createContext(context);
  vm.runInContext(inlineScript, context, { filename: targetPath });

  if (options.simulateCapture) {
    context.window.__p1F1AuditOptions = options.auditOptions || {};
    context.performance.mark("p0:capture:start");
    drainMicrotasks();
  }

  const exposed = context.window.__p1F1WorkerOffload;
  if (!exposed?.audit) {
    throw new Error("F1 target did not expose window.__p1F1WorkerOffload.audit");
  }
  exposed.simulated_marks = marks.map((entry) => entry.name);
  return exposed;
}

function formatValue(value) {
  return typeof value === "boolean" ? String(value) : value;
}

function main() {
  const { query, expectValid, simulateCapture, auditOptions } = parseArgs(process.argv.slice(2));
  const exposed = auditValues(query, { simulateCapture, auditOptions });
  const audit = exposed.audit;
  const counters = exposed.counters;
  let overallPass = true;

  console.log("P1-F1 worker-offload fanout audit");
  console.log(`target=${targetPath}`);
  console.log(`query=${query}`);
  console.log("");
  console.log("field,value,status");

  for (const field of REQUIRED_AUDIT_FIELDS) {
    const value = audit[field];
    const present = value !== undefined && value !== null && value !== "";
    if (!present) {
      overallPass = false;
    }
    console.log(`${field},${formatValue(value)},${present ? "PASS" : "FAIL"}`);
  }

  const configValidityMatches = audit.config_valid === expectValid && audit.capture_allowed === expectValid;
  let resultValidityMatches = true;
  let resultValid = true;
  if (simulateCapture) {
    const simulatedMarkSet = new Set(exposed.simulated_marks || []);
    const missingMarks = REQUIRED_SIMULATED_F1_MARKS.filter((markName) => !simulatedMarkSet.has(markName));
    resultValid = counters.f1_marks_complete === true &&
      counters.f1_worker_error === "none" &&
      counters.worker_result_checksum !== "pending" &&
      counters.worker_result_checksum !== "missing" &&
      missingMarks.length === 0 &&
      counters.f1_worker_module_flush_count === audit.module_count &&
      counters.f1_worker_subscriber_notify_count === audit.module_count * audit.subscribers_per_module &&
      counters.f1_worker_queued_effect_count_observed === audit.queued_effect_count &&
      counters.f1_worker_state_nodes_touched_observed === audit.state_nodes_touched &&
      counters.f1_worker_derived_selector_eval_count === audit.module_count * audit.subscribers_per_module * audit.selector_passes_per_subscriber &&
      counters.f1_worker_queue_drain_step_count === audit.module_count * audit.queue_drain_steps_per_module &&
      counters.f1_worker_derived_hash_rounds_observed === audit.state_nodes_touched * audit.derived_hash_rounds &&
      counters.f1_worker_projection_update_count_observed === audit.projection_update_count;
    for (const field of REQUIRED_SIMULATED_METRICS) {
      const value = counters[field];
      if (value === undefined || value === null || value === "" || value === "pending") {
        resultValid = false;
      }
    }
    resultValidityMatches = resultValid === expectValid;
    if (!resultValidityMatches) {
      overallPass = false;
    }
    console.log("");
    console.log(`simulated_f1_marks_complete=${counters.f1_marks_complete}`);
    console.log(`simulated_missing_f1_marks=${missingMarks.length > 0 ? missingMarks.join("|") : "none"}`);
    console.log(`simulated_worker_error=${counters.f1_worker_error}`);
    console.log(`simulated_worker_result_checksum=${counters.worker_result_checksum}`);
    console.log(`simulated_worker_module_flush_count=${counters.f1_worker_module_flush_count}`);
    console.log(`simulated_worker_subscriber_notify_count=${counters.f1_worker_subscriber_notify_count}`);
    console.log(`simulated_worker_queued_effect_count_observed=${counters.f1_worker_queued_effect_count_observed}`);
    console.log(`simulated_worker_state_nodes_touched_observed=${counters.f1_worker_state_nodes_touched_observed}`);
    console.log(`simulated_worker_derived_selector_eval_count=${counters.f1_worker_derived_selector_eval_count}`);
    console.log(`simulated_worker_queue_drain_step_count=${counters.f1_worker_queue_drain_step_count}`);
    console.log(`simulated_worker_derived_hash_rounds_observed=${counters.f1_worker_derived_hash_rounds_observed}`);
    console.log(`simulated_worker_projection_update_count_observed=${counters.f1_worker_projection_update_count_observed}`);
    console.log(`simulated_result_status=${resultValid ? "PASS" : "FAIL"}`);
  } else if (!configValidityMatches) {
    overallPass = false;
  }

  if (!simulateCapture && !configValidityMatches) {
    overallPass = false;
  }
  if (expectValid && audit.config_errors !== "none") {
    overallPass = false;
  }
  if (!expectValid && audit.config_errors === "none" && !simulateCapture) {
    overallPass = false;
  }

  console.log("");
  console.log(`config_valid=${audit.config_valid}`);
  console.log(`capture_allowed=${audit.capture_allowed}`);
  console.log(`config_errors=${audit.config_errors}`);
  console.log(`expect_valid=${expectValid}`);
  console.log(`config_validity_status=${configValidityMatches ? "PASS" : "FAIL"}`);
  console.log(`simulate_capture=${simulateCapture}`);
  console.log(`result_validity_status=${resultValidityMatches ? "PASS" : "FAIL"}`);
  console.log(`overall=${overallPass ? "PASS" : "FAIL"}`);

  if (!overallPass) {
    process.exitCode = 1;
  }
}

main();
