# Short Paper v0.2 Outline

## 1. Paper Type and Scope

This is a HotOS/workshop/position-style short paper outline, not a full systems evaluation paper.

The v0.2 paper should make a sharp workload/runtime argument supported by bounded evidence. It should not claim full product replay, production runtime readiness, publishable product benchmark evidence, universal AI-product behavior, exact commercial-product architecture, exact source ownership, or P4 authorization.

The intended scope is:

- define the long-lived AI-surface workload;
- state the workload-architecture mismatch thesis;
- connect product motivation to controlled mechanism evidence without merging evidence classes;
- present a worker-resident, transaction-scheduled, bounded-projection runtime direction;
- use P3.5 as external-validity interpretation and claim-boundary control;
- leave full systems-paper evaluation to future P5 / impossible-zone controlled work.

## 2. One-Sentence Thesis

Long-lived AI surfaces expose a workload-architecture mismatch because append-heavy, viewport-centric, long-lived, tail-mutating workloads are being served by document/tree-oriented UI stacks, causing ordinary interactions to trigger session-scale coordination/fanout pressure.

## 3. P3.5 Qualifier

P3.5 refines the thesis by showing symptoms are product-strategy dependent across responsiveness, active-context fidelity, visible transcript continuity, and coordination cost.

This qualifier bounds the thesis rather than replacing it. The core claim remains workload-architecture mismatch; the P3.5 upgrade is that real products can express the mismatch through different tradeoff shapes.

## 4. Contributions

1. Workload characterization: characterize long-lived AI surfaces as append-heavy, viewport-centric, session-scale, tail-mutating workloads with distinct visible-history and active-context dimensions.
2. Controlled mechanism / architecture evidence chain: connect product-side symptoms to controlled fanout, scheduling, projection, and runtime-boundary evidence through P0/P1/P2/P3 while keeping evidence classes separate.
3. Runtime direction: propose a worker-resident, transaction-scheduled, bounded-projection runtime direction for controlling session-scale coordination on the interaction path.
4. External-validity interpretation: show that real product manifestations differ across ChatGPT, Claude, and Gemini, or anonymized commercial systems, implying that benchmark design must account for product strategy.

Benchmark-axis modeling, especially visible-history continuity versus active-context continuity, is a future-work implication. It is not a completed benchmark contribution in v0.2.

## 5. Proposed Paper Structure

