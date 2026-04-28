# Limitations and Future Work v0

## Purpose of This Section

This section explicitly bounds the paper's claims and identifies the next evidence needed before moving from controlled mechanisms and frozen pure-core design to real runtime implementation.

The goal is not to weaken the evidence chain. The goal is to keep the claim reviewer-safe: P0 motivates a mechanism family, F0-D reproduces it in controlled form, F1 tests worker offload, F2 tests worker-side scheduling, and P2 pure core v0 freezes an engineering scaffold. None of those steps is a production runtime claim.

## Main Limitations

### Product Trace Boundary

P0 motivates a mechanism-family hypothesis. It shows product-side traces shaped like action-triggered `click/pointerup -> Run microtasks` paths with multi-bundle app coordination, state/context propagation hints, and subscriber-fanout-like behavior.

P0 is not source replay. It does not prove the exact product implementation, and it does not prove that all product latency comes from the observed mechanism. Minified and multi-bundle traces limit precise ownership claims. The safe role of P0 is motivation and mechanism-family selection, not complete causal proof.

### Controlled Workload Boundary

F0-D is controlled mechanism-family reproduction. It models action-triggered derived fanout, queue drain, and state traversal under production-React-like conditions.

F0-D is smaller than some product bursts. It does not quantitatively replay 400-650ms product traces. It validates a controlled main-thread fanout bottleneck, not all possible AI UI workloads. The result is sufficient to establish a controlled baseline for F1, but it does not close the generalization question.

### Worker Offload Boundary

F1 validates worker offload for equivalent derived fanout work. It shows that the reproduced F0-D main-thread long task can be removed while preserving structural work counters and checksums.

F1 does not prove all UI work can move off-main-thread. DOM commit, browser layout and paint, input handling, caret and focus behavior, accessibility, and some framework behavior remain main-thread concerns. Worker compute is also not cycle-identical to main-thread compute, so the evidence supports structural equivalence and main-thread relief, not exact timing equivalence.

### Worker Scheduling Boundary

F2 validates worker-side scheduled/chunked execution for one urgent visible projection request during heavy Worker work.

F2 does not prove multi-urgent behavior. F2-B improves urgent responsiveness but increases Worker total time. This is a responsiveness tradeoff, not a total throughput improvement. F2 also measures projection-commit latency, not the full display pipeline, paint, compositor, monitor scanout, or exact user-perceived pixel latency.

### P2 Pure Core Boundary

P2 pure core v0 is frozen as an engineering scaffold. It is not a production runtime.

It does not implement:

- real Worker runtime;
- real main runtime;
- projection engine;
- DOM/React integration;
- Canvas/WebGPU;
- product integration.

P2 pure core v0 should not be described as final runtime success. Its role is to freeze a fail-closed protocol/state/scheduler/projection scaffold that future gates may test.

## Threats To Validity

### Measurement Threats

Measurement threats include:

- trace capture sensitivity;
- foreground and visibility effects;
- stale-server or stale-target risk;
- warmup, JIT, and cache effects;
- single-machine and local environment sensitivity;
- trace-derived metric interpretation.

These threats do not invalidate the controlled evidence, but they constrain how broadly the results should be stated.

### Workload Threats

Synthetic controlled workloads may not generalize. F0-D parameterization is structurally motivated, not reverse-engineered product constants.

F2 tests one urgent projection pattern. Broader AI surfaces may have different state, fanout, rendering, accessibility, input, and retention profiles. A chat transcript, an agent trace, a code review surface, a log surface, and a long document review surface may stress different parts of the architecture.

### Interpretation Threats

F2-B's lower urgent latency should not be read as better throughput. Same-clock urgent metrics are the final A/B basis, not mixed worker-clock fields.

Projection-commit latency is not full display pipeline latency. P2 modules are not all experimentally proven. Protocol, state-store, recovery, metrics, traces, and harnesses are engineering scaffolds derived from the evidence direction.

## What We Still Need To Show

Future evidence needed before stronger runtime claims includes:

- multi-urgent scheduling stress;
- broader workload matrix:
  - chat transcript;
  - agent trace;
  - code review;
  - log surface;
  - long document review;
