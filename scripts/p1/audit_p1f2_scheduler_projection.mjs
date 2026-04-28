#!/usr/bin/env node

import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const targetPath = fileURLToPath(
  new URL("../../bench/p1/targets/p1_worker_scheduler_projection_baseline.html", import.meta.url)
);

const BASE_QUERY_PARTS = [
  "baseline_id=p1-worker-scheduler-projection",
  "scenario_mode=p1-f2-worker-scheduler-projection",
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
  "urgent_projection_enabled=true",
  "urgent_projection_delay_ms=10",
  "stale_result_policy=reject",
  "version_check_enabled=true",
  "urgent_priority=visible-projection",
  "precompute_before_click=false"
];

const MODE_QUERY_PARTS = {
  monolithic: [
    "scheduler_mode=monolithic",
    "worker_chunk_size=all",
    "worker_chunk_budget_ms=0",
    "worker_yield_strategy=none",
    "preemption_enabled=false"
  ],
  scheduled: [
    "scheduler_mode=scheduled",
    "worker_chunk_size=128",
    "worker_chunk_budget_ms=4",
    "worker_yield_strategy=message-channel",
    "preemption_enabled=true"
  ]
};

const REQUIRED_AUDIT_FIELDS = [
  "baseline_id",
  "scenario_mode",
  "scheduler_mode",
  "urgent_projection_enabled",
  "urgent_projection_delay_ms",
  "worker_chunk_size",
  "worker_chunk_budget_ms",
  "worker_yield_strategy",
  "stale_result_policy",
  "version_check_enabled",
  "urgent_priority",
  "preemption_enabled",
  "synthetic_pressure_multiplier",
  "no_precompute_before_click",
  "config_valid",
  "capture_allowed",
  "config_errors",
  "stable_keys",
  "react_memo_enabled",
  "deferred_rendering",
  "token_coalescing",
  "priority_order",
  "transaction_model_fields",
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
  "workload_source_hash",
  "action_sequence_hash",
  "worker_equivalence_checksum"
];

const REQUIRED_SIMULATED_F2_MARKS = [
  "p1:capture:1:f2:start",
  "p1:capture:1:f2:trigger:start",
  "p1:capture:1:f2:trigger:end",
  "p1:capture:1:f2:heavy-dispatch:start",
  "p1:capture:1:f2:heavy-dispatch:end",
  "p1:capture:1:f2:urgent-request:start",
  "p1:capture:1:f2:urgent-request:end",
  "p1:capture:1:f2:urgent-result:received",
  "p1:capture:1:f2:urgent-projection-commit:start",
  "p1:capture:1:f2:urgent-projection-commit:end",
  "p1:capture:1:f2:heavy-result:received",
  "p1:capture:1:f2:heavy-projection-commit:start",
  "p1:capture:1:f2:heavy-projection-commit:end",
  "p1:capture:1:f2:end"
];

const REQUIRED_SIMULATED_METRICS = [
  "f2_urgent_projection_visible_update_ms",
  "f2_urgent_projection_commit_ms",
  "f2_heavy_projection_commit_ms",
  "f2_input_dispatch_ms",
  "f2_worker_heavy_txn_total_ms",
  "f2_worker_urgent_txn_latency_ms",
  "f2_worker_urgent_wait_ms",
  "f2_worker_chunk_count",
  "f2_worker_max_chunk_ms",
  "f2_worker_yield_count",
  "f2_worker_preemptions",
  "f2_worker_stale_txn_count",
  "f2_worker_completed_txn_count",
  "f2_worker_dropped_txn_count",
  "f2_worker_equivalence_checksum",
  "f2_worker_roundtrip_ms",
  "f2_worker_error",
  "heavy_sent_at_main",
  "urgent_sent_at_main",
  "urgent_ack_received_at_main",
  "urgent_main_ack_latency_ms",
  "urgent_projection_visible_at_main",
  "urgent_end_to_end_visible_ms",
  "urgent_request_sent_at_main",
  "urgent_request_received_at_worker",
  "urgent_worker_start_at",
  "urgent_worker_done_at",
  "heavy_worker_start_at",
  "heavy_worker_done_at",
  "urgent_main_to_worker_delay_ms",
  "urgent_worker_queue_wait_ms",
  "urgent_end_to_end_latency_ms",
  "scheduled_preemption_count",
  "module_flush_count",
  "subscriber_notify_count",
  "queue_drain_step_count",
  "derived_selector_eval_count",
  "state_nodes_touched_observed",
  "derived_hash_rounds_observed",
  "projection_update_count_observed",
  "react_commit_count",
  "react_root_render_count",
  "react_component_render_count"
];

