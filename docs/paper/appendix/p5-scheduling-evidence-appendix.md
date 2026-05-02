# P5 Scheduling Evidence Appendix

## A. Research Question

Can worker-resident ownership of long-lived AI-surface logical work reduce and localize main-thread blocking compared with a main-thread-owned virtualized DOM baseline?

## B. Benchmark Family

- B2: main-thread virtualized DOM baseline.
- R0: worker-resident logical runtime with bounded main-thread projection commit.
- Collection: synthetic manual Chrome collection.
- Proxy: `setTimeout(..., 0)` schedule-to-callback-start delay, measured with `performance.now()`.
- Boundary: synthetic scheduling-delay proxy, not browser-level INP and not Event Timing.

## C. Evidence Chain

| phase | B2 evidence | R0 evidence | interpretation | boundary |
| --- | --- | --- | --- | --- |
| P5-M send-start | 16.0ms synthetic input-task scheduling delay | 0.1ms synthetic input-task scheduling delay | B2 main-thread send work blocks the synthetic input task; R0 stays near timing floor while Worker send work runs. | `setTimeout` proxy, not browser-level INP |
| P5-O commit-window | 28.1ms commit-window synthetic input-task scheduling delay | 4.7ms commit-window synthetic input-task scheduling delay | R0 has an isolable bounded commit phase; B2o reflects mixed late-send-plus-commit blocking, not pure commit cost. | R0 still blocks during commit; blocking is localized, not eliminated |
| P5-Q dynamic cost | 28.5ms dynamic update | 30.8ms dynamic update in Worker | Dynamic active-context update remains material; R0 moves the cost into Worker but does not eliminate it. | Cost localization only, not input scheduling evidence by itself |
| P5-S dynamic-update input | 35.2ms synthetic input-task scheduling delay | 0.1ms synthetic input-task scheduling delay | B2 main-thread dynamic update blocks synthetic input; R0 keeps the synthetic input task near floor while Worker update runs. | Not Event Timing or random lifecycle input |
| P5-U multistream | 164.3ms synthetic input-task scheduling delay | 0.1ms synthetic input-task scheduling delay | R0 moves multistream and dynamic-context processing out of the main-thread input path. | Synthetic agent-trace workload, not product trace evidence |
| P5-X product-trace-shaped synthetic scheduling-delay proxy | B2x 176.1ms | R0x 0.1ms | P5-X product-trace-shaped synthetic scheduling-delay proxy: B2x 176.1ms vs R0x 0.1ms under equal trace/logical invariants. | Not real product trace superiority |

Read these as blocked-vs-near-unblocked scheduling categories, not precise user-perceived speedup ratios.

## D. Mechanism Model

B2 main thread:

```text
input scheduled
-> main-thread logical work
-> bounded DOM render
-> input waits
```

R0:

```text
input scheduled
-> Worker logical work
-> main remains available
-> bounded commit still blocks briefly
```

## E. Reviewer-safe Claim

P5 supports the claim that worker-resident ownership can reduce and localize main-thread blocking under synthetic long-lived AI-surface workloads.

## F. Limitations

- `setTimeout` proxy only.
- Not browser-level INP.
- Not Event Timing.
- Not real product trace evidence.
- Not production readiness.
- No randomized lifecycle input arrival.
- Manual collection.
- Algorithmic optimizations must be paired.
- P4 remains not authorized.

## G. Next Work

- Prefer packaging / review over new benchmark-axis expansion.
- Do not add further product-trace-shaped variants unless a named reviewer objection requires it.
- Add browser Event Timing / INP only if the project explicitly shifts to browser-level interaction evidence.
