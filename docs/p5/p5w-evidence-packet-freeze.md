# P5-W Evidence Packet Freeze

## 1. Purpose

This packet freezes the current P5 evidence chain into a reviewer-ready claim-boundary document. It is not a new measurement, not browser-level INP, not Event Timing, not frame-stability evidence, not production readiness, and not P4 authorization.

## 2. Source Evidence Inventory

| phase | result files | mechanism summary | status |
| --- | --- | --- | --- |
| P5-M send-start scheduling | `bench/p5/results/p5m_b2c_concurrent_input_results.json`; `bench/p5/results/p5m_r0c_concurrent_input_results.json` | `docs/p5/p5n-concurrent-input-mechanism-summary.md` | collected and summarized |
| P5-O commit-window scheduling | `bench/p5/results/p5o_b2c_commit_window_input_results.json`; `bench/p5/results/p5o_r0c_commit_window_input_results.json` | `docs/p5/p5p-send-start-commit-window-mechanism-summary.md` | collected and summarized |
| P5-Q/R dynamic active-context cost localization | `bench/p5/results/p5q_b2c_dynamic_context_results.json`; `bench/p5/results/p5q_r0c_dynamic_context_results.json` | `docs/p5/p5r-dynamic-active-context-mechanism-summary.md` | collected and summarized |
| P5-S/T concurrent input during dynamic update | `bench/p5/results/p5s_b2c_concurrent_dynamic_context_results.json`; `bench/p5/results/p5s_r0c_concurrent_dynamic_context_results.json` | `docs/p5/p5t-dynamic-update-concurrent-input-mechanism-summary.md` | collected and summarized |
| P5-U/V multistream agent-trace workload | `bench/p5/results/p5u_b2c_multistream_agent_trace_results.json`; `bench/p5/results/p5u_r0c_multistream_agent_trace_results.json` | `docs/p5/p5v-multistream-agent-trace-mechanism-summary.md` | collected and summarized |

## 3. Core Thesis Claim

Current P5 evidence supports the thesis that worker-resident ownership of long-lived AI-surface logical work can reduce and localize main-thread blocking. Across send-start, commit-window, dynamic active-context, and multistream agent-trace proxies, R0 does not eliminate computational work or all main-thread blocking. Instead, it moves logical send/update/multistream work into Worker and bounds remaining main-thread work to projection commit, preserving synthetic input-task availability during worker-side processing.

Do not claim:

- browser-level INP improvement
- production readiness
- overall framework superiority
- impossible-zone completion
- P4 eligibility

## 4. Evidence Chain Summary

| phase | B2 result | R0 result | mechanism interpretation | claim strength |
| --- | --- | --- | --- | --- |
| P5-M send-start | B2m input delay 16.0ms; send work 15.9ms | R0m input delay 0.1ms; worker send processing 5.5ms; main commit 4.7ms | B2 main-thread send work blocks the synthetic input task; R0 starts the input task near the timing floor while Worker-side send work runs. | strong internal scheduling-delay proxy |
| P5-O commit-window | B2o commit-window input delay 28.1ms; main commit 10.5ms | R0o commit-window input delay 4.7ms; main commit 4.7ms | R0 still blocks during bounded main-thread projection commit; blocking is localized, not eliminated. | commit-window caveat and bounded-blocking evidence |
| P5-Q dynamic cost localization | B2q dynamic update 28.5ms | R0q dynamic update 30.8ms in Worker; main commit 4.6ms | Rolling-tail active-context update is material in both systems; R0 moves the cost into Worker but does not eliminate it. | cost-localization evidence |
| P5-S dynamic-update input availability | B2s dynamic-update input delay 35.2ms; dynamic update 45.7ms | R0s dynamic-update input delay 0.1ms; worker processing 49.6ms; main commit 4.5ms | B2 main-thread dynamic update blocks synthetic input; R0 keeps synthetic input near the floor during Worker-side update. | strong internal scheduling-delay proxy |
| P5-U multistream agent-trace | B2u multistream input delay 164.3ms; dynamic update 131.3ms; stream events 4096 | R0u multistream input delay 0.1ms; worker processing 133.6ms; main commit 3.3ms | R0 moves multistream and dynamic-context work out of the main-thread input path under the most realistic P5 synthetic workload. | strongest P5 workload-realism signal |

## 5. Claim Boundary Matrix

