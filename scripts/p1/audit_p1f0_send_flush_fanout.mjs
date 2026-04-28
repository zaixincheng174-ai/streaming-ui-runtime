#!/usr/bin/env node

import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const targetPath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_send_flush_fanout_baseline.html", import.meta.url)
);

const DEFAULT_QUERY = [
  "baseline_id=p1-send-flush-fanout",
  "scenario_mode=p1-f0-send-flush-fanout",
  "calibration_level=light",
  "session_size=100",
  "module_count=4",
  "subscribers_per_module=8",
  "fanout_width=16",
  "queued_effect_count=32",
  "state_nodes_touched=128",
  "flush_batch_size=32",
  "commit_update_count=1",
  "microtask_chain_length=2",
  "payload_shape=small-json",
  "history_mount_size=100",
  "content_richness=light",
  "synthetic_pressure_multiplier=1"
].join("&");

const REQUIRED_AUDIT_FIELDS = [
  "baseline_id",
  "scenario_mode",
  "calibration_level",
  "config_valid",
  "capture_allowed",
  "config_errors",
  "synthetic_pressure_multiplier",
  "future_output_pre_rendered",
  "stable_keys",
  "react_memo_enabled",
  "deferred_rendering",
  "token_coalescing",
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
  "action_sequence_hash",
  "workload_source_hash"
];

const REQUIRED_SIMULATED_F0_MARKS = [
  "p1:capture:1:f0:start",
  "p1:capture:1:f0:trigger:start",
  "p1:capture:1:f0:synthetic-pointerup",
  "p1:capture:1:f0:synthetic-click",
  "p1:capture:1:f0:trigger:end",
  "p1:capture:1:f0:flush:start",
  "p1:capture:1:f0:microtask:start",
  "p1:capture:1:f0:react-commit:start",
  "p1:capture:1:f0:react-commit:end",
  "p1:capture:1:f0:flush:end",
  "p1:capture:1:f0:end"
];