- real Worker boundary smoke;
- projection engine prototype;
- accessibility and input/focus/caret model;
- comparison with stronger baselines:
  - virtualized DOM;
  - editor-style buffer;
  - React concurrent features;
  - possibly workerized state libraries;
- memory growth / long-session retention analysis;
- real browser display pipeline / paint/compositor timing if making user-perceived latency claims.

These are future evidence requirements, not authorization to expand implementation immediately.

## Future Work Gates

### Real Worker Runtime Gate v0

Allowed only later:

- minimal Worker boundary;
- one serializable message;
- Worker calls pure worker adapter;
- returns machine-readable output;
- no DOM/React;
- no projection engine;
- no product integration.

This gate would test whether the frozen pure-core boundary survives a real Worker message path. It should not become a full runtime.

### Projection Engine Gate

Allowed only later:

- `SessionState + visible_range -> bounded ProjectionResultShape`;
- preserve projection-policy safety;
- no DOM/React;
- no Canvas/WebGPU initially.

This gate would test projection construction. It should not imply renderer integration or production commit behavior.

### Multi-Urgent Scheduler Gate

Allowed only later:

- multiple urgent projection requests during heavy worker work;
- measure fairness, starvation, and latency;
- keep equivalent work counters.

This gate would extend F2 beyond the current single-urgent boundary.

### Presentation Backend Gate

Allowed only later:

- Canvas/OffscreenCanvas/WebGPU only after runtime boundary is stable;
- renderer backend remains secondary to state/scheduling/projection boundary.

This gate should not be opened merely because a graphics backend is available. It requires evidence that the runtime boundary is no longer the first missing piece.

### Product Validation Gate

Allowed only later:

- map frozen runtime concepts back to product-like traces;
- no claim of product migration without implementation evidence.

This gate would connect the controlled design direction back to product-shaped conditions, but it must not claim migration before there is actual integration evidence.

## Non-Goals

This work is not:

- solving all web jank;
- replacing React/DOM universally;
- building a production UI framework in this paper;
- claiming WebGPU is required;
- claiming all AI UI workloads share the same bottleneck;
- claiming accessibility readiness;
- claiming product integration.

## Reviewer Objections And Responses

- "This is just worker offload." Response: F1 covers worker offload, but F2 shows worker-side scheduling matters after work has already moved off-main-thread.
- "The benchmark is synthetic." Response: Correct; the claim is controlled reproduction of a product-motivated mechanism family, not product replay.
- "F2-B is slower in worker total time." Response: Correct; the result is an urgent responsiveness tradeoff, not a total throughput improvement.
- "Why not React concurrent features?" Response: The evidence targets session-scale state/fanout placement and Worker scheduling; React prioritization is a relevant future baseline, not the current proof.
- "Why not virtual list?" Response: Virtualization bounds DOM nodes but does not by itself remove session-scale state/fanout work from the main thread.
- "Why not editor architecture?" Response: Editor buffer models are relevant, but AI surfaces add heterogeneous blocks, tool traces, streaming partials, and provenance requirements.
- "Why not Canvas/WebGPU?" Response: The current bottleneck evidence is state/fanout scheduling, not renderer throughput, so graphics backends remain future validation items.
- "Where is accessibility?" Response: Accessibility is a production requirement and future gate; this paper slice does not claim accessibility readiness.
- "Where is product validation?" Response: P0 provides product motivation, while F0-D/F1/F2 provide controlled evidence; product migration remains a separate future gate.
- "Does P2 pure core prove the runtime works?" Response: No. P2 pure core v0 is a frozen engineering scaffold, not a production runtime or real Worker implementation.

## Safe Future Claim Language

"Future work should evaluate whether the frozen P2 pure-core concepts can survive a real Worker boundary, a bounded projection engine, broader workload matrices, and accessibility constraints. Until then, the paper claims a mechanism diagnosis, controlled reproduction, solution-lever evidence, and runtime design direction-not production runtime completion."

## Final Recommendation

The next paper section should be Conclusion v0, because the paper now has problem, workload model, evidence chain, design implications, and explicit limitations. Implementation gates should remain paused until the draft reveals a specific evidence gap.
