# P0 Measurement Spec

## Purpose

P0 exists to establish a reproducible capture protocol for append-heavy, viewport-centric, long-lived AI surfaces before any renderer or runtime work begins. This scaffold is limited to:

- scenario definitions
- one visible-Chrome capture wrapper
- one trace summarizer
- minimal `/tmp`-only session artifacts

It does not introduce renderer code, UI work, architecture work, or package-manager dependencies.

## Scope Boundaries

- Phase scope is `P0: profiling + measurement harness + pivot gate`.
- The six tracked repo files are:
  - `docs/p0/measurement-spec.md`
  - `bench/p0/scenarios/s01_tail_append.json`
  - `bench/p0/scenarios/s02_append_scrollback.json`
  - `bench/p0/scenarios/s03_scroll_jump_resume.json`
  - `scripts/p0/run_capture.sh`
  - `scripts/p0/summarize_trace.mjs`
- All traces, manifests, logs, and run metadata live under `/tmp/streaming-ui-runtime-p0/...`.
- Scenario JSON schema does not change to support invalidation review. `invalid-runs.log` is `/tmp`-only.


## Attribution Boundary

P0 now operates with two distinct evidence tracks:

### A. Private Product Trace Attribution

This track is used to attribute cost inside real product traces collected from external AI interfaces.  
Its purpose is to identify the current product's dominant cost families, such as:

- app-side async flush / microtask chains
- framework commit traversal
- telemetry / replay / queue overhead
- rendering / layout / paint costs

These traces are useful for mechanism narrowing, but they **must not** be treated as direct proof of a generic DOM / VDOM architectural bottleneck.

### B. Controlled Baseline Proof

This track uses repo-owned scenarios and the controlled capture harness to evaluate architecture-level claims under reproducible conditions.

Only controlled baseline evidence may be used to support broader claims such as:

- DOM / VDOM mismatch under append-heavy long-lived workloads
- persistent input-latency degradation under strong baselines
- the existence of an impossible zone for conventional document-oriented rendering stacks

### Policy

A private product trace may justify:

- staying in P0
- tightening attribution language
- adding or revising controlled scenarios
- changing the pivot decision

But it may **not** by itself justify a generalized claim that DOM / layout is the primary bottleneck.


## Environment Controls

Runs are comparable only when these conditions are held constant within a scenario:

- AC power required.
- Low Power Mode off.
- No extra Chrome windows or tabs inside the isolated profile.
- Target window size fixed to `1440x900`.
- Target/build fixed for the entire session.
- Same operator, machine label, machine class, and network mode for the entire session.
- The Chrome instance used for capture is foreground-active.
- `--disable-background-timer-throttling` is always enabled. P0 numbers therefore represent foreground-active behavior only and must not be compared directly to background-tab or inactive scenarios.

## Session Output Layout

```text
/tmp/streaming-ui-runtime-p0/<session_id>/
  target-manifest.json
  <scenario_id>/
    chrome-profile/
    chrome.log
    invalid-runs.log
    runs/
      warmup-01.trace.json
      warmup-01.meta.json
      measure-01.trace.json
      measure-01.meta.json
      measure-01.invalid-01.trace.json
      measure-01.invalid-01.meta.json
      ...
```

The canonical measured outputs remain `measure-01` through `measure-05`. Invalidated attempts for the same slot are preserved as `.invalid-XX` siblings in `/tmp`.

## Target Manifest

Each session directory must contain `target-manifest.json` with:

- `target_id`
- `target_class`
- `target_url`
- `target_description`
- `git_commit` if available
- `build_label`
- `notes`

`target_class` is expected to be one of:

- `controlled`
- `external-exploratory`
- `other`

Only `controlled` targets are gate-eligible or paper-eligible. `external-exploratory` traces may inform scenario design but cannot be the sole evidence for the thesis.

## Required Run Metadata

Each run metadata JSON must record:

