# P0-C1 Negative Result Diagnosis

## Scope

This note explains why the existing controlled session stayed negative without changing the workload, browser, or phase scope.

Evidence base:

- session: `/tmp/streaming-ui-runtime-p0/controlled-local-20260422T191230Z`
- target: `controlled-append-surface`
- result: `valid_measured_runs = 5` for `s01`, `s02`, and `s03`
- gate: `eligible = true`, `thesis_signal_count = 0`, `recommendation = stay-in-p0`

## 1. How strong is the current controlled target workload?

The current controlled target is disciplined and non-idle, but still modest.

- It seeds `1200` rows on load.
- It appends one new row every `80 ms`, or about `12.5` appends per second.
- A `20 s` capture window therefore covers about `250` append opportunities, so the surface ends near `1450` rows by run end.
- Each row is shallow and uniform: one row container plus three text spans.
- The page is plain DOM with top-level window scrolling, no framework runtime, no nested scroller, no images, no rich cards, and no remote inputs.

That means the target is good as a stable baseline, but it is not yet a strong stressor for the thesis. It creates steady append and scroll activity, not adversarial viewport pressure.

## 2. Is the main thread actually under enough pressure?

The main thread is under measurable pressure, but only the tail-follow path looks moderately heavy.

Session medians from the existing controlled run:

| Scenario | `run_task_p95_ms` | `run_task_max_ms` | `run_task_busy_pct` | `long_task_count_50ms` | `layout_event_count` | `paint_event_count` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `s01_tail_append` | `29.865` | `81.001` | `33.780` | `1` | `750` | `0` |
| `s02_append_scrollback` | `15.854` | `38.216` | `17.427` | `0` | `750` | `0` |
| `s03_scroll_jump_resume` | `15.005` | `37.324` | `16.358` | `0` | `758` | `22` |

Interpretation:

- `s01` is not idle. A median busy fraction of `33.780%` and a median p95 of `29.865 ms` show real main-thread work while tail-following.
- `s02` and `s03` are much lighter. Their median p95 values are around `15-16 ms`, their median max values stay below `40 ms`, and their median long-task counts are `0`.
- The median layout counts are steady rather than explosive. `750` layout events across `20 s` is about `37.5` layout events per second, which is active but controlled.

So the answer is not "the browser did nothing." The answer is "the controlled target produced moderate steady work, but not enough pressure in the thesis-relevant paths."

## 3. What do the current trace-derived metrics imply about why thesis signals did not light up?

### `append_under_scrollback_proxy` stayed negative because `s02` is cheaper than `s01`

The current summary shows:

- `busy_pct_ratio_vs_tail = 0.516`
- `long_task_delta_vs_tail = -1`
- `layout_paint_rate_ratio_vs_tail = 1`

That is the opposite of the intended thesis signal. In this target, being off-tail does not make append work worse than staying at tail. It is actually lighter on the main thread than tail-following.

The most plausible reason is the target shape itself:

- off-tail mode continues appending, but it does not force snap-back
- tail-follow mode performs repeated bottom-follow behavior
- the page structure is shallow and uniform, so off-tail append does not trigger additional expensive viewport bookkeeping

For this baseline, the trace evidence says "steady append while scrolled back is not yet the expensive path."

### `scroll_jank_proxy` stayed negative because manual scrolling is only borderline busy

The original summary printed zeros for the `s03` manual-scroll proxy because the summarizer was not deriving phase offsets from the stored phase durations. That was an extraction blind spot, not evidence that the scroll phase did no work.

After the minimal summarizer fix, the same session artifacts report:

- `scroll_jank_proxy.run_task_p95_ms = 16.207`
- `scroll_jank_proxy.long_task_count_50ms = 0`
- `scroll_jank_proxy.layout_paint_events_per_s = 41.5`

This is still a negative signal under the current gate:

- the p95 is below the positivity threshold of `> 16.7 ms`
- there are no `>= 50 ms` long tasks

So manual scrolling does create visible renderer work, but it is only borderline and does not cross the gate.

### `anchor_instability_notes` stayed negative because no instability was recorded

For both `s02` and `s03`:

- `none_count = 5`
- `minor_count = 0`
- `major_count = 0`

The recorded operator outcome is therefore "no unintended anchor movement observed." The repeated default note text reduces diagnostic richness, but it does not change the recorded signal outcome: the session did not produce anchor instability.

## Bottom Line

The negative result is explainable without invoking renderer conclusions yet.

- The controlled target is a valid baseline, but it is still a gentle workload.
- The main thread is active, especially in `s01`, but the thesis-relevant paths do not become materially worse.
- `s02` is lighter than `s01`, so append-under-scrollback does not support the thesis on this target.
- `s03` manual scrolling is near the threshold, but still below it and free of long tasks.
- No anchor instability was recorded.

This means the current controlled target succeeded as a clean baseline and failed as a thesis-revealing stressor. That is a workload-strength diagnosis, not evidence for moving to `P1`.
