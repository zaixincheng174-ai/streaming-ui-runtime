# P1-A B0/B1 Streaming Bring-Up Result

Date: 2026-04-24  
Project: Streaming UI Runtime for Long-Lived AI Surfaces  
Stage: P1-A true streaming workload bring-up

## 0. Executive Summary

P1-A B0/B1 bring-up is now valid.

The true AI streaming workload successfully differentiates:

- **B0 naive DOM chat**
- **B1 optimized DOM chat**

The key result is:

> B0 naive DOM completes the workload but shows stream stretch, long-task pressure, and high busy time. B1 optimized DOM preserves the same active streaming markdown/syntax-highlight workload while substantially reducing task cost, eliminating long tasks, and maintaining tail stability.

This means:

> P1-A workload is valid and differentiating, but the current workload is not enough to justify P2 runtime work because optimized DOM absorbs it well.

The next phase should be:

> P1-B adversarial streaming stress ladder, focused on finding the boundary of optimized DOM.

---

## 1. Scope

This document records the P1-A B0/B1 bring-up result.

P1-A tests a true AI streaming workload with:

- 160 pre-mounted history messages
- 800 streamed tokens
- 20ms token cadence
- deterministic mixed content
- local markdown parsing
- deterministic syntax highlighting
- active input box present
- tail-follow scenario
- scrollback-resume scenario
- visible Chrome capture
- existing P0 capture substrate

This is not P2 runtime work.

This is not the full P1 gate because B2 virtualization and B3 CodeMirror/Monaco-style baselines remain required later.

---

## 2. B1 Sanity Check

Before interpreting B1 optimized DOM results, a sanity check was performed to verify that B1 did not weaken the workload.

### Source evidence

`bench/p1/targets/p1_streaming_chat_baseline.html` contains:

- `parseMarkdown(source)`
- fenced code parsing
- heading parsing
- inline code handling
- bullet/list parsing
- `appendHighlightedCode(parent, language, code)`
- `renderMarkdownInto(...)`
- semantic structures such as `h1/h2/h3`, `p`, `ul/li`, `pre/code`, `.inline-code`
- deterministic highlight classes such as keyword/string/number/key classes

### B0 path

`naive-dom` uses a full-history render path.

For each streamed token, it rebuilds the rendered message DOM from history plus the active assistant message. Each message goes through markdown parsing and supported syntax highlighting.

### B1 path

`optimized-dom` mounts stable history once and caches stable DOM entries.

For the active streamed assistant message, B1 still calls:

> `renderMarkdownInto(activeOptimizedEntry.content, activeMessage.source)`

on each streamed token.

Therefore B1 still performs active streaming markdown parsing and syntax highlighting. It does not pre-render the final 800-token output and does not reduce content, history length, token count, or message types.

### Sanity conclusion

B1 is a valid optimized DOM comparison.

Correct interpretation:

> Same visible/logical workload, different conventional update strategy.

Do not claim:

> B0 and B1 perform the same amount of internal parsing work.

The difference is intentional: B1 tests whether conventional stable-history caching and active-message-only updating can absorb the streaming workload.

---

## 3. Tail-Follow Results

Scenario:

`p1a_stream_tail_follow_20ms`

Workload:

- `history_messages = 160`
- `stream_tokens = 800`
- `token_interval_ms = 20`
- `content_mix = standard`
- `scenario_mode = tail-follow`

### Summary table

| Baseline | Valid runs | p95 ms | max ms | busy % | long tasks >50ms | layout events | paint events |
|---|---:|---:|---:|---:|---:|---:|---:|
| B0 naive DOM | 5 | 10.912 | 63.825 | 21.687 | 1 | 900 | 1682 |
| B1 optimized DOM | 5 | 3.950 | 5.656 | 8.868 | 0 | 926 | 1730 |

### Analyzer table

| Baseline | Analyzer failed | measured valid | median stream window ms | max stream task ms | stream long tasks >50ms | max tail miss count |
|---|---:|---:|---:|---:|---:|---:|
| B0 naive DOM | false | 5/5 | 24948.360 | 83.149 | 145 | 0 |
| B1 optimized DOM | false | 5/5 | 19081.870 | 5.853 | 0 | 0 |

### Tail-follow interpretation

B0 naive DOM completes the 800-token stream but shows:

- long-task pressure
- stream stretch
- higher busy percentage
- large max stream task

B1 optimized DOM completes the same workload with:

- low max task time
- no long tasks
- stable tail-follow
- no tail misses

Safe conclusion:

> P1-A tail-follow differentiates B0 and B1 clearly. B1 absorbs the current tail-follow streaming workload.

---

## 4. Scrollback-Resume Results

Scenario:

`p1a_stream_scrollback_resume_20ms`

Workload:

- `history_messages = 160`
- `stream_tokens = 800`
- `token_interval_ms = 20`
- `content_mix = standard`
- `scenario_mode = scrollback-resume`

### Summary table

| Baseline | Valid runs | p95 ms | max ms | busy % | long tasks >50ms | layout events | paint events |
|---|---:|---:|---:|---:|---:|---:|---:|
| B0 naive DOM | 5 | 42.127 | 66.779 | 31.873 | 31 | 847 | 1348 |
| B1 optimized DOM | 5 | 3.538 | 4.764 | 7.033 | 0 | 910 | 1742 |

