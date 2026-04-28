# Conclusion v0

## Core Takeaway

Long-lived AI surfaces are a distinct UI workload. They are append-heavy, viewport-centric, session-scale, and interaction-rich. A user may interact with a growing transcript, agent trace, code review, log surface, or long document review while the underlying session state continues to expand.

The bottleneck in this workload is not necessarily rendering alone. Product-motivated traces and controlled reproduction show that action-triggered state/fanout/microtask coordination can create main-thread responsiveness problems before a renderer backend is the first missing lever.

The paper therefore argues for a runtime direction: worker-resident state/fanout, transaction scheduling, and bounded projection. The main thread should remain a bounded projection commit boundary, not the default home for every session-scale coordination step.

## What The Evidence Shows

P0 product traces motivate the mechanism-family hypothesis:

```text
click/pointerup -> Run microtasks -> multi-bundle/state-context coordination
```

P0 does not replay product source, but it motivates the controlled mechanism tested by F0-D.

F0-D shows that controlled action-triggered derived fanout can reproduce stable microtask-dominated main-thread long tasks. The main task mean is approximately `68.633ms`.

F1 shows that equivalent derived fanout work can be moved off-main-thread, removing main-thread long tasks in the controlled setting. The main task mean drops to approximately `2.679ms`, and main-thread long tasks are removed.

F2 shows that scheduled/chunked Worker execution reduces same-clock urgent projection acknowledgement and projection-commit latency relative to monolithic Worker execution. Urgent acknowledgement improves from approximately `20.933ms` to approximately `0.900ms`; urgent visible commit improves from approximately `22.867ms` to approximately `3.333ms`.

P2 pure core v0 freezes the resulting runtime-core implications as an engineering scaffold: protocol, serialization, operation and transaction validation, priority/scheduler policy, backpressure, bounded projection policy, equivalence checks, recovery, traceability, metrics, op-log, state-store, and pure adapters.

## What The Evidence Does Not Show

The evidence does not show:

- product source replay;
- proof that all product latency is explained;
- proof that React or DOM universally fails;
- final runtime production readiness;
- Canvas/WebGPU relevance;
- proof that scheduled Worker execution improves total throughput;
- broad workload generalization.

These boundaries are part of the contribution. They keep the paper focused on a controlled mechanism and runtime direction rather than an overbroad production claim.

## Runtime Direction

The design direction is:

- session truth should move toward worker-resident state/op-log;
- the main thread should receive bounded visible projection;
- transaction scheduling should prioritize urgent input and visible projection;
- stale or malformed projections must fail closed;
- correctness requires serialization, checksums, lineage, recovery, metrics, and guards.

P2 pure core v0 is frozen as an engineering/runtime-core scaffold, not as a final runtime implementation. It encodes the runtime contracts needed for future gates, but it does not implement the real Worker runtime, real main runtime, or projection engine.

## Why This Matters

AI surfaces are becoming longer-lived and more agentic. They increasingly need to show streams, tool calls, traces, code and log outputs, citations, reasoning artifacts, and review surfaces while the user continues to interact with the session.

Treating these surfaces as ordinary document-oriented pages risks placing session-scale work on the main thread. Virtualizing visible DOM can help with node count, but it does not by itself remove state propagation, subscriber fanout, queue drains, or derived computation from the main-thread path.

A streaming UI runtime should treat presentation as a bounded projection of worker-resident session state. That direction keeps the full session model and background derived work away from the main presentation path while preserving a safe, current, bounded visible commit.

## Immediate Next Step

The immediate next step should not be broad implementation.

The next valid paths are:

- assemble the paper sections into a full short-paper draft;
- run a narrowly gated real Worker boundary smoke only if the draft exposes a concrete evidence gap.

The recommendation is to assemble a full short-paper draft first. That draft will reveal whether more evidence is needed before opening implementation gates, and it avoids using implementation momentum as a substitute for claim clarity.

## Final Claim

"In controlled settings, action-triggered derived fanout can reproduce main-thread long tasks, equivalent worker offload can remove those long tasks, and worker-side scheduling can reduce urgent projection commit latency. These findings support a worker-resident, transaction-scheduled, bounded-projection runtime direction for long-lived AI surfaces, while leaving production runtime implementation and broader validation to future work."

## Final Boundary Reminder

- P2 pure core remains frozen.
- Projection engine remains paused.
- Real Worker runtime remains paused.
- Real main runtime remains paused.
- DOM/React integration remains paused.
- Canvas/WebGPU remains paused.
- Product integration remains paused.