- `session_id`
- `scenario_id`
- `run_kind`
- `run_index`
- `target_id`
- `target_class`
- `target_url`
- `browser_path`
- `browser_version`
- `os`
- `arch`
- `window_size`
- `trace_categories`
- `capture_method`
- `trace_start_utc`
- `trace_end_utc`
- `operator_notes`
- `machine_label`
- `machine_class`
- `network_mode`
- `operator`

`machine_class` is required and must be one of:

- `high-end-desktop`
- `high-end-laptop`
- `mid-tier-laptop`
- `low-end`
- `mobile`
- `other`

The current operator must pass `machine_class` explicitly to `run_capture.sh`. It is not hardcoded in the scaffold.

## Chrome Launch and Trace Capture

Visible Chrome is launched with an isolated profile and these required flags:

- `--user-data-dir=<scenario profile dir>`
- `--remote-debugging-port=9222` unless explicitly overridden
- `--new-window`
- `--window-size=1440,900`
- `--no-first-run`
- `--disable-background-networking`
- `--disable-sync`
- `--disable-extensions`
- `--enable-precise-memory-info`
- `--disable-background-timer-throttling`

Chrome preflight and cleanup rules:

- ensure no leftover test Chrome instance from the previous run uses the scenario profile
- ensure the isolated profile directory is clean before the scenario begins
- ensure the debugging port is free before launch
- apply a short inter-scenario cooldown only when process teardown or port release has not completed yet

Trace capture mechanism:

- capture is driven through CDP `Tracing.start` and `Tracing.end`
- DevTools UI is not required
- CDP is required
- trace output is written as JSON with a `traceEvents` array

Trace categories are fixed for all P0 runs:

- `blink.user_timing`
- `devtools.timeline`
- `disabled-by-default-devtools.timeline`
- `toplevel`
- `loading`
- `latencyInfo`
- `cc`
- `v8.execute`

`v8.execute` is collected for future inspection only. No V8 attribution logic is part of this scaffold, and the summarizer schema does not change to expose any V8-specific output.

## Scenario SOP

Each scenario JSON provides:

- `id`
- `title`
- `viewport`
- `settle_ms`
- `capture_ms`
- `phases[]`
- `sop[]`
- `notes_template[]`

Operator protocol:

- read the scenario SOP before the warmup run
- restore the target to the scenario pre-state before each run
- press Enter to begin the run only when the target is ready
- remain inside the scenario instructions only; no ad-lib interactions
- keep the capture window foreground-active
- after each measured run, record anchor movement using `none|minor|major` plus one short sentence

Repetition policy:

- `1` warmup run per scenario
- measured capture continues until there are `5` valid measured runs available for final scenario aggregation
- partial dry-run summaries with fewer than `5` valid measured runs are allowed for verification, but they are not gate-eligible
- when a dry validation intentionally uses a smaller measured-run target, the summarizer reports that smaller target in `measured_runs`, but the final protocol requirement remains `5`

## Invalid-Run Handling

A run is invalid if any of the following occurs:

- Chrome preflight fails
- the trace file is missing
- the trace file is not parseable JSON with trace events
- CDP tracing fails to start or stop cleanly
- the operator aborts the run or materially breaks the scenario SOP
- the target/build changes during the scenario

Rules:

- invalid measured attempts do not count toward the `5` measured runs used for final scenario aggregation
- each invalidated measured attempt is written to `invalid-runs.log`
- `invalid-runs.log` lives only in the `/tmp` scenario directory

`invalid-runs.log` format is one tab-separated line per invalidated run:

```text
<status>    <run_filename>    <timestamp_utc>    <operator_reason>
```

`status` is one of:

- `pending`
- `confirmed`
- `reverted`

Review protocol:

- at scenario end, the operator re-reads `invalid-runs.log` in one pass
- each pending invalidation is either confirmed or reverted
- a reverted invalidation is reincluded only if its trace file is still present and parseable
- the summarizer excludes only `confirmed` invalidations

If more than the measured-run target remain after reverts, the summarizer still bases the scenario result on the first valid traces up to that target and records the overflow in `notes`. Final gate use still requires `5` valid measured runs.

