#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/p0/run_capture.sh \
    --browser /path/to/chrome \
    --target-id controlled-local \
    --target-class controlled \
    --target-url http://127.0.0.1:3000 \
    --target-description "Controlled local target" \
    --build-label dev-build \
    --notes "Session notes" \
    --machine-label mbp-m4-max \
    --machine-class high-end-laptop \
    --network-mode local \
    --operator your-name \
    --scenario bench/p0/scenarios/s01_tail_append.json \
    --warmup-runs 1 \
    --measured-runs 5 \
    --out-dir /tmp/streaming-ui-runtime-p0/20260422T000000Z

Required flags:
  --browser
  --target-id
  --target-class
  --target-url
  --target-description
  --build-label
  --notes
  --machine-label
  --machine-class
  --network-mode
  --operator
  --scenario
  --warmup-runs
  --measured-runs
  --out-dir

Optional flags:
  --remote-debugging-port 9222
  --assume-valid
  --default-anchor-level none|minor|major
  --default-anchor-note "Reusable anchor note"
  --auto-start-after-ms 1500
  --help

machine-class values:
  high-end-desktop | high-end-laptop | mid-tier-laptop | low-end | mobile | other

target-class values:
  controlled | external-exploratory | other
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

port_is_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

parseable_trace() {
  local trace_file="$1"
  TRACE_FILE="$trace_file" node --input-type=module <<'NODE'
import fs from "node:fs";

try {
  const parsed = JSON.parse(fs.readFileSync(process.env.TRACE_FILE, "utf8"));
  const events = Array.isArray(parsed) ? parsed : parsed.traceEvents;
  if (!Array.isArray(events)) {
    process.exit(1);
  }
} catch {
  process.exit(1);
}
NODE
}

scenario_value() {
  local field="$1"
  SCENARIO_PATH="$SCENARIO" SCENARIO_FIELD="$field" node --input-type=module <<'NODE'
import fs from "node:fs";

const scenario = JSON.parse(fs.readFileSync(process.env.SCENARIO_PATH, "utf8"));
const value = scenario[process.env.SCENARIO_FIELD];
if (value === undefined) {
  process.exit(1);
}
if (typeof value === "string") {
  process.stdout.write(value);
} else {
  process.stdout.write(JSON.stringify(value));
}
NODE
}

print_scenario_overview() {
  SCENARIO_PATH="$SCENARIO" node --input-type=module <<'NODE'
import fs from "node:fs";

const scenario = JSON.parse(fs.readFileSync(process.env.SCENARIO_PATH, "utf8"));
console.log(`Scenario: ${scenario.id} - ${scenario.title}`);
console.log("SOP:");
for (const step of scenario.sop) {
  console.log(`- ${step}`);
}
console.log("Notes template:");
for (const item of scenario.notes_template) {
  console.log(`- ${item}`);
}
NODE
}

write_target_manifest() {
  TARGET_MANIFEST_PATH="$TARGET_MANIFEST" \
  TARGET_ID="$TARGET_ID" \
  TARGET_CLASS="$TARGET_CLASS" \
  TARGET_URL="$TARGET_URL" \
  TARGET_DESCRIPTION="$TARGET_DESCRIPTION" \
  GIT_COMMIT="$GIT_COMMIT" \
  BUILD_LABEL="$BUILD_LABEL" \
  SESSION_NOTES="$SESSION_NOTES" \
  node --input-type=module <<'NODE'
import fs from "node:fs";

const path = process.env.TARGET_MANIFEST_PATH;
const nextManifest = {
  target_id: process.env.TARGET_ID,
  target_class: process.env.TARGET_CLASS,
  target_url: process.env.TARGET_URL,
  target_description: process.env.TARGET_DESCRIPTION,
  git_commit: process.env.GIT_COMMIT || null,
  build_label: process.env.BUILD_LABEL,
  notes: process.env.SESSION_NOTES
};

if (fs.existsSync(path)) {
  const current = JSON.parse(fs.readFileSync(path, "utf8"));
  for (const key of Object.keys(nextManifest)) {
    if ((current[key] ?? null) !== (nextManifest[key] ?? null)) {
      console.error(`Target manifest mismatch for ${key}: existing=${JSON.stringify(current[key] ?? null)} new=${JSON.stringify(nextManifest[key] ?? null)}`);
      process.exit(2);
    }
  }
  process.exit(0);
}

fs.writeFileSync(path, `${JSON.stringify(nextManifest, null, 2)}\n`);
NODE
  local status=$?
  if [ "$status" -eq 2 ]; then
    fail "target-manifest.json already exists with conflicting target/build values"
  elif [ "$status" -ne 0 ]; then
    fail "failed to write target-manifest.json"
  fi
}