| section | purpose | key points | evidence to reference | claims allowed | claims forbidden |
|---|---|---|---|---|---|
| 1. Abstract | State the paper frame in one compact pass. | Problem, runtime direction, P3.5 product-strategy qualifier, evidence boundary, future benchmark direction. | Short-paper draft v0; P3.5 external review packet; P3.5 closeout. | v0.2 is a bounded short-paper argument. | Full systems evaluation, product benchmark proof, P4 authorization. |
| 2. Introduction | Establish why long-lived AI surfaces are a distinct UI workload. | Append-heavy, viewport-centric, session-scale, terminal/editor/log-like surfaces; mismatch with document/tree-oriented stacks; P3.5 as qualifier. | README thesis; AGENTS north star; P3.5 synthesis. | Workload-architecture mismatch is the root thesis. | "DOM/VDOM is simply slow"; WebGPU is the thesis; all AI products fail uniformly. |
| 3. Workload Characterization | Define the workload axes before evidence. | Visible transcript length, active context fidelity, tail append, send/click path, scroll/old-history path, artifact/card routing, background scheduling, main-thread critical path. | Revision plan; closeout benchmark-design implications. | DOM length alone is insufficient as a benchmark variable. | Visible-history versus active-context continuity is already validated as a benchmark result. |
| 4. Product Motivation and External-Validity Framing | Use products to motivate and bound the claim. | ChatGPT high-severity reference; Claude same mechanism family with lower subjective severity; Gemini responsive/context-windowing divergence. | P3.5 synthesis; closeout; external review packet; P0 product evidence. | Product observations motivate mechanism and benchmark design. | Product ranking, exact architecture, exact source ownership, publishable controlled benchmark evidence. |
| 5. Runtime Direction | Explain the proposed runtime abstraction. | Worker-resident state/fanout, operation log, transaction scheduling, bounded projection, stale-result rejection, fail-closed contracts. | Short-paper draft v0; P1/F1; P1/F2; P2 pure core; P3 boundary evidence. | Runtime direction controls coordination and projection boundaries. | Production runtime readiness, DOM/React integration, Canvas/WebGPU necessity. |
| 6. Evidence Chain | Present evidence classes separately. | Product motivation, controlled reproduction/offload/scheduling, pure-core/P3 architecture boundaries, P3.5 interpretation. | P0/P1/P2/P3 docs; P3.5 closeout; external review packet. | Controlled evidence supports runtime mechanism chain; product traces motivate and constrain. | Product traces and controlled benchmarks are the same evidentiary class. |
| 7. Related Systems Positioning | Preempt "this is just an editor/terminal/virtual list" objections. | Position against CodeMirror/Monaco, xterm.js, Zed/GPUI-style systems, Flutter/React, and document/canvas-first systems. | Current related-work section; revision plan related-systems requirement. | Existing systems inspire parts of the model but do not cover the full AI-surface workload. | This replaces all UI frameworks; existing mature systems are ineffective. |
| 8. Discussion | State the conceptual upgrade and design consequences. | Mechanism similarity is not UX severity; low INP is not active-context fidelity; product strategy matters. | P3.5 external-validity synthesis; Claude and Gemini triage; closeout. | Long-session pressure is product-strategy dependent. | Claude is a high-severity failure; Gemini solves pressure; all systems fail the same way. |
| 9. Limitations | Keep the reviewer boundary explicit. | Opportunistic product traces, no exact product internals, bounded samples, controlled workload limits, no production runtime, no P4 authorization. | Revision plan limitations; short-paper draft limitations; closeout. | Interpretation-ready, not benchmark-proof. | Universal behavior, exact root cause, exact source ownership, full systems-paper completeness. |
| 10. Future Work / Gates | Define what comes after v0.2 without starting it. | Synthetic/local accumulation only if needed, P5/impossible-zone as future bridge, P4 requires separate gate, product testing is not default. | Revision plan P4/P5 implication; closeout recommended next step. | Future benchmarks should model visible history and active-context continuity separately. | P4 can begin now; Canvas/WebGPU is authorized; more product testing by default. |

## 6. Product Evidence Framing

The paper should frame product evidence as bounded motivation and external-validity interpretation, not as controlled benchmark proof.

- ChatGPT: high-severity reference case. It remains the strongest user-visible degradation symptom and the clearest motivator for the workload problem.
- Claude: same-mechanism-family, lower-severity case. It provides a non-ChatGPT send/click -> Run microtasks / app-coordination signal, but not ChatGPT-level subjective lag.
- Gemini: responsive/context-windowing divergence case. It showed low observed interaction cost in the sample while early visible context was unreliable or unavailable as active model context.

Public naming policy:

- Internal docs may name ChatGPT, Claude, and Gemini.
- The public draft may anonymize Claude/Gemini as System B/System C, or use bounded commercial-system wording, depending on review risk.
- Product observations must not rank products, infer exact internal architecture, infer exact source ownership, or claim one product is superior.
- ChatGPT may remain the high-severity reference case only with explicit boundaries.

## 7. Related Systems Paragraph Plan

The related systems section should distinguish this work from adjacent mature systems without caricaturing them.