const REQUIRED_SIMULATED_F2_METRIC_MARK_PREFIXES = [
  "p1:capture:1:metric:urgent_ack_received_at_main=",
  "p1:capture:1:metric:urgent_main_ack_latency_ms=",
  "p1:capture:1:metric:urgent_projection_visible_at_main=",
  "p1:capture:1:metric:urgent_end_to_end_visible_ms="
];

const REQUIRED_WORKER_SOURCE_DEPENDENCIES = [
  "const computeHeavyTransaction = ${computeHeavyTransaction.toString()};",
  "const expectedEquivalence = ${expectedEquivalence.toString()};",
  "const buildHeavyResult = ${buildHeavyResult.toString()};",
  "const buildUrgentResult = ${buildUrgentResult.toString()};"
];

const REQUIRED_F2_COMPLETION_CONTRACT = [
  "let pendingProjectionCommits = [];",
  "pendingProjectionCommits.push(pendingCommit);",
  "const completedCommits = pendingProjectionCommits.splice(0);",
  "mark(\"f2:heavy-projection-commit:end\");",
  "mark(\"f2:end\");",
  "urgent_main_to_worker_delay_ms",
  "urgent_worker_queue_wait_ms",
  "urgent_end_to_end_latency_ms",
  "urgent_main_ack_latency_ms",
  "urgent_end_to_end_visible_ms"
];

const FORBIDDEN_F2_COMPLETION_CONTRACT = [
  "pendingCommitKind"
];

function defaultQueryForMode(mode) {
  return [...BASE_QUERY_PARTS, ...MODE_QUERY_PARTS[mode]].join("&");
}