write_run_metadata() {
  local meta_path="$1"
  local trace_filename="$2"
  local run_kind="$3"
  local run_index="$4"
  local run_slot="$5"
  local attempt_sequence="$6"
  local trace_start_utc="$7"
  local trace_end_utc="$8"
  local anchor_level="$9"
  local anchor_note="${10}"
  local invalidation_status="${11}"
  local invalidation_reason="${12}"

  RUN_META_PATH="$meta_path" \
  TRACE_FILENAME="$trace_filename" \
  SESSION_ID="$SESSION_ID" \
  SCENARIO_ID="$SCENARIO_ID" \
  RUN_KIND="$run_kind" \
  RUN_INDEX="$run_index" \
  RUN_SLOT="$run_slot" \
  ATTEMPT_SEQUENCE="$attempt_sequence" \
  TARGET_ID="$TARGET_ID" \
  TARGET_CLASS="$TARGET_CLASS" \
  TARGET_URL="$TARGET_URL" \
  BROWSER_PATH="$BROWSER" \
  BROWSER_VERSION="$BROWSER_VERSION" \
  MACHINE_LABEL="$MACHINE_LABEL" \
  MACHINE_CLASS="$MACHINE_CLASS" \
  NETWORK_MODE="$NETWORK_MODE" \
  OPERATOR="$OPERATOR" \
  WARMUP_RUNS_TARGET="$WARMUP_RUNS" \
  MEASURED_RUNS_TARGET="$MEASURED_RUNS" \
  WINDOW_SIZE="$WINDOW_SIZE" \
  TRACE_CATEGORIES="$TRACE_CATEGORIES" \
  TRACE_START_UTC="$trace_start_utc" \
  TRACE_END_UTC="$trace_end_utc" \
  CAPTURE_METHOD="cdp-tracing" \
  PHASE_SCHEDULE_JSON="$PHASE_SCHEDULE_JSON" \
  CAPTURE_MS="$CAPTURE_MS" \
  SETTLE_MS="$SETTLE_MS" \
  ANCHOR_LEVEL="$anchor_level" \
  ANCHOR_NOTE="$anchor_note" \
  INVALIDATION_STATUS="$invalidation_status" \
  INVALIDATION_REASON="$invalidation_reason" \
  node --input-type=module <<'NODE'
import fs from "node:fs";

const metadata = {
  session_id: process.env.SESSION_ID,
  scenario_id: process.env.SCENARIO_ID,
  run_kind: process.env.RUN_KIND,
  run_index: Number(process.env.RUN_INDEX),
  run_slot: Number(process.env.RUN_SLOT),
  attempt_sequence: Number(process.env.ATTEMPT_SEQUENCE),
  target_id: process.env.TARGET_ID,
  target_class: process.env.TARGET_CLASS,
  target_url: process.env.TARGET_URL,
  browser_path: process.env.BROWSER_PATH,
  browser_version: process.env.BROWSER_VERSION,
  os: process.platform,
  arch: process.arch,
  window_size: process.env.WINDOW_SIZE,
  trace_categories: process.env.TRACE_CATEGORIES.split(","),
  capture_method: process.env.CAPTURE_METHOD,
  trace_start_utc: process.env.TRACE_START_UTC,
  trace_end_utc: process.env.TRACE_END_UTC,
  operator_notes: {
    anchor_level: process.env.ANCHOR_LEVEL || null,
    anchor_note: process.env.ANCHOR_NOTE || null
  },
  machine_label: process.env.MACHINE_LABEL,
  machine_class: process.env.MACHINE_CLASS,
  network_mode: process.env.NETWORK_MODE,
  operator: process.env.OPERATOR,
  warmup_runs_target: Number(process.env.WARMUP_RUNS_TARGET),
  measured_runs_target: Number(process.env.MEASURED_RUNS_TARGET),
  trace_filename: process.env.TRACE_FILENAME,
  phase_schedule: JSON.parse(process.env.PHASE_SCHEDULE_JSON),
  capture_ms: Number(process.env.CAPTURE_MS),
  settle_ms: Number(process.env.SETTLE_MS),
  invalidation: {
    status: process.env.INVALIDATION_STATUS || "not-applicable",
    reason: process.env.INVALIDATION_REASON || null
  }
};

fs.writeFileSync(process.env.RUN_META_PATH, `${JSON.stringify(metadata, null, 2)}\n`);
NODE
}

