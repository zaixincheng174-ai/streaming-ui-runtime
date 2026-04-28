# P0-F Proxy Baseline Variant Study under P0-E Workload

Date: 2026-04-24  
Project: Streaming UI Runtime for Long-Lived AI Surfaces  
Classification: P0-F / Pre-P1 proxy baseline variant study  
Former location: `docs/p1/p1-first-pass-results.md`

## 0. Classification Correction

This document corrects the stage classification of the previous `P1 first-pass results` note.

The experiment described here is **not constitutional P1**.

It should be classified as:

> P0-F: Proxy Baseline Variant Study under the P0-E click-triggered batch workload.

Reason:

- The workload is the P0-E proxy workload, not a full AI streaming workload.
- The baselines are author-written controlled variants, not production/editor-grade baselines.
- `text-buffer-proxy` is a no-dependency proxy representation, not CodeMirror, Monaco, or a full editor-grade UI baseline.
- The result cannot directly justify P2 runtime necessity.

This document preserves the data because it is useful, but it downgrades the interpretation.

---

## 1. What This Study Actually Tests

The study tests representation variants under the P0-E workload family:

> click-triggered, microtask-mode batch processing over a large segmented text surface.

It compares author-written controlled variants:

1. `p0e-reference`
2. `naive-dom`
3. `optimized-dom`
4. `virtualized-dom`
5. `text-buffer-proxy`

The goal is not to defeat state-of-the-art editor or framework baselines.  
The goal is to characterize how different **proxy representations** behave under the already validated P0-E workload.

---

## 2. Scope Limitations

### 2.1 Workload limitation

The workload is **not** the full AI streaming workload.

It does not yet include the full combination of:

- token-by-token streaming append
- markdown parse/render loop
- syntax highlighting
- live code blocks
- auto-scroll / scroll anchoring under stream
- active input box responsiveness while output streams
- long-lived mixed conversation surfaces

Therefore, this study cannot serve as the final P1 strong-baseline result.

### 2.2 Baseline limitation

The baselines are controlled, author-written variants.

They are not:

- production React baselines
- CodeMirror 6 baselines
- Monaco baselines
- production-grade virtualized chat surfaces
- full editor-grade embedded surfaces

Therefore, this study cannot claim that state-of-the-art conventional systems fail.

### 2.3 Text-buffer-proxy limitation

`text-buffer-proxy` should not be called an editor-grade baseline.

The safe name is:

> text-buffer-proxy

The safe interpretation is:

> It is a representation proxy showing that moving away from full mounted DOM can substantially reduce read-only traversal cost.

It does not substitute for CodeMirror or Monaco.

### 2.4 Microtask-mode limitation

The experiment uses `microtask_mode=true`.

Therefore, microtask dominance is partly induced by the workload design.

Safe interpretation:

> The result confirms that the proxy workload remains aligned with the P0-E microtask-window shape.

Unsafe interpretation:

> Microtask dominance was independently discovered across all baselines.

---

## 3. Workloads

### Workload A: E4 data-attribute update

- `block_count = 10000`
- `chars_per_block = 800`
- `operation_type = dom-text-scan`
- `microtask_mode = true`
- `mutation_mode = data-attribute-update`

### Workload B: E4 read-only

- `block_count = 10000`
- `chars_per_block = 800`
- `operation_type = dom-text-scan`
- `microtask_mode = true`
- `mutation_mode = read-only`

Primary metrics:

- `run_task_max_ms`
- `run_task_p95_ms`
- `long_task_count_50ms`
- batch-window max
- batch-window median
- max microtask time
- mark coverage

Secondary metric:

- `run_task_busy_pct`

Reason:

> The fixed capture window dilutes short burst cost, so busy percentage is not the primary metric.

---

## 4. Matrix Results

Run stamp:

`20260424T022155Z`

| Baseline | Workload | Valid | p95 ms | max ms | long tasks | max batch ms | median batch ms | max microtasks ms | median microtask share | rendering max |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| p0e-reference | E4_data_attribute_update | 5 | 63.402 | 85.962 | 1 | 98.481 | 85.718 | 98.517 | 1.000 | 0 |
| p0e-reference | E4_read_only | 5 | 73.894 | 77.702 | 1 | 84.700 | 77.075 | 84.898 | 1.003 | 0 |
| naive-dom | E4_data_attribute_update | 5 | 126.801 | 135.939 | 2 | 99.066 | 97.266 | 99.167 | 1.000 | 0 |
| naive-dom | E4_read_only | 5 | 86.488 | 94.671 | 1 | 97.855 | 93.164 | 97.893 | 1.000 | 0 |
| optimized-dom | E4_data_attribute_update | 5 | 54.263 | 78.511 | 1 | 96.260 | 78.056 | 96.295 | 1.000 | 0 |
| optimized-dom | E4_read_only | 5 | 66.398 | 70.416 | 1 | 93.677 | 70.021 | 93.717 | 1.001 | 0 |
| virtualized-dom | E4_data_attribute_update | 5 | 58.601 | 59.479 | 1 | 64.650 | 59.210 | 64.692 | 1.001 | 0 |
| virtualized-dom | E4_read_only | 5 | 44.155 | 48.129 | 0 | 65.302 | 47.990 | 65.375 | 1.001 | 0 |
| text-buffer-proxy | E4_data_attribute_update | 5 | 51.750 | 51.750 | 1 | 66.775 | 51.401 | 66.820 | 1.001 | 0 |
| text-buffer-proxy | E4_read_only | 5 | 19.331 | 19.494 | 0 | 51.418 | 19.076 | 51.469 | 1.003 | 0 |