- CodeMirror / Monaco: strong buffer and viewport systems, but the paper's focus is heterogeneous AI sessions with streaming append, artifacts, active context, provenance, and send/click coordination.
- xterm.js / terminals: close analogy for append-heavy retained history and scrollback, but AI surfaces add rich semantic blocks, tool outputs, citations, and active model-context concerns.
- Zed / GPUI-style runtime systems: relevant app/runtime systems, but this paper contributes a workload-specific framing for long-lived AI surfaces and a bounded projection / transaction scheduling direction.
- Flutter / React / UI frameworks: capable general frameworks, but the paper targets session-scale state/fanout placement and interaction-path coordination, not a blanket framework replacement claim.
- Document/canvas-first systems: relevant when presentation throughput dominates, but v0.2 argues the first evidenced bottleneck is coordination, scheduling, and bounded projection; Canvas/WebGPU remains future-gated.

The paragraph should say this is not merely a faster text editor or terminal renderer. The contribution is the workload/runtime framing for long-lived AI surfaces.

## 8. Evaluation / Evidence Boundary

- Product traces motivate and constrain the thesis.
- P1/P2/P3 controlled evidence supports the architecture chain.
- P3.5 interprets external validity and product-strategy dependence.
- These evidence classes should remain separate in the paper.
- None of these evidence classes authorizes P4.
- Product traces are not publishable benchmark proof.
- The P3.5 visible-history versus active-context axis is a benchmark-design implication, not a completed benchmark result.

## 9. Reviewer Objection Coverage

| objection | one-sentence answer |
|---|---|
| "Is this just ChatGPT?" | No; ChatGPT is the high-severity reference case, while Claude adds a lower-severity non-ChatGPT mechanism signal and Gemini adds a responsive/context-windowing divergence case. |
| "Are product traces enough?" | No; product traces motivate and constrain, while controlled P1/P2/P3 evidence carries the runtime mechanism and architecture claims. |
| "Does Gemini disprove the thesis?" | No; Gemini suggests product-strategy divergence where responsiveness may coexist with weaker early-context accessibility. |
| "Does Claude prove all systems fail?" | No; Claude supports mechanism-family similarity but not ChatGPT-level subjective severity or universal behavior. |
| "How is this different from editors or terminals?" | AI surfaces combine append, viewporting, heterogeneous semantic blocks, active model context, artifact routing, and interaction-critical app coordination. |
| "Why not WebGPU?" | Current evidence points first to state/fanout, transaction scheduling, and bounded projection; presentation backends remain future-gated. |
| "Where is the controlled evidence?" | F0-D reproduces the mechanism family, F1 tests worker offload, F2 tests worker scheduling, and P2/P3 define bounded runtime contracts. |
| "Why not start P4 now?" | P4 is not authorized by product traces or P3.5; it requires a separate gate and acceptance criteria after the paper/evidence gap is clear. |

## 10. Patch Plan for Existing Draft

Patch the existing draft next in this order:

1. Abstract: add venue/scope boundary and P3.5 product-strategy qualifier.
2. Introduction: sharpen the two-layer thesis, with core mismatch first and P3.5 qualifier second.
3. Problem formulation: add visible-history, active-context, surface-routing, send/click, scroll/history, background scheduling, and main-thread critical-path axes.
4. Evidence section: separate product motivation, controlled architecture evidence, and P3.5 interpretation.
5. Discussion: add ChatGPT / Claude / Gemini classification and mechanism-versus-severity framing.
6. Limitations: add opportunistic product evidence, no exact product architecture/source ownership, no universal claim, no P4 authorization, and benchmark-axis future-work boundaries.
7. Related work: add compact positioning against editors, terminals, app/runtime systems, UI frameworks, and document/canvas-first systems.
8. Future work: state synthetic/P5 benchmark design as a future bridge and keep P4 behind a separate gate.

Do not rewrite the full paper in one pass. Patch only the sections needed to align v0.2 with this outline and the revision plan.

## 11. Final Classification

| field | value |
|---|---|
| `outline_status` | `ready_for_targeted_patch` |
| `paper_type` | `hotos_workshop_position_style_short_paper` |
| `thesis_status` | `core_mismatch_with_p3_5_qualifier` |
| `p4_status` | `not_authorized` |
| `p5_status` | `future_bridge_not_active` |
| `recommended_next` | `targeted_short_paper_v0_2_patch` |