append_invalid_log() {
  local status="$1"
  local filename="$2"
  local timestamp_utc="$3"
  local reason="$4"
  printf '%s\t%s\t%s\t%s\n' "$status" "$filename" "$timestamp_utc" "$reason" >>"$INVALID_LOG"
}

next_invalid_index() {
  local slot_label="$1"
  local count
  count=$(find "$RUNS_DIR" -maxdepth 1 -type f -name "measure-${slot_label}.invalid-*.trace.json" | wc -l | tr -d ' ')
  printf '%02d' $((count + 1))
}

cleanup_leftover_chrome() {
  local pids
  pids=$(pgrep -af "$PROFILE_DIR" 2>/dev/null | awk '{print $1}' || true)
  if [ -n "$pids" ]; then
    printf 'Cleaning up leftover test Chrome process(es) for %s\n' "$PROFILE_DIR"
    for pid in $pids; do
      kill "$pid" >/dev/null 2>&1 || true
    done
    sleep 1
    for pid in $pids; do
      kill -9 "$pid" >/dev/null 2>&1 || true
    done
  fi
}

ensure_port_available() {
  local attempt
  for attempt in 1 2 3; do
    if ! port_is_listening "$REMOTE_DEBUGGING_PORT"; then
      return 0
    fi
    printf 'Waiting for debugging port %s to become available (attempt %s/3)\n' "$REMOTE_DEBUGGING_PORT" "$attempt"
    sleep 1
  done
  fail "remote debugging port $REMOTE_DEBUGGING_PORT is already in use"
}

wait_for_cdp() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${REMOTE_DEBUGGING_PORT}/json/version" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "Chrome CDP endpoint did not become ready on port $REMOTE_DEBUGGING_PORT"
}

launch_chrome() {
  local chrome_log="$SCENARIO_DIR/chrome.log"
  "$BROWSER" \
    --user-data-dir="$PROFILE_DIR" \
    --remote-debugging-port="$REMOTE_DEBUGGING_PORT" \
    --new-window \
    --window-size=1440,900 \
    --no-first-run \
    --disable-background-networking \
    --disable-sync \
    --disable-extensions \
    --enable-precise-memory-info \
    --disable-background-timer-throttling \
    "$TARGET_URL" >"$chrome_log" 2>&1 &
  CHROME_PID=$!
  wait_for_cdp
}

stop_chrome() {
  if [ -n "${CHROME_PID:-}" ] && kill -0 "$CHROME_PID" >/dev/null 2>&1; then
    kill "$CHROME_PID" >/dev/null 2>&1 || true
    wait "$CHROME_PID" >/dev/null 2>&1 || true
  fi
}

run_cdp_capture() {
  local run_label="$1"
  local trace_path="$2"

  CDP_PORT="$REMOTE_DEBUGGING_PORT" \
  TARGET_URL="$TARGET_URL" \
  TRACE_PATH="$trace_path" \
  SCENARIO_PATH="$SCENARIO" \
  TRACE_CATEGORIES="$TRACE_CATEGORIES" \
  RUN_LABEL="$run_label" \
  node --input-type=module <<'NODE'
import fs from "node:fs";
import fsp from "node:fs/promises";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
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

async function mark(page, label) {
  const expression = `(() => { performance.mark(${JSON.stringify(label)}); return true; })()`;
  await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: false,
    returnByValue: true
  });
}

const port = Number(process.env.CDP_PORT);
const targetUrl = process.env.TARGET_URL;
const tracePath = process.env.TRACE_PATH;
const scenario = JSON.parse(fs.readFileSync(process.env.SCENARIO_PATH, "utf8"));
const traceCategories = process.env.TRACE_CATEGORIES;
const runLabel = process.env.RUN_LABEL;

const browserInfo = await fetchJson(`http://127.0.0.1:${port}/json/version`);
const pageTarget = await resolvePage(port, targetUrl);