function usage() {
  console.log(`Usage:
  node scripts/p1/audit_p1f0_send_flush_fanout.mjs [--query QUERY] [--expect-valid true|false] [--simulate-capture]

Examples:
  node scripts/p1/audit_p1f0_send_flush_fanout.mjs
  node scripts/p1/audit_p1f0_send_flush_fanout.mjs --query "synthetic_pressure_multiplier=2" --expect-valid false
  node scripts/p1/audit_p1f0_send_flush_fanout.mjs --simulate-capture`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let query = DEFAULT_QUERY;
  let expectValid = true;
  let simulateCapture = false;

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
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  return { query, expectValid, simulateCapture };
}

function createNode(id) {
  const listeners = new Map();
  return {
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

  const drainMicrotasks = () => {
    while (microtasks.length > 0) {
      const task = microtasks.shift();
      task();
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
      useMemo: (factory) => factory(),
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
        const entry = { name, entryType: "mark", startTime: marks.length };
        marks.push(entry);
        notifyMarkObservers(entry);
      },
      getEntriesByType(type) {
        return type === "mark" ? marks.slice() : [];
      },
      getEntriesByName(name) {
        return marks.filter((entry) => entry.name === name);
      },
      now: () => 0
    },
    PerformanceObserver: function PerformanceObserver(callback) {
      this.callback = callback;
      this.observe = function observe() {
        markObservers.push(this);
      };
    },
    URLSearchParams,
    console
  };

  windowObject.React = context.React;
  windowObject.ReactDOM = context.ReactDOM;
  windowObject.performance = context.performance;
  windowObject.PerformanceObserver = context.PerformanceObserver;
  windowObject.HTMLButtonElement = function HTMLButtonElement() {};
  context.HTMLButtonElement = windowObject.HTMLButtonElement;
  Object.setPrototypeOf(nodeFor("send-button"), windowObject.HTMLButtonElement.prototype);
  context.queueMicrotask = windowObject.queueMicrotask;
  vm.createContext(context);
  vm.runInContext(inlineScript, context, { filename: targetPath });

  if (options.simulateCapture) {
    context.performance.mark("p0:capture:start");
    drainMicrotasks();
  }

  const exposed = context.window.__p1F0SendFlushFanout;
  if (!exposed?.audit) {
    throw new Error("F0 target did not expose window.__p1F0SendFlushFanout.audit");
  }
  exposed.simulated_marks = marks.map((entry) => entry.name);
  return exposed;
}

function formatValue(value) {
  return typeof value === "boolean" ? String(value) : value;
}

function main() {
  const { query, expectValid, simulateCapture } = parseArgs(process.argv.slice(2));
  const exposed = auditValues(query, { simulateCapture });
  const audit = exposed.audit;
  const counters = exposed.counters;
  let overallPass = true;

  console.log("P1-F0 send/flush fanout audit");
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

  const validityMatches = audit.config_valid === expectValid && audit.capture_allowed === expectValid;
  if (!validityMatches) {
    overallPass = false;
  }
  if (expectValid && audit.config_errors !== "none") {
    overallPass = false;
  }
  if (!expectValid && audit.config_errors === "none") {
    overallPass = false;
  }

  console.log("");
  console.log(`config_valid=${audit.config_valid}`);
  console.log(`capture_allowed=${audit.capture_allowed}`);
  console.log(`config_errors=${audit.config_errors}`);
  console.log(`expect_valid=${expectValid}`);
  console.log(`validity_status=${validityMatches ? "PASS" : "FAIL"}`);
  console.log(`initial_module_flush_count=${counters.module_flush_count}`);
  console.log(`initial_subscriber_notify_count=${counters.subscriber_notify_count}`);
  console.log(`simulate_capture=${simulateCapture}`);
  if (simulateCapture) {
    const simulatedMarkSet = new Set(exposed.simulated_marks || []);
    const missingMarks = REQUIRED_SIMULATED_F0_MARKS.filter((markName) => !simulatedMarkSet.has(markName));
    const f0Complete = missingMarks.length === 0 && counters.f0_marks_complete === true;
    let counterComplete = counters.module_flush_count === audit.module_count &&
      counters.subscriber_notify_count === audit.module_count * audit.subscribers_per_module &&
      counters.queued_effect_count_observed === audit.queued_effect_count &&
      counters.state_nodes_touched_observed === audit.state_nodes_touched &&
      counters.react_commit_count === audit.commit_update_count;
    if (audit.derived_work_enabled === true) {
      counterComplete = counterComplete &&
        counters.derived_selector_eval_count === audit.module_count * audit.subscribers_per_module * audit.selector_passes_per_subscriber &&
        counters.queue_drain_step_count === audit.module_count * audit.queue_drain_steps_per_module &&
        counters.projection_update_count_observed === audit.projection_update_count &&
        counters.derived_hash_rounds_observed === audit.state_nodes_touched * audit.derived_hash_rounds;
    }
    if (!f0Complete || !counterComplete) {
      overallPass = false;
    }
    console.log(`simulated_f0_marks_complete=${f0Complete}`);
    console.log(`simulated_missing_f0_marks=${missingMarks.length > 0 ? missingMarks.join("|") : "none"}`);
    console.log(`simulated_module_flush_count=${counters.module_flush_count}`);
    console.log(`simulated_subscriber_notify_count=${counters.subscriber_notify_count}`);
    console.log(`simulated_queued_effect_count_observed=${counters.queued_effect_count_observed}`);
    console.log(`simulated_state_nodes_touched_observed=${counters.state_nodes_touched_observed}`);
    console.log(`simulated_react_commit_count=${counters.react_commit_count}`);
    console.log(`simulated_derived_selector_eval_count=${counters.derived_selector_eval_count}`);
    console.log(`simulated_queue_drain_step_count=${counters.queue_drain_step_count}`);
    console.log(`simulated_projection_update_count_observed=${counters.projection_update_count_observed}`);
    console.log(`simulated_derived_hash_rounds_observed=${counters.derived_hash_rounds_observed}`);
    console.log(`simulated_counter_status=${counterComplete ? "PASS" : "FAIL"}`);
  }
  console.log(`overall=${overallPass ? "PASS" : "FAIL"}`);

  if (!overallPass) {
    process.exitCode = 1;
  }
}

main();
