# Product Mechanism Verdict And Thesis Reframe

## Decision

Product-side evidence now points most strongly to action-triggered
`Run microtasks`, scripting-heavy multi-bundle coordination, and app-side flush
cascade.

Product-side evidence does not currently point to rendering/layout as the
dominant primary family.

Controlled production React evidence has not reproduced the product
scaling/burst.

Therefore the project should not continue as a pure rendering-backend or
Canvas/WebGPU thesis at this stage.

## Evidence Basis

The Product N-sweep matrix shows that click/send cost grows with session length
and content richness. Input delay is mostly stable around 13-15ms where
measured, while INP degradation is mainly processing-side.

The Product DevTools event-tree snippets strengthen the product-side mechanism
evidence. Multiple snippets show:

`Task -> Event: click -> Run microtasks`

The heavier rows are dominated by processing, scripting, and `Run microtasks`,
not rendering:

- B3 / R006 / S004: long task `654.20ms`, click `622.46ms`,
  `Run microtasks=573.46ms`, scripting `543ms`, rendering `32ms`.
- B4 / R007 / S005: long task `482.68ms`, click `455.47ms`,
  `Run microtasks=427.56ms`, scripting `381ms`, rendering `28ms`.
- 100 short / R011 / S009: long task `458.52ms`, click `428.37ms`,
  `Run microtasks=405.97ms`, scripting `354ms`, rendering `27ms`.
- 4 rich / R008 / S006: long task `274.41ms`, click `257.07ms`,
  `Run microtasks=244.62ms`, scripting `204ms`, rendering `16ms`.
- A3 count20 / R016 / S014: long task `182.34ms`, click `167.55ms`,
  `Run microtasks=157.34ms`, scripting `149ms`, rendering `15ms`.

Three-run product click ownership decomposition has now been recorded:

- Run1: INP `646ms`, processing `549ms`, click `548.9ms`,
  `Run microtasks=501.4ms`.
- Run2: INP `829ms`, processing `647ms`, click/pointerup around `647ms`,
  `Run microtasks=599.6ms`.
- Run3: INP `745ms`, processing `612ms`, pointerup `612.4ms`,
  `Run microtasks=564.5ms`.

The stable shape across the three runs is:

`click/pointerup -> Run microtasks`

Specific ownership shifts across runs: `o`, `Ze`, `(anonymous)`, `4813494d`,
`2340486e`, unattributed regions, and `conversation-small`. Therefore the
correct interpretation is action-triggered microtask flush / scripting-heavy
multi-bundle coordination cascade. Do not interpret one minified function as the
root cause.

Controlled production React Option 0 cells remain clean:

- O0-A standard one-smoke: PASS.
- O0-B code-heavy 160 3x: PASS.
- O0-C code-heavy 500 one-smoke: PASS.
- O0-C code-heavy 1000 3x: PASS.
- O0-E1 documented send-flush pattern smoke: PASS, but too light to reproduce
  the product burst.

O0-E2 is not justified from the current source.

## What This Rules Out For Now

The current evidence does not justify:

- P2 runtime implementation.
- Canvas/WebGPU rendering backend work.
- A rendering-only thesis.
- `allocation_probe`.
- Synthetic adversarial workload creation.
- B2/B3 implementation as the immediate next step.

This does not mean those directions are impossible. It means they are not the
next justified move from the current evidence.

## What Remains Plausible

The strongest current product-side mechanism family is action-triggered
`Run microtasks` / scripting-heavy multi-bundle coordination / app-side flush
cascade.

Plausible subfamilies include:

- App-side async flush / microtask queue.
- Conversation-wide state traversal.
- Framework commit traversal under long-session state.
- State subscription / dependency fanout.
- Product queueing / internal app pipeline.
- GC as a possible secondary effect, not primary evidence yet.

Rendering and layout remain present, but the current product evidence does not
make them the dominant primary family.

Boundaries:

- No exact `o` / `Ze` semantics are claimed.
- No exact function ownership is claimed.
- No raw trace replay fidelity is claimed.
- No P2 eligibility follows from this evidence by itself.

## Thesis Reframe

Replace:

> DOM/VDOM rendering is the bottleneck.

With:

> Long-lived AI surfaces may degrade because send/click actions trigger large
> app-side flushes, state traversal, framework commits, and microtask-heavy
> processing over accumulated session state. A runtime contribution, if
> justified, should target transaction boundaries, state partitioning,
> scheduling, and viewport presentation - not merely a faster renderer.

This reframe preserves the runtime question while narrowing the mechanism. The
current evidence does not support a renderer-first thesis.

## Implications For Runtime Design

If the thesis survives, the runtime direction should emphasize:

- Operation stream / transaction log.
- Worker-side state partitioning.
- Bounded main-thread commit.
- Incremental projection of visible state.
- Explicit scheduling / priority lanes.
- Stable semantic block identity.
- Viewport-aware presentation.
- Renderer backend as secondary, not primary.

This implies a state/transaction/scheduling runtime first. A Canvas/WebGPU
renderer could become useful later only if a grounded mechanism shows that
presentation is the limiting lever.

## Controlled-Reproduction Gap

Product trend exists.

Controlled production React reproduction is missing.

The missing bridge is not another synthetic workload and not generic raw trace
acquisition. The next controlled bridge should be P1-F0 Send/Flush Fanout
Baseline.

P1-F0 should model:

- visible send/click trigger;
- microtask flush;
- multiple modules;
- subscriber fanout;
- state traversal;
- React stable semantics;
- metrics for microtask/scripting/fanout scaling.

Raw trace remains useful later, but it is not the immediate next step after the
three-run ownership decomposition.

Without that bridge, product evidence and controlled React evidence point in
different directions.

## Next Technical Direction

Do not build a Canvas/WebGPU runtime now.

Do not continue O0 synthetic escalation.

Design P1-F0 Send/Flush Fanout Baseline. This is now the next justified
technical step.

This is not implementation yet unless separately approved. It is not P2, not
Canvas/WebGPU, and not `allocation_probe`.

## Commit Criteria To Resume Runtime Work

Runtime work may resume only if all of these conditions are met:

- A product raw trace or stronger grounded artifact identifies a
  flush/state/commit mechanism.
- A controlled production framework baseline reproduces a boundary under fair
  semantics.
- Strong conventional mitigations cannot absorb the same workload, or expose a
  meaningful tradeoff.
- The proposed solution lever maps to transaction boundaries, scheduling, state
  partitioning, or viewport runtime.

Renderer-backend work needs an additional condition: product or controlled
evidence must show presentation/rendering as the dominant limiting family.

## Blocked Steps

Blocked from the current evidence:

- P2 implementation.
- Canvas/WebGPU renderer prototype.
- `allocation_probe`.
- Synthetic stronger workload.
- O0-E2 from the current source.
- B2/B3 implementation without a new gate.
- More methodology-only docs.

These are blocked because they would move faster than the evidence. They can be
reopened only by a new grounded artifact or an explicit gate decision.

## Final Recommendation

The project should pause rendering-runtime implementation and reframe around
product-side microtask/flush/state traversal evidence.

Stop collecting same-family DevTools evidence.

Use the three-run ownership decomposition as sufficient mechanism evidence for
P1-F0 planning.

Proceed to P1-F0 Send/Flush Fanout Baseline plan/support.

P2, Canvas/WebGPU, `allocation_probe`, and synthetic stronger workload remain
blocked.