const browser = new CdpConnection(browserInfo.webSocketDebuggerUrl);
const page = new CdpConnection(pageTarget.webSocketDebuggerUrl);

await browser.open();
await page.open();

const traceEvents = [];
browser.onEvent = (method, params) => {
  if (method === "Tracing.dataCollected" && Array.isArray(params.value)) {
    traceEvents.push(...params.value);
  }
};

await page.send("Page.enable");
await page.send("Runtime.enable");
await page.send("Page.bringToFront").catch(() => {});

if (scenario.settle_ms > 0) {
  console.log(`[${runLabel}] Settle phase: ${scenario.settle_ms} ms`);
  await sleep(scenario.settle_ms);
}

const tracingComplete = browser.waitFor("Tracing.tracingComplete");
await browser.send("Tracing.start", {
  categories: traceCategories,
  transferMode: "ReportEvents"
});

await mark(page, "p0:capture:start");

for (const phase of scenario.phases) {
  console.log(`[${runLabel}] Phase ${phase.id}: ${phase.label} (${phase.duration_ms} ms)`);
  await mark(page, `p0:phase:${phase.id}:start`);
  await sleep(Number(phase.duration_ms));
  await mark(page, `p0:phase:${phase.id}:end`);
}

await mark(page, "p0:capture:end");
await browser.send("Tracing.end");
await tracingComplete;
await sleep(250);

if (traceEvents.length === 0) {
  throw new Error("Trace completed but produced zero events");
}

await fsp.writeFile(tracePath, `${JSON.stringify({ traceEvents })}\n`);
page.close();
browser.close();
NODE
}

review_invalidations() {
  [ -f "$INVALID_LOG" ] || return 0

  local pending_count
  pending_count=$(awk -F '\t' '$1 == "pending" { count += 1 } END { print count + 0 }' "$INVALID_LOG")
  [ "$pending_count" -gt 0 ] || return 0

  printf '\nReviewing %s pending invalidation(s) in %s\n' "$pending_count" "$INVALID_LOG"

  local temp_log
  temp_log=$(mktemp)

  while IFS=$'\t' read -r status run_filename timestamp_utc operator_reason; do
    if [ "$status" != "pending" ]; then
      printf '%s\t%s\t%s\t%s\n' "$status" "$run_filename" "$timestamp_utc" "$operator_reason" >>"$temp_log"
      continue
    fi

    local trace_path="$RUNS_DIR/$run_filename"
    printf '\nPending invalidation:\n'
    printf '  file: %s\n' "$run_filename"
    printf '  time: %s\n' "$timestamp_utc"
    printf '  reason: %s\n' "$operator_reason"

    local choice=""
    while :; do
      printf 'Confirm invalidation or revert? [c/r]: '
      read -r choice
      case "$choice" in
        c|C)
          status="confirmed"
          break
          ;;
        r|R)
          if [ ! -f "$trace_path" ]; then
            printf '  Cannot revert: trace file is missing.\n'
            continue
          fi
          if ! parseable_trace "$trace_path"; then
            printf '  Cannot revert: trace file is not parseable.\n'
            continue
          fi
          status="reverted"
          break
          ;;
        *)
          printf '  Enter c to confirm or r to revert.\n'
          ;;
      esac
    done

    printf '%s\t%s\t%s\t%s\n' "$status" "$run_filename" "$timestamp_utc" "$operator_reason" >>"$temp_log"
  done <"$INVALID_LOG"

  mv "$temp_log" "$INVALID_LOG"
}

prompt_anchor_level() {
  local level=""
  while :; do
    printf 'Anchor movement level [none/minor/major]: ' >&2
    read -r level
    case "$level" in
      none|minor|major)
        printf '%s' "$level"
        return 0
        ;;
      *)
        printf 'Enter one of: none, minor, major.\n' >&2
        ;;
    esac
  done
}

prompt_nonempty() {
  local prompt="$1"
  local value=""
  while :; do
    printf '%s' "$prompt" >&2
    read -r value
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return 0
    fi
    printf 'A non-empty value is required.\n' >&2
  done
}

prompt_invalidation_decision() {
  local choice=""
  while :; do
    printf 'Mark this measured attempt invalid? [y/N]: ' >&2
    read -r choice
    case "$choice" in
      ""|n|N)
        printf 'commit'
        return 0
        ;;
      y|Y)
        printf 'invalidate'
        return 0
        ;;
      *)
        printf 'Enter y to invalidate, or press Enter/n to keep it as a valid measured run.\n' >&2
        ;;
    esac
  done
}

