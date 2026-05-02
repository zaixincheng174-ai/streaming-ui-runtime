# P5-Y Final Reviewer Evidence Packet

## 1. Purpose

This is the final reviewer-facing P5 evidence packet after P5-X. It freezes current P5 evidence and claim boundaries. It is not browser-level INP, not Event Timing, not frame stability, not production readiness, not real product trace superiority, and not P4 authorization.

## 1.5 Definitions

- Synthetic input task: A zero-delay `setTimeout(..., 0)` callback scheduled on the main thread, used as a proxy for the main-thread availability that a real input event handler would observe.
- Timing floor: The minimum schedule-to-fire delay observable for `setTimeout(0)` on a foreground, non-nested timer chain on an idle main thread, approximately `0.1ms` in this harness.
- Input delay in this packet: The time from `setTimeout` scheduling to callback first-statement execution, measured with `performance.now()`. This is not browser-level Event Timing, INP, real keyboard/pointer latency, or input-to-pixel latency.
- Categorical difference: A blocked-vs-near-unblocked scheduling classification, not a precise multiplicative speedup. R0 floor values near `0.1ms` must not be converted into user-perceived speedup ratios.

## 2. One-paragraph Thesis

Current P5 evidence supports that worker-resident ownership of long-lived AI-surface logical work can reduce and localize main-thread blocking. Across send-start, commit-window, dynamic active-context, multistream agent-trace, and product-trace-shaped synthetic workloads, R0 does not eliminate computational work or all main-thread blocking. Instead, it moves logical send/update/multistream/trace-shaped work into Worker and leaves the main thread mainly responsible for bounded projection commit, preserving synthetic input-task availability during Worker-side processing.

## 3. Evidence Chain Table

| phase | B2 evidence | R0 evidence | mechanism claim | strength | boundary |
| --- | --- | --- | --- | --- | --- |
| P5-M send-start | B2m input delay = 16.0ms | R0m input delay = 0.1ms | B2 main-thread send work blocks the synthetic input task; R0 starts near the timing floor while Worker send work runs. | strong internal scheduling proxy | `setTimeout` proxy, not browser-level INP |
| P5-O commit-window | B2o commit-window input delay = 28.1ms | R0o commit-window input delay = 4.7ms | R0 has an isolable main-thread commit phase. B2 lacks an equivalent isolable commit phase because commit/render work is interleaved within synchronous main-thread send work. The architectural distinction is structural, not merely quantitative. | structural commit-phase distinction | B2o is mixed late-send-plus-commit blocking, not pure commit cost; R0o is clean commit-window blocking |
| P5-Q dynamic cost localization | B2q dynamic update = 28.5ms | R0q dynamic update = 30.8ms in Worker | Dynamic active-context update is a material cost in both systems; R0 moves it into Worker but does not eliminate it. | cost localization | no input scheduling claim from P5-Q alone |
| P5-S dynamic-update input availability | B2s dynamic-update input delay = 35.2ms | R0s dynamic-update input delay = 0.1ms | B2 main-thread dynamic update blocks synthetic input; R0 keeps synthetic input near floor during Worker-side update. | strong internal scheduling proxy | not Event Timing or random lifecycle arrival |
| P5-U multistream agent-trace | B2u multistream input delay = 164.3ms | R0u multistream input delay = 0.1ms | R0 moves multistream and dynamic-context work out of the main-thread input path. | strongest pre-P5-X workload-realism signal | synthetic agent-trace, not product trace evidence |
| P5-X product-trace-shaped synthetic | B2x product-trace-shaped input delay = 176.1ms | R0x product-trace-shaped input delay = 0.1ms | The input-path isolation signal survives a more product-trace-shaped synthetic workload. | strongest current P5 signal | not real product trace superiority |

Use these as blocked vs near-unblocked scheduling categories. Do not express them as precise user-perceived speedup ratios.

## 4. Final Mechanism Model

B2:

```text
synthetic input scheduled
-> main-thread logical work:
   active-context scan
   tail mutation
   append / stream merge / trace phase merge
   rolling active-context update
   bounded DOM render
-> synthetic input task waits behind main-thread work
```

B2 lacks an equivalent isolable commit phase in this harness because commit/render work is interleaved with synchronous main-thread send work.

R0:

```text
synthetic input scheduled
-> Worker logical work:
   active-context scan
   tail mutation
   append / stream merge / trace phase merge
   rolling active-context update
   bounded projection
-> main thread remains available during Worker work
-> bounded projection commit still blocks briefly
```

R0 has an isolable main-thread commit phase: remaining blocking is separately measurable and structurally localized, not eliminated.

## 5. What P5 Proves

