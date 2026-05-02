# P5-Y Reviewer Adversarial Audit

## 1. Audit Verdict

Pass with strict claim boundaries.

## 2. Strongest Acceptable Claim

The strongest reviewer-safe claim is: current P5 evidence supports that worker-resident ownership of long-lived AI-surface logical work can keep a synthetic `setTimeout` input task near the timing floor during Worker-side send, dynamic update, multistream, and product-trace-shaped processing, while leaving a bounded main-thread projection commit window.

This is scheduling-mechanism evidence. It is not browser-level INP, not Event Timing, not production readiness, not real product superiority, and not P4 authorization.

## 3. Claims That Must Be Rejected

- "R0 improves INP."
- "R0 is production-ready."
- "R0 eliminates main-thread blocking."
- "R0 proves real product superiority."
- "P5 authorizes P4/WebGPU."
- "R0 is x-times faster in user-perceived latency."

## 4. Reviewer Risk Register

| risk | severity | why it matters | mitigation in packet | remaining gap |
| --- | --- | --- | --- | --- |
| setTimeout proxy | high | Timer callback delay is not native input latency. | Every evidence doc labels the signal as internal scheduling-delay proxy. | Browser input event evidence remains unmeasured. |
| floor effect / measurement artifact concern | high | All major R0 input delay numbers in P5-M/S/U/X are near 0.1ms. Without internal validation, a reviewer could dismiss them as timer-floor artifacts rather than evidence of actual main-thread availability. | P5-O establishes that R0 input delay can be non-floor, specifically 4.7ms, when the main thread is genuinely busy with bounded projection commit. This anchors the interpretation that the 0.1ms values in P5-M/S/U/X reflect main-thread availability during Worker-side work, not an unavoidable measurement artifact. | Cross-machine and cross-browser timer-floor variance is not characterized. |
| no Event Timing / INP | high | Reviewers may expect browser-level metrics. | Packet rejects INP and Event Timing claims. | A future browser-level run would be needed for INP claims. |
| synthetic workloads | medium | Synthetic workloads may miss real workload structure. | P5-X adds product-trace-shaped synthetic phases and lanes. | Still not real product trace. |
| no real product traces | medium | External validity remains bounded. | Packet explicitly says not real product trace superiority. | Product trace evidence would require separate sanitized trace design. |
| favorable input timing | medium | P5 schedules input around specific phases, not random arrival. | Packet identifies phase-specific scheduling evidence only. | Average lifecycle availability remains unmeasured. |
| algorithmic confounds | medium | B2 could receive the same algorithmic improvements. | P5 paired compact-context and dynamic-context variants keep shared optimizations paired. | Future algorithm changes must stay paired. |
| DOM shape differences | low | Cross-family DOM counts can be miscompared. | Packet says compare DOM counts only within paired families. | Cross-family DOM-shape equivalence is not claimed. |
| manual collection | medium | Manual Chrome rows are more operationally fragile than automated harnesses. | Collectors validate matrix, invariants, and metric schema. | Manual collection still depends on operator discipline. |
| P4 temptation | high | The evidence could be overread as WebGPU authorization. | Packet states P4 remains not authorized. | P4 requires a separate decision gate. |

## 5. Audit Recommendation

Freeze P5 as scheduling-mechanism evidence.

Do not expand benchmarks unless addressing a named objection.

Proceed to final packaging.