wait_for_run_start() {
  local run_label="$1"

  if [ "$AUTO_START_AFTER_MS_SET" = "1" ]; then
    local remaining_ms="$AUTO_START_AFTER_MS"
    local whole_seconds
    local remainder_ms

    printf 'Auto-start mode active for %s. Starting in %s ms.\n' "$run_label" "$AUTO_START_AFTER_MS"

    whole_seconds=$((remaining_ms / 1000))
    remainder_ms=$((remaining_ms % 1000))

    while [ "$whole_seconds" -gt 0 ]; do
      printf '  %s starts in %ss...\n' "$run_label" "$whole_seconds"
      sleep 1
      whole_seconds=$((whole_seconds - 1))
    done

    if [ "$remainder_ms" -gt 0 ]; then
      printf '  %s starts in %sms...\n' "$run_label" "$remainder_ms"
      sleep "0.$(printf '%03d' "$remainder_ms")"
    fi

    printf 'Starting %s now.\n' "$run_label"
    return 0
  fi

  printf 'Press Enter when the target is ready for %s... ' "$run_label"
  read -r _
}

canonical_trace_filename() {
  local slot_number="$1"
  printf 'measure-%02d.trace.json' "$slot_number"
}

canonical_meta_filename() {
  local slot_number="$1"
  printf 'measure-%02d.meta.json' "$slot_number"
}

existing_canonical_trace_path() {
  local slot_number="$1"
  printf '%s/%s' "$RUNS_DIR" "$(canonical_trace_filename "$slot_number")"
}

existing_canonical_meta_path() {
  local slot_number="$1"
  printf '%s/%s' "$RUNS_DIR" "$(canonical_meta_filename "$slot_number")"
}

commit_valid_measured_run() {
  local slot_number="$1"
  local candidate_trace="$2"
  local attempt_sequence="$3"
  local trace_start_utc="$4"
  local trace_end_utc="$5"
  local anchor_level="$6"
  local anchor_note="$7"

  local committed_trace_path
  local committed_meta_path
  local committed_trace_name

  committed_trace_path=$(existing_canonical_trace_path "$slot_number")
  committed_meta_path=$(existing_canonical_meta_path "$slot_number")
  committed_trace_name=$(canonical_trace_filename "$slot_number")

  mv "$candidate_trace" "$committed_trace_path"
  write_run_metadata \
    "$committed_meta_path" \
    "$committed_trace_name" \
    "measured" \
    "$slot_number" \
    "$slot_number" \
    "$attempt_sequence" \
    "$trace_start_utc" \
    "$trace_end_utc" \
    "$anchor_level" \
    "$anchor_note" \
    "included" \
    ""
}

slot_has_committed_valid_run() {
  local slot_number="$1"
  [ -f "$(existing_canonical_trace_path "$slot_number")" ] && [ -f "$(existing_canonical_meta_path "$slot_number")" ]
}

count_committed_valid_runs() {
  local count=0
  local slot_number=1
  while [ "$slot_number" -le "$MEASURED_RUNS" ]; do
    if slot_has_committed_valid_run "$slot_number"; then
      count=$((count + 1))
    fi
    slot_number=$((slot_number + 1))
  done
  printf '%s' "$count"
}