- R0 can keep synthetic input near timing floor during Worker-side send work.
- R0 still blocks during bounded main-thread commit.
- R0 has an isolable main-thread commit phase; B2's commit/render work is interleaved within synchronous main-thread send work in these targets.
- R0 does not eliminate dynamic active-context or multistream work.
- R0 can isolate dynamic update cost from the main-thread input path.
- R0 can isolate multistream / agent-trace processing from the main-thread input path.
- P5-X reduces the external-validity gap by showing the same signal under a product-trace-shaped synthetic workload.

## 6. What P5 Does Not Prove

- Browser-level INP.
- Event Timing.
- Frame stability.
- Real keyboard/pointer latency.
- Input-to-pixel latency.
- Production readiness.
- Real product superiority.
- Impossible-zone completion.
- WebGPU/Canvas necessity.
- P4 eligibility.
- All-interaction dominance.
- Average-case/random lifecycle input availability.
- Optimal active-context update algorithm.

## 7. Fairness and Invariants

- Same P5-D matrix where applicable.
- Same `compact_checksum_index`.
- Same `rolling_tail_window_after_append` in dynamic variants.
- Same active-context entries visited = 100000 in relevant max scenarios.
- Same final logical block count = expected final logical block count = 54096 in relevant max scenarios.
- Same stream/trace event counts inside paired families.
- Same bounded rendered DOM inside each paired target family.
- DOM node counts differ across target families due to DOM shape; compare only within paired families.
- P5-U: 4582 rendered DOM nodes on both sides.
- P5-X: 4906 rendered DOM nodes on both sides.

## 8. Strongest Evidence

1. P5-X product-trace-shaped synthetic: B2x 176.1ms input delay vs R0x 0.1ms with equal trace/logical invariants. P5-X is the strongest current signal because it combines multistream merging, dynamic context updates, and trace-phase processing--the broadest synthetic workload in the P5 chain. The 176.1ms vs 0.1ms contrast should be read as a categorical isolation signal, not as a precise speedup ratio.
2. P5-U multistream: B2u 164.3ms vs R0u 0.1ms.
3. P5-S dynamic update: B2s 35.2ms vs R0s 0.1ms.
4. P5-M send-start: B2m 16.0ms vs R0m 0.1ms.
5. P5-O commit-window: R0o 4.7ms commit-window input delay shows blocking is bounded, not eliminated. R0 has an isolable main-thread commit phase; B2 lacks an equivalent isolable commit phase because commit/render work is interleaved within synchronous main-thread send work. P5-O also serves as the internal sanity anchor for R0's floor readings across P5-M/S/U/X: it demonstrates that R0 input delay can be non-floor when genuine main-thread blocking is present, reducing the risk that the repeated `0.1ms` values are merely measurement-floor artifacts. The 28.1ms B2o measurement reflects mixed late-send-plus-commit blocking, not pure commit cost. The architectural distinction is structural, not merely quantitative.

## 9. Reviewer Objections and Responses

| objection | response |
| --- | --- |
| "This is setTimeout, not real input." | Correct. P5 measures an internal `setTimeout` scheduling-delay proxy, not native keyboard or pointer event latency. |
| "This is not INP." | Correct. The packet says not browser-level INP and does not use Event Timing. |
| "R0 just moves cost to Worker." | Correct. That is the mechanism. P5 does not claim the CPU cost disappears. |
| "Commit still blocks." | Correct. P5-O shows the remaining bounded commit window instead of hiding it. |
| "B2 could use the same algorithmic optimizations." | Correct. Shared algorithmic optimizations must be paired before making architecture claims. |
| "Synthetic workloads may not reflect product traces." | Correct. P5-X reduces this gap with product-trace-shaped synthetic structure but does not close it fully. |
| "P5-X is product-trace-shaped, not real product trace." | Correct. It is synthetic and should be described as not real product trace evidence. |
| "DOM shape differs across target families." | Correct. Compare DOM counts only within paired target families; P5-U and P5-X have different but internally equal DOM shapes. |
| "This does not justify WebGPU/P4." | Correct. P4 remains not authorized. |
| "This might only measure favorable input timing, not average lifecycle availability." | Correct. P5 measures specific scheduling phases. Randomized lifecycle arrival is optional future work. |

## 10. Final Decision Gate

P5 evidence is strong enough to freeze for reviewer-facing packaging.

P4 remains not authorized.

Further benchmark expansion should stop unless a concrete reviewer objection requires it.

Recommended next stage is portfolio / README / paper-appendix packaging, not more axis expansion.

Optional future work: randomized input arrival or browser Event Timing / INP if the project decides to pursue browser-level interaction evidence.
