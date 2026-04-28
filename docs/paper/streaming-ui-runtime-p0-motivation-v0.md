# Product Trace Motivation / P0 Evidence v0

## Purpose of This Section

This section motivates the paper's mechanism hypothesis using real product traces. It should explain what P0 evidence supports and what it does not support.

The safe role of P0 is motivation and mechanism-family identification. P0 does not prove the proposed runtime, does not replay product source, and does not assign exact ownership to private implementation details.

## Product Trace Question

When a long-lived AI surface becomes sluggish, is the main bottleneck primarily rendering/layout/paint, or action-triggered scripting/microtask/state coordination?

The P0 evidence asks this question at the product-trace level. It does not answer every runtime question, but it helps decide whether the paper should investigate renderer replacement first or state/fanout placement and scheduling first.

## P0 Observation Summary

Product-side traces show action-triggered click/pointerup paths. Across the preserved evidence, the observed shape is:

```text
click/pointerup -> Run microtasks
```

The ownership picture is distributed. Cost appears across multiple bundles and unattributed regions rather than one obvious function or a single stable source owner.

Source-semantics hints such as `setContextProperty` support a state/context propagation interpretation. The readable names do not prove exact source semantics, but they are consistent with state propagation, reactive dependency updates, subscriber notification, or fanout-like behavior.

The mechanism family supported by P0 is multi-bundle app coordination / state-context propagation / subscriber-fanout-like behavior.

## Ownership Decomposition

The point of ownership decomposition is not to assign exact source ownership. The product evidence does not provide raw replay-grade traces or source-map-stable function identities.

The point is to distinguish broad mechanism families:

- rendering/layout/paint dominated;
- GC dominated;
- React commit dominated;
- scripting / microtask / app coordination dominated.

P0 evidence supports the scripting/microtask/app-coordination family. The repeated product shape is click/pointerup into `Run microtasks`, with scripting-heavy processing and ownership drifting across bundles. Rendering/layout and GC appear in some views, but they are not the stable dominant family in the preserved observations.

## What The Trace Suggests

- Action-triggered microtask flush appears central.
- Product behavior is not explained solely by layout/paint.
- The bottleneck is not obviously one isolated function.
- The mechanism appears distributed across state/context/fanout coordination.
- Renderer backend alone is unlikely to be the first lever.

This interpretation aligns with the P1 direction: model action-triggered derived fanout / queue drain / state traversal / microtask-heavy work before arguing for a runtime boundary.

## What The Trace Does Not Prove

- Not product source replay.
- Not exact source-map ownership.
- Not exact semantics of minified symbols.
- Not proof that all product latency comes from this mechanism.
- Not proof React is the root cause.
- Not proof DOM rendering is irrelevant.
- Not proof Worker runtime would directly solve product without architecture changes.

These boundaries matter because P0 is product motivation, not a complete causal proof. It justifies controlled reproduction and solution-lever tests; it does not replace them.

## Why Controlled Reproduction Is Needed

P0 evidence motivates the mechanism family, but it cannot alone prove a solution. The preserved traces and summaries show product-side pressure, but they do not provide replay-grade queue constants, exact implementation ownership, or a directly testable runtime design.

Therefore the paper needs:

- F0-D controlled reproduction of derived fanout / microtask-heavy main-thread work;
- F1 worker offload test under equivalent work;
- F2 scheduler test under worker-side monolithic vs scheduled execution.

The evidence chain should read as motivation -> controlled reproduction -> controlled solution lever -> runtime design implication.

## Link To F0-D

P0 motivates F0-D's controlled mechanism family:

```text
action-triggered derived fanout / queue drain / state traversal / microtask-heavy work
```

F0-D does not replay product internals. It creates a controlled test cell that isolates the proposed mechanism family and asks whether that family can produce stable main-thread long-task behavior under production-React-like conditions.

This link is the paper's claim boundary. P0 says the mechanism is plausible and product-motivated. F0-D tests whether the mechanism can reproduce the relevant class of bottleneck in controlled form.

## Figure / Table Draft

Figure: "Product trace mechanism shape"

```text
click/pointerup
-> Run microtasks
-> multi-bundle/state-context coordination
-> delayed responsiveness
```

Table:

| Observation | Evidence Interpretation | Boundary |
|---|---|---|
| click/pointerup triggers scripting work | action-triggered path | not full product replay |
| `Run microtasks` dominates | microtask/state coordination | not exact source semantics |
| ownership drifts across bundles | distributed app coordination | not one function root cause |
| layout/paint not dominant | renderer-first less justified | not renderer irrelevant |

## Safe Claim Language

Safe wording:

"P0 product traces motivate a mechanism-family hypothesis: action-triggered microtask-heavy app coordination, likely involving state/context propagation and subscriber/fanout-like work, can dominate responsiveness costs in long-lived AI surfaces."

Unsafe wording to avoid:

- "P0 proves ChatGPT's source code does X."
- "P0 proves React is the problem."
- "P0 proves rendering is irrelevant."
- "P0 proves Worker runtime will fix the product."

## Final Recommendation

The next paper section should be F0-D Controlled Reproduction, because P0 motivates the mechanism but does not isolate it or prove the solution.