## Metric Definitions

### Event Selection

Per-run `RunTask` metrics use:

- main-thread `RunTask` events from `CrRendererMain`
- duration threshold `>= 1 ms`

If no qualifying `RunTask` events are present in a run, the per-run `RunTask` metrics resolve to `0`.

### Capture Window

The capture window is the traced scenario capture interval only. Settle time is not part of the traced metric window.

### `run_task_p95_ms`

For one run:

- collect all qualifying main-thread `RunTask` durations in milliseconds
- sort ascending
- compute the per-run 95th percentile using linear interpolation at rank `0.95 * (N - 1)`

For one scenario:

- compute the per-run `run_task_p95_ms` for each valid measured run
- report the median of those five per-run p95 values

This is intentionally the **median of per-run p95s**, not a single global p95 over pooled events. The aggregation is deliberate for protocol stability with small `N`.

### `run_task_max_ms`

For one run:

- take the maximum qualifying main-thread `RunTask` duration in milliseconds

For one scenario:

- report the median of the five per-run maxima

This uses the same within-run, then median-across-runs pattern as `run_task_p95_ms`.

### `run_task_busy_pct`

For one run:

- sum all qualifying main-thread `RunTask` durations in milliseconds
- divide by capture-window milliseconds
- multiply by `100`

For one scenario:

- report the median of the five per-run busy percentages

This also uses the same within-run, then median-across-runs pattern.

### Additional Aggregated Metrics

All remaining scenario-level numeric metrics use the same rule unless stated otherwise:

- compute per-run values first
- report the median across the valid measured runs included in the summary

These include:

- `long_task_count_50ms`
- `layout_event_count`
- `paint_event_count`

### Proxy Signals

`scroll_jank_proxy`:

- computed from the `manual_scroll` phase in `s03`
- reports median phase-local `run_task_p95_ms`
- reports median phase-local `long_task_count_50ms`
- reports median phase-local `layout_paint_events_per_s`
- positive if median phase-local `run_task_p95_ms > 16.7` or median phase-local `long_task_count_50ms >= 1`

`append_under_scrollback_proxy`:

- compares `s02` against `s01` on the same target
- reports `busy_pct_ratio_vs_tail`
- reports `long_task_delta_vs_tail`
- reports `layout_paint_rate_ratio_vs_tail`
- positive if `busy_pct_ratio_vs_tail >= 1.5` or `layout_paint_rate_ratio_vs_tail >= 1.5`

`anchor_instability_notes`:

- derived from standardized anchor notes in measured runs
- summarized separately as counts of `none|minor|major` and raw note strings
- positive if unintended anchor movement appears in at least `2` of the `5` valid measured runs

## Summarizer Output Schema

Per-scenario output keys are fixed:

- `session_id`
- `scenario_id`
- `target_id`
- `target_class`
- `warmup_runs`
- `measured_runs`
- `valid_measured_runs`
- `metrics`
- `proxy_signals`
- `anchor_notes_summary`
- `gate_eval`
- `notes`

`valid_measured_runs` reports the number of measured traces actually included in the current summary. Final gate use requires `valid_measured_runs == 5`.

## Provisional Pivot Gate

The P0 gate is intentionally provisional:

- gate evaluation is meaningful only for `controlled` targets
- gate evaluation requires `5` valid measured runs in each relevant scenario
- advance only to `P1` baselines if at least `2` of the `3` thesis signals are positive:
  - `scroll_jank_proxy`
  - `append_under_scrollback_proxy`
  - `anchor_instability_notes`
- otherwise remain in `P0`

This scaffold does not justify renderer work by itself.

## Future Extensions, Intentionally Deferred From This Scaffold

These are deferred extensions, not defects in the current six-file scaffold:

- long-capture variant (`5-10 min`) — deferred
- power/energy measurement — deferred
- INP and dropped-frame metrics — deferred
- low-end device runs — deferred
- cross-machine variance studies — deferred
- full V8 CPU profiler attribution — deferred
