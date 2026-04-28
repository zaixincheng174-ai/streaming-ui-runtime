# Runtime Design Implications / Frozen P2 Pure Core v0

## Purpose of This Section

This section translates the F0-D/F1/F2 evidence chain into runtime design implications. It explains why P2 pure core v0 uses worker-resident state, operation logs, transactions, priority scheduling, bounded projection, fail-closed validation, traceability, metrics, and recovery policy.

P2 pure core v0 is a frozen engineering/runtime-core scaffold. It is not a production runtime and does not open real Worker runtime, real main runtime, projection engine, DOM/React, Canvas/WebGPU, or product integration.

## Evidence-To-Design Chain

| Evidence | Design Implication | P2 Core Mechanism | Boundary |
|---|---|---|---|
| Product/P0: click/pointerup -> Run microtasks / app coordination | session-scale work should not be coupled to main-thread presentation | protocol + op model + worker-resident state direction | mechanism-family evidence, not source replay |
| F0-D: controlled derived fanout creates main-thread long tasks | need a controlled runtime boundary for state/fanout work | op-log, transaction model, state-store | controlled reproduction, not product replay |
| F1: worker offload removes main-thread long tasks under equivalent work | derived fanout work can move off-main-thread | worker-side pure adapter, serialization boundary, equivalence counters | solution lever, not universal offload |
| F2: scheduled Worker reduces urgent projection latency | Worker work needs priority scheduling, not just offload | priority lanes, scheduler-policy, backpressure-policy | responsiveness tradeoff, not throughput win |
| Projection safety requirements | main thread must only commit bounded, current, checksummed projections | projection-policy, main projection adapter, checksum/range validation | safety contract, not renderer implementation |
| Debuggability/recovery requirements | failures must be traceable and recoverable | decision-trace, metrics-snapshot, recovery-policy | engineering scaffold |

## Worker-Resident State Direction

The session truth should not be only the DOM or VDOM tree. Long-lived AI surfaces retain session-scale state, append heterogeneous blocks, and require derived work that can exceed the current viewport. The P1 evidence supports moving pure session/fanout work away from the main presentation path.

P2 implements a pure state-store and op-log scaffold for that direction:

- The op-log tracks accepted operations.
- The state-store tracks blocks, messages, and `session_version`.
- The state-store is immutable and fail-closed.
- Rejected operations do not mutate state.
- Duplicate message, operation, and chunk protections support replay safety.

This supports future Worker-resident state, but it does not yet implement real Worker storage, persistence, or product session migration.

## Transaction Scheduling Direction

F2 motivates priority lanes and transaction scheduling because monolithic Worker execution can still delay urgent visible projection after heavy work leaves the main thread.

The priority order is:

`urgent-input > visible-projection > stream-update > background-indexing`

P2 includes scheduler-policy and transaction validation so a future Worker gate has a narrow policy surface to test. This is not a full scheduler queue implementation. It is a pure policy layer for future Worker scheduling and for fail-closed validation of transaction-like work.

## Bounded Projection Direction

The main thread should receive only bounded visible projection, not full session state. P2 includes projection-policy and the main-projection-adapter to encode that safety contract before any renderer or projection engine is implemented.

Projection validation checks:

- `session_version` and `result_version`;
- stale and future projection status;
- checksum presence and shape;
- `visible_range` shape;
- `visible_range` references to blocks;
- block shape and unique block IDs;
- estimated bytes;
- optional equivalent-work counters when present;
- explicit `ProjectionBounds` booleans.

This is not a projection engine and not rendering. It is the admission contract for a future bounded projection result.

## Serialization / Cross-Thread Boundary

Future Worker runtime will require message passing. P2 therefore includes deterministic JSON-like serialization validation before any real `postMessage` boundary is opened.

The serialization boundary rejects:

- functions;
- symbols;
- bigint values;
- `undefined`;
- `NaN` and `Infinity`;
- cyclic objects;
- class instances;
- `Date`, `Map`, `Set`, `RegExp`, and `Error`;
- excessive depth or payload size.

UTF-8 byte measurement is used for payload limits. This prepares a safe future Worker boundary without using `postMessage` yet.

## Fail-Closed Correctness

