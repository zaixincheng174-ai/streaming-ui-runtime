# P2 Evidence-To-Design Audit

## Decision

- Existing P2 core work should be preserved.
- P2 should not continue expanding modules blindly.
- Future work must distinguish experimental support, engineering derivation, and future validation.
- Projection engine, real Worker runtime, real main runtime, Canvas/WebGPU remain paused until explicitly re-gated.

This is a scope-control document, not a planning expansion document.

## Evidence Classes

### Experimental support

Directly supported by P1/F1/F2 results:

- worker offload
- equivalent work preservation
- urgent projection scheduling
- chunk/yield/preemption
- priority lanes for urgent-vs-background behavior

### Engineering derivation

Reasonable architecture needed to make the experimental direction testable and safe, but not directly proven by experiment:

- protocol
- serialization
- op validation
- transaction validation
- state store
- op log
- backpressure
- decision trace
- metrics snapshot
- recovery policy
- worker/main pure adapters
- in-memory roundtrip/session harness

### Future validation

Not yet justified for implementation:

- broader workload matrix
- multi-urgent stress
- projection engine
- real Worker runtime
- real main runtime
- state indexing/cache
- Canvas/OffscreenCanvas/WebGPU
- product integration

## Module Classification Table

| Module / Area | Classification | Evidence / Rationale | Risk | Decision |
|---|---|---|---|---|
| `runtime/core/priorities.ts` | Experimental support | F2 supports urgent-vs-background priority lanes. | Overgeneralizing lane set beyond tested urgent scheduling. | keep-and-harden |
| `runtime/core/scheduler-policy.ts` | Experimental support | F2 scheduled/chunked worker result is scheduler-positive. | Treating pure policy as full scheduler proof. | keep-and-harden |
| `runtime/core/checksums.ts` | Experimental support | F1/F2 rely on equivalent work preservation. | Counters could become proxy goals instead of correctness checks. | keep-and-harden |
| `runtime/core/message-serialization.ts` | Engineering derivation | Worker offload implies bounded deterministic cross-thread payloads. | Not a measured performance result. | keep-but-do-not-expand |
| `runtime/core/protocol.ts` | Engineering derivation | Required boundary for worker-resident runtime safety. | Protocol breadth can drift ahead of evidence. | keep-but-do-not-expand |
| `runtime/core/ops.ts` | Engineering derivation | Needed to express append/projection/session operations. | Op taxonomy may grow without workload proof. | keep-but-do-not-expand |
| `runtime/core/op-validation.ts` | Engineering derivation | Fail-closed ops-stream ingress is required before runtime use. | Validation can become behavior if expanded carelessly. | keep-and-harden |
| `runtime/core/transactions.ts` | Engineering derivation | F2 motivates transaction scheduling, but schema is design scaffolding. | Transaction fields may overfit current synthetic harness. | keep-but-do-not-expand |
| `runtime/core/transaction-validation.ts` | Engineering derivation | Required to keep scheduled work auditable and fail-closed. | Validation gaps could hide skipped work. | keep-and-harden |
| `runtime/core/backpressure-policy.ts` | Engineering derivation | Needed to make chunked scheduling safe under load. | Backpressure behavior is not yet stress-validated. | needs-future-test |
| `runtime/core/projection-policy.ts` | Engineering derivation | Urgent projection commit safety follows from F2 direction. | Not a projection engine and not pixel-latency proof. | needs-future-test |
| `runtime/core/recovery-policy.ts` | Engineering derivation | Normalized fail-closed outcomes are needed for adapters. | Recovery actions are recommendations, not implemented recovery. | keep-but-do-not-expand |
| `runtime/core/op-log.ts` | Engineering derivation | Deterministic op history supports no-skipped-work audits. | Could imply persistence/replay scope not yet validated. | keep-but-do-not-expand |
| `runtime/core/state-store.ts` | Engineering derivation | Worker-resident state is the architecture direction from F1/F2. | State indexing/cache behavior is not validated. | keep-but-do-not-expand |
| `runtime/core/core-decision.ts` | Engineering derivation | Composes fail-closed admission policy for testability. | Can be mistaken for a runtime scheduler. | keep-and-harden |
| `runtime/core/core-engine.ts` | Engineering derivation | Pure ingress-to-decision loop makes P2 testable without runtime. | Must not become worker/main runtime loop. | keep-and-harden |
| `runtime/core/decision-trace.ts` | Engineering derivation | Required for auditability across message/op/transaction decisions. | Trace shape may expand without adapter needs. | keep-but-do-not-expand |
| `runtime/core/metrics-snapshot.ts` | Engineering derivation | Makes future worker/main adapters inspectable. | Metrics are not benchmark evidence by themselves. | keep-but-do-not-expand |
| `runtime/worker/worker-context.ts` | Engineering derivation | Pure adapter context prepares for future worker boundary. | Could be mistaken for real Worker runtime. | keep-but-do-not-expand |
| `runtime/worker/worker-message-handler.ts` | Engineering derivation | Pure handler tests core boundary without `postMessage`. | Real Worker runtime remains unvalidated. | needs-future-test |
| `runtime/main/main-projection-adapter.ts` | Engineering derivation | Pure main-side commit decision protects future projection bridge. | No DOM/React commit behavior is validated. | needs-future-test |
| `runtime/testing/in-memory-roundtrip.ts` | Engineering derivation | Tests worker/main adapter composition without threading. | Harness is not product/runtime evidence. | keep-but-do-not-expand |
| `runtime/testing/in-memory-session-scenario.ts` | Engineering derivation | Tests multi-step immutable session behavior without real runtime. | Scenario matrix remains narrow. | needs-future-test |
| `tests/runtime/*` | Engineering derivation | Guards schema, policy, adapter, and pure-core correctness. | Tests can grow without evidence mapping. | keep-and-harden |
| `scripts/p2/check_runtime_guards.mjs` | Engineering derivation | Prevents accidental runtime/DOM/Worker expansion. | Allowlist expansion can weaken scope control. | keep-and-harden |

