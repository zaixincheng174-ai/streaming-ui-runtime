# P5 Scheduling Evidence Summary

## Problem

Long-lived AI surfaces place append-heavy, stream-heavy, context-maintenance work on UI architectures that often keep too much logical work on the main thread.

## Direction

Worker-resident logical runtime with bounded main-thread projection commit.

## Evidence

| scenario | B2 behavior | R0 behavior | interpretation |
| --- | --- | --- | --- |
| P5-X product-trace-shaped synthetic | B2x synthetic input-task scheduling delay is 176.1ms while product-trace-shaped work runs on main. | R0x synthetic input-task scheduling delay is 0.1ms while Worker processing remains material and main commit is 3.5ms. | P5-X product-trace-shaped synthetic scheduling-delay proxy: B2x 176.1ms vs R0x 0.1ms under equal trace/logical invariants. Strongest current blocked-vs-near-unblocked scheduling category; not real product trace superiority. |
| P5-U multistream agent-trace | B2u synthetic input-task scheduling delay is 164.3ms during multistream/dynamic-context work. | R0u synthetic input-task scheduling delay is 0.1ms while Worker processing remains material and main commit is 3.3ms. | Worker ownership isolates long-lived multistream work from the main-thread input path in a synthetic scheduling-delay proxy. |
| P5-S dynamic update | B2s synthetic input-task scheduling delay is 35.2ms during main-thread dynamic context update. | R0s synthetic input-task scheduling delay is 0.1ms during Worker-side dynamic update. | Dynamic update cost is moved off the main-thread input path, not eliminated. |
| P5-O commit-window | B2o commit-window synthetic input-task scheduling delay is 28.1ms, reflecting mixed late-send-plus-commit blocking rather than pure commit cost. | R0o commit-window synthetic input-task scheduling delay is 4.7ms in an isolable main-thread commit phase. | R0 localizes remaining blocking to a separately measurable commit phase. B2 lacks an equivalent isolable commit phase without a similar ownership split, so the distinction is structural rather than merely quantitative. |

## Claim Boundary

This is a synthetic scheduling-delay proxy using `setTimeout`, not browser-level INP, not Event Timing, not production readiness, not real product superiority, and not precise user-perceived speedup evidence. P4 remains not authorized.

## Why It Matters

This supports the runtime thesis more than raw render speed: the important mechanism is keeping the main-thread input path available while long-lived logical work runs elsewhere.

## Links

- [Final reviewer evidence packet](../p5/p5y-final-reviewer-evidence-packet.md)
- [Reviewer adversarial audit](../p5/p5y-reviewer-adversarial-audit.md)
- [Paper appendix](../paper/appendix/p5-scheduling-evidence-appendix.md)
