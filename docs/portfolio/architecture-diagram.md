# Architecture Diagrams

These diagrams explain the runtime direction at a portfolio level. They are conceptual diagrams, not production implementation diagrams.

## Diagram A: Document/DOM Ownership Path

```mermaid
flowchart TD
  A[User action or stream event] --> B[Main-thread app state]
  B --> C[Microtasks and subscriber fanout]
  C --> D[Derived session work]
  D --> E[DOM/VDOM render or commit]
  E --> F[Visible viewport]
  C --> G[Synthetic input task waits behind main-thread work]
```

The risk in this path is not only DOM size. The risk is that session-scale logical work and visible commit work can share the same main-thread ownership path.

## Diagram B: Worker-Resident Runtime Direction

```mermaid
flowchart TD
  A[User action or stream event] --> B[Operation stream]
  B --> C[Worker-resident logical runtime]
  C --> D[Transaction scheduler]
  D --> E[Session state, fanout, active context, stream merge]
  E --> F[Bounded projection]
  F --> G[Main-thread bounded projection commit]
  G --> H[Visible viewport]
  I[Synthetic input task] --> J[Input task avoids Worker-side logical work; main thread still has bounded commit work]
```

This direction does not remove main-thread work. It localizes the main-thread role toward bounded projection commit while moving session-scale logical work into Worker ownership.

## Diagram C: Evidence Chain

```mermaid
flowchart LR
  P0[P0 product-motivated traces] --> F0D[F0-D controlled reproduction]
  F0D --> F1[F1 worker offload]
  F1 --> F2[F2 worker scheduling]
  F2 --> P2[P2 pure-core scaffold]
  P2 --> P5[P5 synthetic scheduling-delay proxy]
  P5 --> B[Bounded claim: worker-resident ownership/offload can reduce and localize main-thread blocking]
```

Boundary: this evidence chain supports a research-backed runtime direction. It does not prove browser-level INP, Event Timing, production readiness, real product superiority, P4/WebGPU authorization, or P7 productization.