BROWSER=""
TARGET_ID=""
TARGET_CLASS=""
TARGET_URL=""
TARGET_DESCRIPTION=""
BUILD_LABEL=""
SESSION_NOTES=""
MACHINE_LABEL=""
MACHINE_CLASS=""
NETWORK_MODE=""
OPERATOR=""
SCENARIO=""
WARMUP_RUNS=""
MEASURED_RUNS=""
OUT_DIR=""
REMOTE_DEBUGGING_PORT="9222"
ASSUME_VALID="0"
DEFAULT_ANCHOR_LEVEL=""
DEFAULT_ANCHOR_LEVEL_SET="0"
DEFAULT_ANCHOR_NOTE=""
DEFAULT_ANCHOR_NOTE_SET="0"
AUTO_START_AFTER_MS="0"
AUTO_START_AFTER_MS_SET="0"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --browser)
      BROWSER="$2"
      shift 2
      ;;
    --target-id)
      TARGET_ID="$2"
      shift 2
      ;;
    --target-class)
      TARGET_CLASS="$2"
      shift 2
      ;;
    --target-url)
      TARGET_URL="$2"
      shift 2
      ;;
    --target-description)
      TARGET_DESCRIPTION="$2"
      shift 2
      ;;
    --build-label)
      BUILD_LABEL="$2"
      shift 2
      ;;
    --notes)
      SESSION_NOTES="$2"
      shift 2
      ;;
    --machine-label)
      MACHINE_LABEL="$2"
      shift 2
      ;;
    --machine-class)
      MACHINE_CLASS="$2"
      shift 2
      ;;
    --network-mode)
      NETWORK_MODE="$2"
      shift 2
      ;;
    --operator)
      OPERATOR="$2"
      shift 2
      ;;
    --scenario)
      SCENARIO="$2"
      shift 2
      ;;
    --warmup-runs)
      WARMUP_RUNS="$2"
      shift 2
      ;;
    --measured-runs)
      MEASURED_RUNS="$2"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    --remote-debugging-port)
      REMOTE_DEBUGGING_PORT="$2"
      shift 2
      ;;
    --assume-valid)
      ASSUME_VALID="1"
      shift 1
      ;;
    --default-anchor-level)
      DEFAULT_ANCHOR_LEVEL="$2"
      DEFAULT_ANCHOR_LEVEL_SET="1"
      shift 2
      ;;
    --default-anchor-note)
      DEFAULT_ANCHOR_NOTE="$2"
      DEFAULT_ANCHOR_NOTE_SET="1"
      shift 2
      ;;
    --auto-start-after-ms)
      AUTO_START_AFTER_MS="$2"
      AUTO_START_AFTER_MS_SET="1"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

[ -n "$BROWSER" ] || fail "--browser is required"
[ -n "$TARGET_ID" ] || fail "--target-id is required"
[ -n "$TARGET_CLASS" ] || fail "--target-class is required"
[ -n "$TARGET_URL" ] || fail "--target-url is required"
[ -n "$TARGET_DESCRIPTION" ] || fail "--target-description is required"
[ -n "$BUILD_LABEL" ] || fail "--build-label is required"
[ -n "$SESSION_NOTES" ] || fail "--notes is required"
[ -n "$MACHINE_LABEL" ] || fail "--machine-label is required"
[ -n "$MACHINE_CLASS" ] || fail "--machine-class is required"
[ -n "$NETWORK_MODE" ] || fail "--network-mode is required"
[ -n "$OPERATOR" ] || fail "--operator is required"
[ -n "$SCENARIO" ] || fail "--scenario is required"
[ -n "$WARMUP_RUNS" ] || fail "--warmup-runs is required"
[ -n "$MEASURED_RUNS" ] || fail "--measured-runs is required"
[ -n "$OUT_DIR" ] || fail "--out-dir is required"
[ -x "$BROWSER" ] || fail "browser binary is not executable: $BROWSER"
[ -f "$SCENARIO" ] || fail "scenario file not found: $SCENARIO"
[ "$WARMUP_RUNS" = "1" ] || fail "this scaffold requires --warmup-runs 1"

case "$MEASURED_RUNS" in
  ''|*[!0-9]*)
    fail "--measured-runs must be a positive integer"
    ;;
  *)
    if [ "$MEASURED_RUNS" -lt 1 ]; then
      fail "--measured-runs must be at least 1"
    fi
    ;;
esac

case "$MACHINE_CLASS" in
  high-end-desktop|high-end-laptop|mid-tier-laptop|low-end|mobile|other)
    ;;
  *)
    fail "invalid --machine-class: $MACHINE_CLASS"
    ;;
esac

case "$TARGET_CLASS" in
  controlled|external-exploratory|other)
    ;;
  *)
    fail "invalid --target-class: $TARGET_CLASS"
    ;;
esac

case "$ASSUME_VALID" in
  0|1)
    ;;
  *)
    fail "invalid --assume-valid state"
    ;;
esac

if [ "$DEFAULT_ANCHOR_LEVEL_SET" = "1" ]; then
  case "$DEFAULT_ANCHOR_LEVEL" in
    none|minor|major)
      ;;
    *)
      fail "invalid --default-anchor-level: $DEFAULT_ANCHOR_LEVEL"
      ;;
  esac
fi