function usage() {
  console.log(`Usage:
  node scripts/p1/audit_p1f2_scheduler_projection.mjs [--mode monolithic|scheduled] [--query QUERY]
       [--expect-valid true|false] [--simulate-capture]
       [--simulate-missing-checksum] [--simulate-reduced-counters] [--simulate-stale-commit]

Examples:
  node scripts/p1/audit_p1f2_scheduler_projection.mjs --mode monolithic
  node scripts/p1/audit_p1f2_scheduler_projection.mjs --mode scheduled --simulate-capture
  node scripts/p1/audit_p1f2_scheduler_projection.mjs --query "synthetic_pressure_multiplier=2" --expect-valid false`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let mode = "scheduled";
  let query = null;
  let expectValid = true;
  let simulateCapture = false;
  const auditOptions = {
    missingChecksum: false,
    reducedCounters: false,
    staleCommit: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") {
      mode = argv[index + 1];
      if (!Object.hasOwn(MODE_QUERY_PARTS, mode)) {
        fail(`invalid --mode value: ${mode}`);
      }
      index += 1;
    } else if (arg === "--query") {
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
    } else if (arg === "--simulate-missing-checksum") {
      auditOptions.missingChecksum = true;
    } else if (arg === "--simulate-reduced-counters") {
      auditOptions.reducedCounters = true;
    } else if (arg === "--simulate-stale-commit") {
      auditOptions.staleCommit = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  return {
    mode,
    query: query ?? defaultQueryForMode(mode),
    expectValid,
    simulateCapture,
    auditOptions
  };
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

function validateWorkerSourceDependencies(inlineScript) {
  const missing = REQUIRED_WORKER_SOURCE_DEPENDENCIES.filter((dependency) => !inlineScript.includes(dependency));
  return {
    ok: missing.length === 0,
    missing
  };
}

function validateF2CompletionContract(inlineScript) {
  const missing = REQUIRED_F2_COMPLETION_CONTRACT.filter((dependency) => !inlineScript.includes(dependency));
  const forbidden = FORBIDDEN_F2_COMPLETION_CONTRACT.filter((dependency) => inlineScript.includes(dependency));
  return {
    ok: missing.length === 0 && forbidden.length === 0,
    missing,
    forbidden
  };
}

function auditValues(query, options = {}) {
  const html = fs.readFileSync(targetPath, "utf8");
  const inlineScript = extractInlineScript(html);
  const workerSourceDependencies = validateWorkerSourceDependencies(inlineScript);
  const f2CompletionContract = validateF2CompletionContract(inlineScript);
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
      if (guard > 20000) {
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
    context.window.__p1F2AuditOptions = options.auditOptions || {};
    context.performance.mark("p0:capture:start");
    drainMicrotasks();
  }

  const exposed = context.window.__p1F2SchedulerProjection;
  if (!exposed?.audit) {
    throw new Error("F2 target did not expose window.__p1F2SchedulerProjection.audit");
  }
  exposed.simulated_marks = marks.map((entry) => entry.name);
  exposed.worker_source_dependency_status = workerSourceDependencies.ok ? "PASS" : "FAIL";
  exposed.worker_source_dependency_missing = workerSourceDependencies.missing;
  exposed.f2_completion_contract_status = f2CompletionContract.ok ? "PASS" : "FAIL";
  exposed.f2_completion_contract_missing = f2CompletionContract.missing;
  exposed.f2_completion_contract_forbidden = f2CompletionContract.forbidden;
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
  const workerSourceDependencyPass = exposed.worker_source_dependency_status === "PASS";
  const f2CompletionContractPass = exposed.f2_completion_contract_status === "PASS";
  let overallPass = true;

  console.log("P1-F2 scheduler projection audit");
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

  if (!workerSourceDependencyPass) {
    overallPass = false;
  }
  if (!f2CompletionContractPass) {
    overallPass = false;
  }

  const configValidityMatches = audit.config_valid === expectValid && audit.capture_allowed === expectValid;
  let resultValidityMatches = true;
  let resultValid = true;
  if (simulateCapture) {
    const simulatedMarkSet = new Set(exposed.simulated_marks || []);
    const missingMarks = REQUIRED_SIMULATED_F2_MARKS.filter((markName) => !simulatedMarkSet.has(markName));
    const missingMetricMarks = REQUIRED_SIMULATED_F2_METRIC_MARK_PREFIXES.filter((prefix) => (
      !(exposed.simulated_marks || []).some((markName) => markName.startsWith(prefix))
    ));
    const expectedSubscriberCount = audit.module_count * audit.subscribers_per_module;
    const expectedQueueDrainSteps = audit.module_count * audit.queue_drain_steps_per_module;
    const expectedSelectorEvals = audit.module_count * audit.subscribers_per_module * audit.selector_passes_per_subscriber;
    const expectedHashRounds = audit.state_nodes_touched * audit.derived_hash_rounds;
    const urgentMainAckLatency = Number(counters.urgent_main_ack_latency_ms);
    const urgentVisibleLatency = Number(counters.urgent_end_to_end_visible_ms);
    const urgentMainToWorkerDelay = Number(counters.urgent_main_to_worker_delay_ms);
    const urgentWorkerQueueWait = Number(counters.urgent_worker_queue_wait_ms);
    const urgentEndToEndLatency = Number(counters.urgent_end_to_end_latency_ms);
    const modeUrgencyPass = audit.scheduler_mode === "monolithic"
      ? urgentMainAckLatency >= Math.max(1, 40 - audit.urgent_projection_delay_ms) && urgentVisibleLatency >= urgentMainAckLatency
      : urgentMainAckLatency <= audit.worker_chunk_budget_ms && urgentVisibleLatency <= audit.worker_chunk_budget_ms + 10;
    const modeSchedulerPass = audit.scheduler_mode === "monolithic"
      ? counters.f2_worker_preemptions === 0 && counters.f2_worker_yield_count === 0
      : counters.f2_worker_preemptions >= 1 && counters.f2_worker_yield_count >= 1;

    resultValid = counters.f2_marks_complete === true &&
      counters.f2_worker_error === "none" &&
      Number.isInteger(counters.f2_worker_equivalence_checksum) &&
      missingMarks.length === 0 &&
      missingMetricMarks.length === 0 &&
      modeUrgencyPass &&
      modeSchedulerPass &&
      counters.module_flush_count === audit.module_count &&
      counters.subscriber_notify_count === expectedSubscriberCount &&
      counters.queue_drain_step_count === expectedQueueDrainSteps &&
      counters.derived_selector_eval_count === expectedSelectorEvals &&
      counters.state_nodes_touched_observed === audit.state_nodes_touched &&
      counters.derived_hash_rounds_observed === expectedHashRounds &&
      counters.projection_update_count_observed === audit.projection_update_count;
    resultValid = resultValid &&
      Number.isFinite(urgentMainAckLatency) &&
      Number.isFinite(urgentVisibleLatency) &&
      Number.isFinite(urgentMainToWorkerDelay) &&
      Number.isFinite(urgentWorkerQueueWait) &&
      Number.isFinite(urgentEndToEndLatency) &&
      urgentVisibleLatency >= urgentMainAckLatency &&
      urgentEndToEndLatency >= urgentMainToWorkerDelay + urgentWorkerQueueWait;

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
    console.log(`simulated_f2_marks_complete=${counters.f2_marks_complete}`);
    console.log(`simulated_missing_f2_marks=${missingMarks.length > 0 ? missingMarks.join("|") : "none"}`);
    console.log(`simulated_missing_f2_metric_marks=${missingMetricMarks.length > 0 ? missingMetricMarks.join("|") : "none"}`);
    console.log(`simulated_scheduler_mode=${audit.scheduler_mode}`);
    console.log(`simulated_worker_error=${counters.f2_worker_error}`);
    console.log(`simulated_worker_equivalence_checksum=${counters.f2_worker_equivalence_checksum}`);
    console.log(`simulated_urgent_main_ack_latency_ms=${counters.urgent_main_ack_latency_ms}`);
    console.log(`simulated_urgent_end_to_end_visible_ms=${counters.urgent_end_to_end_visible_ms}`);
    console.log(`simulated_urgent_wait_ms=${counters.f2_worker_urgent_wait_ms}`);
    console.log(`simulated_urgent_main_to_worker_delay_ms=${counters.urgent_main_to_worker_delay_ms}`);
    console.log(`simulated_urgent_worker_queue_wait_ms=${counters.urgent_worker_queue_wait_ms}`);
    console.log(`simulated_urgent_end_to_end_latency_ms=${counters.urgent_end_to_end_latency_ms}`);
    console.log(`simulated_urgent_latency_ms=${counters.f2_worker_urgent_txn_latency_ms}`);
    console.log(`simulated_worker_chunk_count=${counters.f2_worker_chunk_count}`);
    console.log(`simulated_worker_max_chunk_ms=${counters.f2_worker_max_chunk_ms}`);
    console.log(`simulated_worker_yield_count=${counters.f2_worker_yield_count}`);
    console.log(`simulated_worker_preemptions=${counters.f2_worker_preemptions}`);
    console.log(`simulated_module_flush_count=${counters.module_flush_count}`);
    console.log(`simulated_subscriber_notify_count=${counters.subscriber_notify_count}`);
    console.log(`simulated_queue_drain_step_count=${counters.queue_drain_step_count}`);
    console.log(`simulated_derived_selector_eval_count=${counters.derived_selector_eval_count}`);
    console.log(`simulated_state_nodes_touched_observed=${counters.state_nodes_touched_observed}`);
    console.log(`simulated_derived_hash_rounds_observed=${counters.derived_hash_rounds_observed}`);
    console.log(`simulated_projection_update_count_observed=${counters.projection_update_count_observed}`);
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
  console.log(`worker_source_dependency_status=${exposed.worker_source_dependency_status}`);
  console.log(
    `worker_source_dependency_missing=${exposed.worker_source_dependency_missing?.length > 0
      ? exposed.worker_source_dependency_missing.join("|")
      : "none"}`
  );
  console.log(`f2_completion_contract_status=${exposed.f2_completion_contract_status}`);
  console.log(
    `f2_completion_contract_missing=${exposed.f2_completion_contract_missing?.length > 0
      ? exposed.f2_completion_contract_missing.join("|")
      : "none"}`
  );
  console.log(
    `f2_completion_contract_forbidden=${exposed.f2_completion_contract_forbidden?.length > 0
      ? exposed.f2_completion_contract_forbidden.join("|")
      : "none"}`
  );
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