## Directly Evidence-Supported Core

The most directly supported P2 areas are:

- priority lanes
- scheduler policy
- worker offload boundary
- equivalence counters/checksums
- urgent projection scheduling
- serialization boundary for safe cross-thread messaging

These connect to F1 Worker B because F1 showed equivalent off-main-thread work removes main-thread long tasks. They connect to F2 A/B because F2 showed scheduled worker transaction/projection work reduces same-clock urgent acknowledgement and projection-commit latency relative to monolithic worker work. The serialization boundary is evidence-aligned because worker offload requires deterministic cross-thread messages, but its exact implementation is an engineering derivation, not a measured performance result.

## Engineering-Derived But Acceptable Scaffolds

These are acceptable but must be described as engineering scaffolds:

- protocol
- op/transaction validation
- op-log
- state-store
- decision-trace
- metrics-snapshot
- recovery-policy
- pure adapters
- in-memory harnesses

They are needed for testability, fail-closed behavior, traceability, and future Worker/Main integration, but they should not be claimed as direct experimental findings.

## Paused / Future Validation Areas

These are paused:

- projection engine
- real Worker runtime
- real main runtime
- Canvas/WebGPU
- broader workload matrix
- multi-urgent scheduler stress
- product integration

These need a new gate or explicit test plan before implementation.

## What We Should Not Do Next

Explicitly blocked:

- deleting existing P2 core work
- continuing module expansion without evidence mapping
- implementing projection engine now
- implementing real Worker runtime now
- implementing runtime/main client now
- implementing Canvas/WebGPU now
- claiming all P2 modules are experimentally proven
- claiming final runtime success

## What We May Do Next

Allowed:

- fix concrete correctness bugs in existing P2 core
- harden tests/guards
- improve evidence-supported scheduler/offload path
- prepare a narrow future gate for projection engine or real Worker runtime, but only after this audit is accepted

## Final Recommendation

Preserve existing P2 work, stop blind expansion, and continue only with:

A. concrete defect fixes;
B. test/guard hardening;
C. evidence-aligned next gate.

Do not delete current P2 modules. Do not continue adding new modules until the next step is explicitly justified against this classification.