---

## 5. Text-Buffer-Proxy Data-Attribute Repeat

A repeat was run for the borderline result:

> `text-buffer-proxy × E4_data_attribute_update`

Run stamp:

`20260424T024950Z`

### Summary

| Baseline | Workload | Valid | p95 ms | max ms | long tasks | busy % | layout | paint |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| text-buffer-proxy | E4_data_attribute_update repeat | 5 | 21.173 | 22.177 | 0 | 0.303 | 1 | 2 |

### Batch-window analysis

| Metric | Value |
|---|---:|
| max_batch_window_ms | 63.109 |
| median_batch_window_ms | 21.854 |
| max_run_task_ms | 63.402 |
| max_run_microtasks_ms | 63.158 |
| median_microtask_share_of_window | 1.001 |
| max_rendering_named_sum_ms | 0 |

### Correct interpretation

The repeat shows:

- summary-level long-task detection is not stable
- batch-window >50ms spikes are reproducible
- median cost remains low
- the burst remains microtask-window aligned
- rendering remains negligible

Safe conclusion:

> text-buffer-proxy strongly reduces median read/write cost, but data-attribute semantics retain borderline batch-window tail risk.

Unsafe conclusion:

> text-buffer-proxy fully eliminates mutation/write burst risk.

---

## 6. Corrected Findings

### Finding 1: Full DOM proxy variants are burst-prone

In this proxy study, `naive-dom` and `optimized-dom` remain burst-positive.

Safe conclusion:

> Full-DOM proxy variants remain vulnerable under the P0-E proxy workload.

Unsafe conclusion:

> Production React or all DOM systems necessarily fail.

### Finding 2: Optimized DOM proxy helps but does not eliminate burst risk

`optimized-dom` reduces some costs but remains burst-positive.

Safe conclusion:

> Cached references and simple DOM-level optimizations are not sufficient for this proxy workload.

Unsafe conclusion:

> All optimized DOM applications are insufficient.

### Finding 3: Virtualized proxy improves results but logical-full work still leaks through

`virtualized-dom` improves the read-only path, but logical-full batch windows can still exceed 50ms.

Safe conclusion:

> Reducing mounted DOM helps, but logical-full work remains a risk.

Unsafe conclusion:

> Virtualization cannot solve this class of workloads.

### Finding 4: Text-buffer-proxy is the strongest proxy representation

`text-buffer-proxy` is strongest in read-only mode.

Safe conclusion:

> A text-buffer-like representation can substantially reduce read-only traversal cost.

Unsafe conclusion:

> A production editor-grade baseline has been tested and passed.

### Finding 5: Mutation/write semantics remain less stable

Data-attribute update generally remains harder than read-only.

However, the text-buffer-proxy repeat shows this should be described as **borderline tail risk**, not a universal mutation penalty.

Safe conclusion:

> Mutation/write semantics introduce additional tail-risk potential in this proxy workload.

Unsafe conclusion:

> Mutation/write overhead is universally dominant.

### Finding 6: Microtask dominance should be interpreted carefully

Because `microtask_mode=true`, microtask dominance is expected.

Safe conclusion:

> The traces confirm that the controlled proxy workload remains within the intended post-click microtask batch window.

Unsafe conclusion:

> All baselines naturally produce microtask-dominant work independent of workload configuration.

---

## 7. Reviewer-Style Audit

### Objection 1: These are not production baselines.

Valid.

Response:

> This document is now classified as P0-F / Pre-P1. It is a proxy baseline variant study, not constitutional P1.

### Objection 2: The workload is not full AI streaming.

Valid.

Response:

> Correct. The workload is P0-E click-triggered batch processing. True P1 must use AI streaming workloads.

### Objection 3: text-buffer-proxy is not editor-grade.

Valid.

Response:

> Correct. It is a no-dependency representation proxy. CodeMirror / Monaco must be tested separately if P1b is approved.

### Objection 4: Microtask dominance is induced.

Valid.

Response:

> Correct. This is why microtask dominance is treated as trace-window alignment, not a standalone discovery.

### Objection 5: This cannot justify P2.

Valid.

Response:

> Correct. This study can inform P1 design, but it cannot justify P2 runtime implementation by itself.

---

## 8. Role Of This Study

This study remains useful because it shows:

1. The P0-E workload is reproducible and differentiates representations.
2. Full mounted DOM proxy variants are more vulnerable.
3. Reducing mounted DOM or moving toward text-buffer-like representation helps.
4. The hard remaining issue is logical-full semantics under burst-triggered processing.
5. True P1 should compare against stronger production/editor baselines and realistic AI streaming workloads.

This study should be used as:

> input to true P1 design

not as:

> proof that P1 is complete.

---

## 9. True Next Step

The next step is constitutional P1.

True P1 must include:

- AI streaming workload
- B0 naive DOM chat
- B1 optimized DOM / React chat
- B2 DOM virtualization with variable-height cache and scroll anchoring
- B3 CodeMirror 6 or Monaco-style editor-grade baseline

Do not enter P2 runtime implementation until true P1 has been scoped and at least one strong editor/framework baseline has been evaluated.

---

## 10. One-Sentence Corrected Conclusion

This P0-F proxy study shows that representation choices affect P0-E click-batch proxy workload cost, but it does not complete P1; true P1 must now test realistic AI streaming workloads against production/editor-grade baselines.