### Analyzer table

| Baseline | Analyzer failed | measured valid | median stream window ms | max stream task ms | stream long tasks >50ms | max tail miss count |
|---|---:|---:|---:|---:|---:|---:|
| B0 naive DOM | false | 5/5 | 27678.025 | 77.730 | 71 | 0 |
| B1 optimized DOM | false | 5/5 | 18574.061 | 12.706 | 0 | 0 |

### Scrollback-resume interpretation

B0 naive DOM again completes the workload, but shows stronger main-thread pressure:

- `run_task_p95_ms = 42.127`
- `long_task_count_50ms = 31`
- analyzer stream long-task count reaches 71
- stream window stretches materially

B1 optimized DOM remains stable:

- `run_task_max_ms = 4.764`
- `long_task_count_50ms = 0`
- `max_stream_run_task_ms = 12.706`
- `max_tail_miss_count = 0`

Safe conclusion:

> B1 optimized DOM absorbs the current scrollback-resume workload as well.

---

## 5. Current P1-A Findings

### Finding 1: The P1-A workload is valid

The workload is no longer a P0-E proxy.

It includes:

- true streaming append
- mixed content
- markdown parsing
- deterministic syntax highlighting
- active input surface
- tail-follow
- scrollback-resume
- ready/idle gating
- token sample marks
- final token count validation

Both tail-follow and scrollback-resume runs passed analyzer validation after timing and lifecycle fixes.

### Finding 2: B0 naive DOM is pressure-positive

B0 completes the workload but experiences:

- stream stretch
- higher busy percentage
- long-task risk
- larger max stream tasks

This confirms that the workload is not too trivial.

### Finding 3: B1 optimized DOM is strong under current P1-A

B1 preserves the active streaming markdown/syntax-highlight workload while avoiding full-history rerendering.

It strongly reduces task cost in both scenarios:

- tail-follow
- scrollback-resume

B1 has:

- no summary-level long tasks
- no analyzer stream long tasks
- no tail misses
- substantially lower stream window duration

### Finding 4: Current P1-A does not justify P2

Because B1 optimized DOM handles the current workload well, P1-A does not support jumping to P2 runtime design.

Instead, it shows that conventional DOM optimization is powerful under this workload level.

---

## 6. What We Can Say

Safe claims:

1. P1-A B0/B1 bring-up succeeded.
2. The true AI streaming workload differentiates naive and optimized DOM.
3. B0 naive DOM shows stream stretch and main-thread pressure.
4. B1 optimized DOM absorbs the current 160-message / 800-token / 20ms workload.
5. B1 does so without skipping active streaming markdown parsing or syntax highlighting obligations.
6. Tail-follow and scrollback-resume both pass for B1 under current settings.

---

## 7. What We Cannot Say

Do not claim:

1. DOM / VDOM mismatch is proven.
2. Optimized DOM fails.
3. P1 is complete.
4. CodeMirror / Monaco are unnecessary.
5. P2 runtime implementation is justified.
6. This workload already reaches the impossible zone.

---

## 8. Reviewer-Style Audit

### Objection 1: If B1 passes, why do you need a new runtime?

Valid.

Response:

> We do not yet claim a new runtime is necessary. P1-A shows that conventional optimized DOM can handle this workload level. The next step is to stress B1 under more adversarial but still realistic conditions.

### Objection 2: B1 does less internal work than B0.

Valid, but that is the point.

Response:

> B1 preserves the same visible/logical output and active streaming parse/highlight obligations, while avoiding unnecessary stable-history rerendering. That is a legitimate conventional optimization.

### Objection 3: The workload may still be too easy.

Valid.

Response:

> The next stage, P1-B, should increase stress along realistic axes: larger history, heavier content, and concurrent input probes.

### Objection 4: B2/B3 are still missing.

Valid.

Response:

> This document is P1-A bring-up, not the full P1 gate. B2 virtualization and B3 CodeMirror/Monaco-style baselines remain required.

---

## 9. Next Step: P1-B Stress Ladder

Since B1 handles the current P1-A workload, the next step is not P2.

The next step is P1-B:

> adversarial streaming workload calibration to find the boundary of optimized DOM.

Recommended stress axes:

### Axis 1: History scale

Test:

- `history_messages = 500`
- `history_messages = 1000`

Question:

> Does B1 stable-history caching remain robust at larger long-session sizes?

### Axis 2: Content complexity

Test:

- `content_mix = code-heavy`
- `content_mix = tool-heavy`

Question:

> Do markdown parsing, syntax highlighting, and tool-output structures expose B1 active-stream cost?

### Axis 3: Concurrent input probe

Test:

- `input_probe = true`

Question:

> Does B1 remain responsive while streaming and processing input-like events?

This should be labeled as a proxy, not native input-dispatch measurement.

---

## 10. Final P1-A Statement

P1-A succeeded as a bring-up stage.

It established:

> Naive DOM is pressure-positive, while optimized DOM absorbs the current AI streaming workload.

Therefore:

> The project should not enter P2 yet. It should proceed to P1-B stress ladder to locate the boundary of optimized DOM under more adversarial but realistic streaming conditions.
