# P2 Module Evidence Classification

## Decision

- Existing P2 pure core work is preserved.
- This document does not delete or weaken existing work.
- It classifies modules into evidence categories.
- Future work must respect these categories.
- This document does not unfreeze P2 pure core v0.

## Classification Categories

### Direct Experimental Support

Modules or ideas directly supported by F1/F2 evidence:

- worker offload boundary
- priority lanes
- scheduler / urgent projection policy
- equivalence counters
- serialization boundary for cross-thread safety

### Engineering Scaffold

Modules needed to make the evidence-supported direction testable, safe, and auditable:

- protocol
- operation / transaction validation
- op-log
- state-store
- recovery policy
- decision trace
- metrics snapshot
- pure adapters
- in-memory harnesses

### Architecture Commitment

Design choices that are stronger than mere scaffolding and should not be overclaimed as experimentally proven:

- block/message state model
- op-log plus state-store pair
- worker-resident session state model
- bounded projection result contract
- transaction lifecycle model

### Future Validation

Areas requiring future gates before implementation:

- real Worker runtime
- real main runtime
- projection engine
- Canvas / OffscreenCanvas / WebGPU
- broader workload matrix
- multi-urgent stress testing
- product integration

## Module Classification Table

| Module / Area | Category | Evidence / Rationale | Risk If Overclaimed | Decision |
|---|---|---|---|---|
| `runtime/core/protocol.ts` | Engineering Scaffold | Defines the safe envelope boundary needed before worker-side integration. | Protocol breadth could be mistaken for experimentally proven runtime behavior. | keep-as-scaffold |
| `runtime/core/message-serialization.ts` | Direct Experimental Support | Worker offload requires deterministic bounded cross-thread messages. | Serialization implementation details could be overstated as a measured performance result. | keep-frozen |
| `runtime/core/ops.ts` | Engineering Scaffold | Defines operation shapes for the frozen pure core. | Operation taxonomy could expand without workload evidence. | keep-as-scaffold |
| `runtime/core/op-validation.ts` | Engineering Scaffold | Keeps operation ingress fail-closed and auditable. | Validation could be treated as proof of full runtime behavior. | keep-as-scaffold |
| `runtime/core/transactions.ts` | Architecture Commitment | Transaction shape encodes the scheduling model implied by F2. | Transaction schema could be overclaimed as product-validated. | keep-but-do-not-overclaim |
| `runtime/core/transaction-validation.ts` | Engineering Scaffold | Validates scheduled work before admission. | Validator strength could be confused with real scheduler validation. | keep-as-scaffold |
| `runtime/core/transaction-lifecycle.ts` | Architecture Commitment | Defines transaction state transitions without implementing a runtime loop. | Lifecycle states could imply implemented runtime recovery or execution. | keep-but-do-not-overclaim |
| `runtime/core/priorities.ts` | Direct Experimental Support | F2 supports urgent-vs-background priority lanes. | Lane set could be generalized beyond tested urgent scheduling. | keep-frozen |
| `runtime/core/scheduler-policy.ts` | Direct Experimental Support | F2 supports scheduled/chunked worker behavior improving urgent projection latency. | Pure policy could be mistaken for a production scheduler. | keep-frozen |
| `runtime/core/backpressure-policy.ts` | Engineering Scaffold | Needed to make scheduled work bounded and safe under pressure. | Backpressure tuning is not yet stress-validated. | keep-as-scaffold |
| `runtime/core/projection-policy.ts` | Architecture Commitment | Bounded projection result contract protects future visible projection commits. | Could be mistaken for a projection engine or DOM commit proof. | keep-but-do-not-overclaim |
| `runtime/core/checksums.ts` | Direct Experimental Support | F1/F2 rely on equivalence counters and checksums to show work was preserved. | Counters could become proxy success claims instead of guardrails. | keep-frozen |
| `runtime/core/errors.ts` | Engineering Scaffold | Normalized errors make fail-closed decisions inspectable. | Error taxonomy could imply implemented recovery behavior. | keep-as-scaffold |
| `runtime/core/recovery-policy.ts` | Engineering Scaffold | Maps normalized errors to safe recovery decisions for future adapters. | Recovery policy could be mistaken for actual runtime recovery. | keep-as-scaffold |
| `runtime/core/op-log.ts` | Architecture Commitment | Op-log provides deterministic operation history for pure core state. | Could imply persistence or replay scope that is not validated. | keep-but-do-not-overclaim |
| `runtime/core/state-store.ts` | Architecture Commitment | Worker-resident block/message state model is the pure core state commitment. | Block/message model could be overclaimed as product state architecture. | keep-but-do-not-overclaim |
| `runtime/core/core-decision.ts` | Engineering Scaffold | Composes envelope, op, transaction, backpressure, scheduler, and projection decisions. | Could be mistaken for complete runtime arbitration. | keep-as-scaffold |
| `runtime/core/core-engine.ts` | Architecture Commitment | Atomically integrates op-log and state-store in the pure core. | Could be mistaken for real Worker or main runtime implementation. | keep-but-do-not-overclaim |
| `runtime/core/decision-trace.ts` | Engineering Scaffold | Records fail-closed decision stages for auditability. | Trace shape could expand without adapter evidence. | keep-as-scaffold |
| `runtime/core/metrics-snapshot.ts` | Engineering Scaffold | Provides inspectable pure-core counters for future smoke tests. | Metrics are not benchmark evidence by themselves. | keep-as-scaffold |
| `runtime/worker/worker-context.ts` | Engineering Scaffold | Pure worker-side context prepares the future worker boundary. | Could be mistaken for real Worker runtime. | keep-as-scaffold |
| `runtime/worker/worker-message-handler.ts` | Engineering Scaffold | Pure handler exercises worker-side admission without `postMessage`. | Could imply real worker integration exists. | keep-as-scaffold |
| `runtime/main/main-projection-adapter.ts` | Engineering Scaffold | Pure main-side adapter tests projection acceptance without DOM commit. | Could imply main runtime or rendering exists. | keep-as-scaffold |
| `runtime/testing/in-memory-roundtrip.ts` | Engineering Scaffold | Tests pure worker/main adapter composition without threading. | Harness results could be overclaimed as real runtime evidence. | keep-as-scaffold |
| `runtime/testing/in-memory-session-scenario.ts` | Engineering Scaffold | Tests multi-step pure session behavior. | Narrow scenarios could be mistaken for broader workload validation. | keep-as-scaffold |
| `scripts/p2/check_runtime_guards.mjs` | Engineering Scaffold | Enforces freeze boundaries and blocks forbidden runtime APIs. | Guard presence could be mistaken for runtime readiness. | keep-as-scaffold |
| `tests/runtime/*` | Engineering Scaffold | Regression suite verifies frozen pure-core behavior and guards. | Test breadth could be mistaken for product or runtime validation. | keep-as-scaffold |

## Safe Claim Boundary

- P1/F1/F2 directly support worker offload, urgent scheduling, and equivalence-preserving worker-side scheduling.
- P2 pure core is a frozen engineering/runtime-core scaffold derived from that evidence.
- Protocol/state/recovery/metrics/harness modules improve correctness and testability, but are not individually proven by experiments.
- Projection engine and real Worker runtime remain future validation items.

## What Not To Claim

- Do not claim every P2 module is experimentally proven.
- Do not claim P2 pure core is a production runtime.
- Do not claim the current product has been migrated.
- Do not claim Canvas/WebGPU relevance.
- Do not claim final runtime success.
- Do not claim projection engine exists.

## Future Work Routing

Future work must be routed through:

- correctness bug fix,
- test/guard/tooling hardening,
- approved Real Worker gate,
- approved Projection Engine gate,
- evidence-to-design / paper claim-boundary correction.

## Final Recommendation

Preserve the frozen P2 pure core. Do not delete existing modules. Do not expand modules without a new gate. Use this classification when writing paper claims or approving future implementation.