P2 pure core prioritizes correctness over permissiveness because future async Worker/Main integration will make debugging harder.

Major fail-closed contracts include:

- malformed envelope rejects;
- malformed operation rejects;
- malformed transaction rejects;
- invalid checksum rejects;
- invalid range rejects;
- stale operation rejects;
- duplicate message, operation, and chunk rejects;
- non-integer version and count values reject;
- malformed projection rejects;
- backpressure rejects malformed or over-limit resource state.

The important design implication is that unsafe or incomplete inputs should stop at the pure boundary, before they can corrupt Worker-resident state or create ambiguous main-thread commits.

## Traceability, Metrics, And Recovery

Decision trace records where a decision passed or failed. Metrics snapshot gives machine-readable state summaries. Recovery policy maps errors to safe recovery recommendations.

Error and recovery lineage preserves `message_id`, `parent_action_id`, `txn_id`, and `trace_context` where available. These are engineering scaffolds for testability and future integration, not direct experimental findings.

## Pure Worker/Main Adapter Scaffolds

The worker-message-handler is a pure adapter target for a future Worker entry point. The main-projection-adapter is a pure adapter target for a future main-side projection bridge.

The in-memory roundtrip and session harnesses test the boundary without real Worker runtime, `postMessage`, DOM, or a real main runtime. They support correctness checks for the future boundary, but they do not implement that boundary.

## What P2 Pure Core v0 Freezes

The freeze note records P2 pure core v0 as frozen at freeze candidate commit `85f5106`. The frozen core includes protocol, serialization, validation, transaction lifecycle, scheduler and backpressure policy, projection policy, checksum/equivalence validation, error/recovery policy, op-log, state-store, core-decision/core-engine, traces, metrics, pure adapters, in-memory harnesses, tests, and runtime guard checks.

This freeze means no more blind module expansion. Future work must route through one of these categories:

- concrete correctness bug fix;
- test/guard/tooling hardening;
- approved Real Worker gate;
- approved Projection Engine gate;
- evidence-to-design / paper claim-boundary correction.

## What P2 Pure Core v0 Does Not Claim

P2 pure core v0 does not claim:

- production runtime readiness;
- real Worker runtime;
- real main runtime;
- projection engine;
- DOM/React bridge;
- Canvas/WebGPU relevance;
- product integration;
- broad workload validation;
- proof that every P2 module is experimentally proven.

## Relationship To Future Gates

### Real Worker Runtime Gate v0

A later Real Worker Runtime Gate v0 may test:

- a real Worker boundary;
- one serializable message posted across that boundary;
- the Worker calling the pure worker adapter;
- machine-readable output returned from the Worker.

It should not include DOM/React, projection engine, product integration, or broad runtime behavior.

### Projection Engine Gate

A later Projection Engine Gate may test:

- `SessionState + visible_range -> bounded ProjectionResultShape`;
- no DOM/React integration;
- no Canvas/WebGPU;
- preservation of projection-policy safety.

The projection engine must remain separate from renderer claims until its own gate is approved.

### Test/Tooling Hygiene

Test and tooling hygiene may:

- reduce `// @ts-nocheck` in high-value runtime tests;
- ignore or quarantine local artifacts;
- strengthen guard checks.

It should not alter frozen runtime behavior unless the change is a concrete correctness fix.

## Figure / Table Draft

Figure: "Evidence-to-runtime implication map"

P0/F0/F1/F2 evidence -> protocol -> op-log/state-store -> transaction scheduler -> bounded projection -> trace/metrics/recovery.

Table: use the Evidence-To-Design Chain table above.

## Safe Claim Language

Safe wording:

"P2 pure core v0 is a frozen engineering scaffold that encodes the runtime implications of the F1/F2 evidence chain: worker-resident state direction, transaction scheduling, and bounded projection with fail-closed correctness. It is not a final runtime implementation."

Unsafe claims to avoid:

- "P2 proves the runtime works in production."
- "P2 proves the product can be migrated."
- "P2 proves Canvas/WebGPU relevance."
- "P2 implements the final Worker runtime."
- "All P2 modules are experimentally proven."

## Final Recommendation

The next paper section should be Limitations / Future Work, because the evidence and design direction are now laid out and must be bounded before any future implementation gates are proposed.