if [ "$DEFAULT_ANCHOR_NOTE_SET" = "1" ] && [ -z "$DEFAULT_ANCHOR_NOTE" ]; then
  fail "--default-anchor-note requires a non-empty value"
fi

if [ "$AUTO_START_AFTER_MS_SET" = "1" ]; then
  case "$AUTO_START_AFTER_MS" in
    ''|*[!0-9]*)
      fail "--auto-start-after-ms must be a non-negative integer"
      ;;
    *)
      ;;
  esac
fi

mkdir -p "$OUT_DIR"

SCENARIO_ID=$(scenario_value id)
SETTLE_MS=$(scenario_value settle_ms)
CAPTURE_MS=$(scenario_value capture_ms)
PHASE_SCHEDULE_JSON=$(scenario_value phases)

SESSION_ID=$(basename "$OUT_DIR")
SCENARIO_DIR="$OUT_DIR/$SCENARIO_ID"
RUNS_DIR="$SCENARIO_DIR/runs"
PROFILE_DIR="$SCENARIO_DIR/chrome-profile"
INVALID_LOG="$SCENARIO_DIR/invalid-runs.log"
TARGET_MANIFEST="$OUT_DIR/target-manifest.json"
TRACE_CATEGORIES="blink.user_timing,devtools.timeline,disabled-by-default-devtools.timeline,toplevel,loading,latencyInfo,cc,v8.execute"
WINDOW_SIZE="1440x900"
BROWSER_VERSION=$("$BROWSER" --version | tr -d '\r')
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || true)

mkdir -p "$RUNS_DIR"
touch "$INVALID_LOG"

write_target_manifest

cleanup_leftover_chrome
rm -rf "$PROFILE_DIR"
mkdir -p "$PROFILE_DIR"
ensure_port_available

if [ -d "$OUT_DIR" ]; then
  sleep 1
fi

CHROME_PID=""
trap 'stop_chrome' EXIT
launch_chrome

printf 'Session output: %s\n' "$OUT_DIR"
printf 'Scenario output: %s\n' "$SCENARIO_DIR"
printf 'Target URL: %s\n' "$TARGET_URL"
printf 'Assume-valid mode: %s\n' "$([ "$ASSUME_VALID" = "1" ] && printf 'enabled' || printf 'disabled')"
if [ "$AUTO_START_AFTER_MS_SET" = "1" ]; then
  printf 'Auto-start mode: enabled (%s ms)\n' "$AUTO_START_AFTER_MS"
else
  printf 'Auto-start mode: disabled\n'
fi
if [ "$DEFAULT_ANCHOR_LEVEL_SET" = "1" ]; then
  printf 'Default anchor level: %s\n' "$DEFAULT_ANCHOR_LEVEL"
else
  printf 'Default anchor level: interactive\n'
fi
printf 'Default anchor note mode: %s\n' "$([ "$DEFAULT_ANCHOR_NOTE_SET" = "1" ] && printf 'active' || printf 'inactive')"
print_scenario_overview
if [ "$MEASURED_RUNS" -ne 5 ]; then
  printf 'Dry-run note: measured target is %s, but final gate use still requires 5 valid measured runs.\n' "$MEASURED_RUNS"
fi

TRACE_START_UTC=""
TRACE_END_UTC=""

printf '\nWarmup run:\n'
wait_for_run_start "warmup-01"
WARMUP_TRACE="$RUNS_DIR/warmup-01.trace.json"
TRACE_START_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
run_cdp_capture "warmup-01" "$WARMUP_TRACE"
TRACE_END_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
parseable_trace "$WARMUP_TRACE" || fail "warmup trace is not parseable: $WARMUP_TRACE"
write_run_metadata \
  "$RUNS_DIR/warmup-01.meta.json" \
  "warmup-01.trace.json" \
  "warmup" \
  "1" \
  "0" \
  "1" \
  "$TRACE_START_UTC" \
  "$TRACE_END_UTC" \
  "" \
  "" \
  "not-applicable" \
  ""

valid_measured=$(count_committed_valid_runs)
attempt_sequence=1