| claim | supported? | evidence | allowed wording | forbidden wording |
| --- | --- | --- | --- | --- |
| R0 can keep synthetic input near timing floor during worker-side send work. | yes | P5-M/P5-N/P5-P | R0m shows near-floor synthetic timer-task start while worker-side send computation is in flight. | R0 proves browser-level INP improvement or eliminates input latency. |
| R0 still blocks during bounded main-thread commit. | yes | P5-O/P5-P | R0 localizes remaining blocking to bounded projection commit. | R0 eliminates all main-thread blocking. |
| R0 does not eliminate dynamic active-context cost. | yes | P5-Q/P5-R | Dynamic update remains material; R0 moves it into Worker. | R0 solves dynamic active-context CPU cost. |
| R0 can isolate dynamic update cost from the main-thread input path. | yes | P5-S/P5-T | R0s keeps the synthetic input task near the timing floor while worker-side dynamic update is in flight. | R0s proves real keyboard or pointer responsiveness is superior. |
| R0 can isolate multistream/agent-trace processing from the main-thread input path. | yes | P5-U/P5-V | Under the synthetic multistream workload, R0u keeps synthetic input near the timing floor during worker-side processing. | R0u is production-ready or proves real product superiority. |
| Current results prove browser-level INP improvement. | no | No Event Timing or INP measurement was collected. | The current evidence is an internal scheduling-delay proxy. | R0 improves INP. |
| Current results authorize P4/WebGPU. | no | P5 results are DOM/Worker scheduling evidence only. | P4 remains not authorized. | P5 proves WebGPU or P4 is required. |
| Current results prove production runtime readiness. | no | Targets are synthetic manual benchmark harnesses. | The results support a research direction and claim-boundary packet. | R0 is production-ready. |
| Current results prove real product superiority. | no | No product trace or product site was measured. | A product-trace-shaped synthetic scenario could improve external validity. | R0 is superior on real product workloads. |

## 6. Fairness Invariants

- Same P5-D matrix where applicable.
- Same `compact_checksum_index`.
- Same `rolling_tail_window_after_append` for dynamic-context variants.
- Same max active-context entries visited = 100000 in relevant max scenarios.
- Same final logical block count = expected final logical block count = 54096 in relevant max scenarios.
- Same bounded rendered DOM inside each paired target family.
- B2/R0 intentionally differ in ownership of logical work.
- P5-U `rendered_dom_node_count` = 4582 on both sides.
- Do not compare P5-U 4582 directly with earlier 5700-node target families as if DOM shape were identical.

## 7. Main Mechanism Diagram in Text

B2 path:

```text
user action / synthetic input scheduled
-> main-thread logical work:
   active-context scan
   tail mutation
   append / stream merge
   rolling active-context update
   bounded DOM render
-> input task waits behind main-thread work
```

R0 path:

```text
user action / synthetic input scheduled
-> Worker logical work:
   active-context scan
   tail mutation
   append / stream merge
   rolling active-context update
   bounded projection
-> main thread remains available during Worker work
-> bounded projection commit still blocks briefly
```

## 8. Strongest Evidence

- P5-U/V multistream agent-trace: B2u input delay 164.3ms vs R0u 0.1ms under equal stream/logical invariants.
- P5-S/T dynamic update: B2s input delay 35.2ms vs R0s 0.1ms.
- P5-M/P send-start path: B2m 16.0ms vs R0m 0.1ms.
- P5-O/P commit-window caveat: R0o 4.7ms commit-window delay, showing blocking is bounded not eliminated.

These are internal `setTimeout`-based scheduling-delay proxies, not browser Event Timing.

## 9. Reviewer Objections and Responses

| objection | response |
| --- | --- |
| "This is setTimeout, not real input." | Correct. The packet labels these as internal scheduling-delay proxies and does not claim keyboard, pointer, Event Timing, or INP evidence. |
| "This is not INP." | Correct. No browser-level INP measurement is claimed or authorized by P5. |
| "R0 just moves cost to Worker; CPU cost remains." | Correct. P5-Q and P5-U show dynamic-context and multistream CPU costs remain material; the mechanism claim is input-path isolation and bounded main commit. |
| "Commit still blocks." | Correct. P5-O is included specifically to show that remaining main-thread commit blocking is bounded, not eliminated. |
| "B2 could use the same algorithmic optimizations." | Correct. Shared algorithmic optimizations must be paired. P5 separates algorithmic confounds from ownership and scheduling effects. |
| "Synthetic workloads may not reflect product traces." | Correct. Product-trace-shaped synthetic work is the right next step if external validity is the main concern. |
| "DOM shape differs across target families." | Correct. P5-U reports 4582 rendered DOM nodes on both B2u/R0u and should not be compared directly with earlier 5700-node families as identical DOM shape. |
| "This does not justify WebGPU/P4." | Correct. P4 remains not authorized. |

## 10. Remaining Gaps

- Browser Event Timing / INP not measured.
- Real product trace superiority not proven.
- Average-case/random input arrival not measured across full lifecycle.
- Algorithmic optimizations need paired treatment.
- Product-trace-shaped synthetic scenario may improve external validity.
- P4/WebGPU not authorized by current evidence.

## 11. Decision Gate

P5 evidence is strong enough to freeze into a reviewer-ready packet.

P4 remains not authorized.

Recommended next:

- Option A: product-trace-shaped synthetic scenario if external validity is the main concern.
- Option B: paper/evidence packet packaging if claim clarity is the main concern.

Do not continue expanding benchmark axes unless a concrete reviewer objection requires it.

## 12. Final Classification

| field | value |
| --- | --- |
| p5_status | evidence_packet_frozen |
| primary_mechanism | worker_resident_logical_work_reduces_and_localizes_main_thread_blocking |
| strongest_signal | multistream_agent_trace_input_path_isolation |
| proxy_status | internal_setTimeout_scheduling_delay_not_INP |
| p4_status | not_authorized |
| recommended_next | product_trace_shaped_synthetic_or_paper_packet_packaging_before_p4 |