while [ "$valid_measured" -lt "$MEASURED_RUNS" ]; do
  slot_number=$((valid_measured + 1))
  slot_label=$(printf '%02d' "$slot_number")
  run_label="measure-${slot_label}"
  candidate_trace="$RUNS_DIR/${run_label}.candidate.trace.json"
  candidate_meta="$RUNS_DIR/${run_label}.candidate.meta.json"

  printf '\nMeasured slot %s of %s:\n' "$slot_number" "$MEASURED_RUNS"
  wait_for_run_start "$run_label"

  TRACE_START_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  run_cdp_capture "$run_label" "$candidate_trace"
  TRACE_END_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  if ! parseable_trace "$candidate_trace"; then
    invalid_index=$(next_invalid_index "$slot_label")
    invalid_base="${run_label}.invalid-${invalid_index}"
    invalid_trace="$RUNS_DIR/${invalid_base}.trace.json"
    invalid_meta="$RUNS_DIR/${invalid_base}.meta.json"
    mv "$candidate_trace" "$invalid_trace"
    write_run_metadata \
      "$invalid_meta" \
      "${invalid_base}.trace.json" \
      "measured" \
      "$slot_number" \
      "$slot_number" \
      "$attempt_sequence" \
      "$TRACE_START_UTC" \
      "$TRACE_END_UTC" \
      "" \
      "" \
      "pending" \
      "automatic: trace file missing or not parseable"
    append_invalid_log "pending" "${invalid_base}.trace.json" "$TRACE_END_UTC" "automatic: trace file missing or not parseable"
    attempt_sequence=$((attempt_sequence + 1))
    continue
  fi

  printf '\nMeasured attempt %s captured successfully and produced a parseable trace.\n' "$run_label"
  if [ "$ASSUME_VALID" = "1" ]; then
    invalidate_choice="commit"
    printf 'Assume-valid mode active: skipping the manual invalidation prompt for %s.\n' "$run_label"
  else
    invalidate_choice=$(prompt_invalidation_decision)
  fi

  if [ "$invalidate_choice" = "invalidate" ]; then
    invalid_reason=$(prompt_nonempty "Operator reason for invalidation: ")
    invalid_index=$(next_invalid_index "$slot_label")
    invalid_base="${run_label}.invalid-${invalid_index}"
    invalid_trace="$RUNS_DIR/${invalid_base}.trace.json"
    invalid_meta="$RUNS_DIR/${invalid_base}.meta.json"
    mv "$candidate_trace" "$invalid_trace"
    write_run_metadata \
      "$invalid_meta" \
      "${invalid_base}.trace.json" \
      "measured" \
      "$slot_number" \
      "$slot_number" \
      "$attempt_sequence" \
      "$TRACE_START_UTC" \
      "$TRACE_END_UTC" \
      "" \
      "" \
      "pending" \
      "$invalid_reason"
    append_invalid_log "pending" "${invalid_base}.trace.json" "$TRACE_END_UTC" "$invalid_reason"
    attempt_sequence=$((attempt_sequence + 1))
    continue
  fi

  if [ "$DEFAULT_ANCHOR_LEVEL_SET" = "1" ] || [ "$DEFAULT_ANCHOR_NOTE_SET" = "1" ]; then
    printf 'Applying configured measured-run defaults before committing %s as a valid measured run.\n' "$run_label"
  else
    printf 'Recording required notes before committing %s as a valid measured run.\n' "$run_label"
  fi

  if [ "$DEFAULT_ANCHOR_LEVEL_SET" = "1" ]; then
    anchor_level="$DEFAULT_ANCHOR_LEVEL"
  else
    anchor_level=$(prompt_anchor_level)
  fi

  if [ "$DEFAULT_ANCHOR_NOTE_SET" = "1" ]; then
    anchor_note="$DEFAULT_ANCHOR_NOTE"
  else
    anchor_note=$(prompt_nonempty "One-sentence anchor note: ")
  fi

  commit_valid_measured_run \
    "$slot_number" \
    "$candidate_trace" \
    "$attempt_sequence" \
    "$TRACE_START_UTC" \
    "$TRACE_END_UTC" \
    "$anchor_level" \
    "$anchor_note"

  valid_measured=$(count_committed_valid_runs)
  printf 'Committed valid measured run %s (%s of %s committed).\n' "$run_label" "$valid_measured" "$MEASURED_RUNS"
  attempt_sequence=$((attempt_sequence + 1))
done

review_invalidations

printf '\nScenario %s complete.\n' "$SCENARIO_ID"
printf 'Run artifacts: %s\n' "$RUNS_DIR"
printf 'Invalidation log: %s\n' "$INVALID_LOG"
