> **Status:** Historical / superseded draft.
> This document is retained for project history and should not be read as the current claim boundary. For current public-facing claims, start with `README.md` and `docs/portfolio/document-status-map.md`.

# Short Paper v0.2 Revision Plan

## 1. Purpose

This is a revision plan, not a rewritten paper. It translates P3.5 external-validity findings into concrete paper edits: which sections need to change, what thesis language should be upgraded, what claims are allowed, what claims must be removed, and what reviewer objections the revision must preempt.

This plan does not authorize new measurement, product testing, P4, runtime coding, benchmark changes, script changes, or a full paper rewrite.

## 2. Current Revision Problem

The current paper must not remain stuck at a simple "DOM/VDOM is slow" framing.

P3.5 showed product-strategy-dependent pressure across ChatGPT, Claude, and Gemini. The paper must separate mechanism signal, UX severity, visible transcript continuity, active model-context fidelity, and coordination cost.

The paper must also preserve evidence class boundaries. Product traces and opportunistic DevTools observations can motivate and refine the thesis, but they must not be presented as publishable controlled benchmark proof.

## Target Venue / Paper Type Assumption

v0.2 should target a HotOS/workshop/position-style short paper or internal external-review packet.

It should not pretend to be a full EuroSys/SOSP-style evaluation paper. A full systems paper requires later P5/impossible-zone controlled evaluation.

This assumption controls evidence strength, contribution wording, and scope. The v0.2 revision should be sharp enough for skeptical review, but it should not claim the evaluation completeness of a mature systems paper.

## 3. Updated Thesis Language

### Core thesis

Long-lived AI surfaces expose a workload-architecture mismatch: append-heavy, viewport-centric, long-lived, tail-mutating workloads are being served by document/tree-oriented UI stacks, causing ordinary interactions to trigger session-scale coordination/fanout pressure.

### P3.5 qualifier

The observable symptoms of this mismatch are product-strategy dependent. Products may trade off interaction responsiveness, active-context fidelity, visible transcript continuity, and app-side coordination cost.

P3.5 refines and bounds the thesis. P3.5 does not replace the thesis. The tradeoff framing belongs in problem formulation and discussion, not as a replacement for the core thesis.

WebGPU is not the thesis.

## Contribution Claims for v0.2

- Workload characterization contribution: We characterize long-lived AI surfaces as append-heavy, viewport-centric, session-scale, tail-mutating workloads with distinct visible-history and active-context dimensions.
- Mechanism / controlled evidence contribution: We connect product-side symptoms to controlled fanout/scheduling/projection evidence through P0/P1/P2/P3, while keeping evidence classes separate.
- Runtime abstraction contribution: We propose a worker-resident, transaction-scheduled, bounded-projection runtime direction for controlling session-scale coordination on the interaction path.
- External-validity interpretation contribution: We show that real product manifestations differ across ChatGPT, Claude, and Gemini, implying that benchmark design must account for product strategy.
- Benchmark-design implication: Future benchmarks should model visible transcript length and active-context continuity separately. This is an implication / future-work claim unless a controlled synthetic benchmark is later added.

## Benchmark Axis Boundary

Visible-history vs active-context continuity is currently a benchmark design implication, not a validated benchmark contribution.

Do not present it as a completed benchmark result. If the paper needs stronger evidence, a future minimal synthetic benchmark or P5 impossible-zone benchmark must validate it.

For v0.2, place this axis in Discussion and Future Work, not as a primary contribution.

## Related Systems Positioning Needed

v0.2 must include a compact related systems paragraph or table distinguishing this work from:

- CodeMirror / Monaco / editor-grade text surfaces;
- xterm.js / terminal renderers;
- Zed / GPUI-style app/runtime systems;
- Flutter / React / general UI frameworks;
- document/canvas-first systems such as Google Docs/Figma-style surfaces, if relevant.

The distinction should focus on this point: AI surfaces combine streaming append, tail mutation, long visible transcript, active model context, artifact/card routing, and send/click interaction-critical coordination.

The work is not just a faster text editor or terminal renderer. The contribution is the workload/runtime framing for long-lived AI surfaces.

## Product Naming Policy

Internal docs may name ChatGPT / Claude / Gemini.

The public paper should consider anonymizing Claude/Gemini as System B/System C or presenting them as bounded commercial-system triage, depending on review risk.

Product observations should never rank products or claim exact internal architecture. ChatGPT may remain the high-severity reference case only if wording stays clearly bounded.

## Short Paper Scope Decision

v0.2 should be a short/position paper, not a full systems evaluation paper.

It should not try to include every P0-P3.5 artifact. It should prioritize:

1. workload characterization;
2. runtime abstraction;
3. bounded evidence chain;
4. P3.5 product-strategy-dependent interpretation.

Full paper scope requires future P5/impossible-zone evaluation.

## 4. Section-by-Section Revision Map

| paper section | current likely issue | required revision | evidence to cite | claims allowed | claims forbidden |
|---|---|---|---|---|---|
| Abstract | Strong P0/F0-D/F1/F2 chain, but not yet P3.5-aware or venue-scoped. | Add one sentence that long-session pressure is product-strategy dependent and one sentence that v0.2 is a bounded short-paper argument, not full benchmark proof. | P3.5 external review packet; P3.5 closeout packet; short-paper draft v0. | P3.5 strengthens external-validity framing. | P3.5 is benchmark proof; all systems fail uniformly. |
| Introduction | May read as if DOM/VDOM slowness alone is the target. | Lead with the core workload-architecture mismatch, then introduce the P3.5 qualifier as a product-strategy boundary. | README thesis; P3.5 synthesis; P0 motivation. | Workload is append-heavy, viewport-centric, terminal/editor/log-like. | "DOM/VDOM is simply slow"; WebGPU is the thesis. |
| Motivation / Product Evidence | Product traces may be overread as source-level proof. | Split product motivation into ChatGPT high-severity reference, Claude mechanism-family signal, and Gemini divergence; consider public anonymization for Claude/Gemini. | P0 N-sweep; C0 ChatGPT diagnostic; Claude triage; Gemini triage. | Product traces motivate mechanism and benchmark design. | Exact root cause, exact source ownership, product architecture claims. |
| Workload Characterization | Visible transcript and active model context may be conflated. | Add explicit axes: visible history, active context, surface routing, send/click, scroll/history, background scheduling. | P3.5 synthesis; closeout packet. | Long-session workload includes UI and context-continuity dimensions. | Low INP proves active context continuity. |
| Related Systems | Current paper can sound like a faster editor/terminal/renderer pitch. | Add compact positioning against editors, terminals, app/runtime systems, UI frameworks, and document/canvas-first surfaces. | External review packet; README; short-paper draft. | AI surfaces combine streaming append, tail mutation, active model context, artifact routing, and interaction-critical coordination. | This is just a faster text editor; this replaces all UI frameworks. |
| System Design / Runtime Abstraction | Runtime direction may sound like renderer replacement. | Tie runtime abstraction to coordination control: worker-resident state/fanout, scheduling, bounded projection, context-aware workload model. | P1/P2/P3 controlled evidence; P3 stage freeze. | Runtime controls coordination and projection boundaries. | Production runtime readiness; Canvas/WebGPU necessity. |
| Evaluation / Evidence | Product traces and controlled benchmarks may blur together. | Present three evidence classes separately: product motivation, controlled architecture evidence, P3.5 external-validity interpretation. | P0/P1/P2/P3 evidence chain; C0; Claude/Gemini triage. | Controlled benchmarks support runtime chain; product traces motivate and constrain. | Product traces are publishable controlled benchmark results. |
| Discussion | Missing P3.5 conceptual upgrade and venue-bounded contribution framing. | Add cross-system interpretation and benchmark-axis implication; state that visible-history vs active-context continuity remains future-work until validated. | P3.5 external-validity synthesis; external review packet. | Long-session pressure is product-strategy dependent. | Universal AI-product behavior; completed benchmark-axis contribution. |
| Limitations | Needs new product-strategy, venue, and context-windowing caveats. | Add no exact product architecture, no exact source ownership, opportunistic product observations, no full-paper evaluation claim, no P4 authorization. | Closeout packet; C0; Claude/Gemini triage. | Interpretation-ready, not benchmark-proof. | Gemini solves pressure; Claude is high-severity failure. |
| Future Work | May point too quickly to implementation gates. | Prefer short-paper v0.2 outline/patch and benchmark design; synthetic local accumulation or P5 impossible-zone only if controlled evidence is required. | P3.5 closeout; external review packet. | Future benchmarks model visible history and active-context continuity separately. | P4 can begin; more product testing by default. |

## 5. Abstract Revision Direction

- Problem sentence: long-lived AI surfaces are append-heavy, viewport-centric, long-lived, tail-mutating workloads that expose a mismatch with document/tree-oriented UI stacks.
- Runtime thesis sentence: the proposed direction is worker-resident state/fanout, transaction scheduling, and bounded projection rather than a renderer-first replacement.
- P3.5 cross-system sentence: external product observations suggest symptoms are product-strategy dependent across responsiveness, context fidelity, visible transcript continuity, and coordination cost.
- Evidence boundary sentence: product traces motivate and constrain the thesis, while controlled benchmarks support the runtime mechanism chain.
- Venue/scope sentence: v0.2 is a short/position-style paper argument, not a full systems evaluation paper.
- Next evaluation sentence: future benchmarks should model visible history, active-context continuity, surface routing, and interaction-critical send/click paths.

## 6. Introduction Revision Direction

The introduction should start from long-lived AI surfaces as append-heavy, viewport-centric, terminal/editor/log-like workloads.

It should introduce the mismatch with document/tree-oriented DOM/VDOM stacks as a workload-architecture mismatch, not as a blanket claim that DOM/VDOM is slow.

It should then introduce that external systems reveal different product strategies, not uniform failure. ChatGPT, Claude, and Gemini should be positioned as bounded motivation and external-validity interpretation, not controlled evaluation and not product ranking.

The introduction should make the two-layer thesis explicit: core workload mismatch first; P3.5 product-strategy qualifier second.

## 7. Problem Formulation Revision

The paper should explicitly model these axes:

- visible transcript length;
- active context fidelity;
- append-heavy output;
- send/click interaction path;
- scroll/old-history interaction;
- artifact/card/separate-surface routing;
- background task scheduling;
- main-thread interaction critical path.

These axes should be used to define the workload model and to explain why "DOM length" alone is an insufficient benchmark variable.

The visible-history vs active-context axis should be framed as a design requirement for future benchmarks, not as a completed result.

## 8. Evidence Section Revision

The evidence section should present evidence in separate classes:

- P0 product traces motivate the mechanism family.
- P1/P2/P3 controlled evidence supports the runtime/architecture chain.
- P3.5 product triage refines external-validity interpretation.

Do not merge product traces and controlled benchmarks into one evidentiary class. Product traces are product-bounded, privacy-bounded, and interpretation-oriented. Controlled benchmarks carry the runtime mechanism and architecture claims.

For v0.2, keep the evidence chain compact. A short/position paper should explain why the evidence is enough for a research direction, not pretend it is enough for full systems-paper acceptance.

## 9. Discussion Revision

Add the P3.5 conceptual upgrade:

- ChatGPT: high-severity reference case.
- Claude: same mechanism family, lower subjective severity, stronger context continuity.
- Gemini: responsive divergence with unreliable early-context access.

Conclusion: long-session pressure is product-strategy dependent.

This discussion should make clear that mechanism-family similarity does not imply equal UX severity, and low INP does not imply reliable active-context continuity.

The discussion should also state that benchmark design must eventually separate visible-history continuity from active-context continuity.

## 10. Limitations Revision

The limitations section must include:

- v0.2 is a HotOS/workshop/position-style short paper target, not a full EuroSys/SOSP-style evaluation paper;
- product traces are opportunistic and privacy-bounded;
- no exact source ownership;
- no exact architecture claims for ChatGPT, Claude, or Gemini;
- no universal AI-product claim;
- no P4 authorization;
- product observations are interpretation-ready, not benchmark-proof;
- visible-history vs active-context continuity is a benchmark design implication, not a validated benchmark contribution.

It should also preserve existing limitations around controlled sample size, incomplete production runtime, no broad workload matrix, no multi-urgent stress, no accessibility/focus/caret production model, and no full display-pipeline latency claim.

## 11. Claims to Add

- Product systems differ materially under long-session AI-surface pressure.
- Mechanism-family similarity does not imply equal UX severity.
- Low INP does not imply reliable active-context continuity.
- Future benchmarks must model visible history and active-context continuity.
- Workload-architecture mismatch remains the root framing.
- The v0.2 contribution is workload/runtime framing plus bounded evidence, not full production-system validation.

## 12. Claims to Remove or Avoid

- All AI products fail like ChatGPT.
- Gemini solves the problem.
- Claude is a high-severity UX failure.
- Product traces are controlled benchmark proof.
- Canvas/WebGPU is necessary based on P3.5.
- P4 can begin.
- Exact root cause or source ownership is known.
- Visible-history vs active-context continuity is already validated as a benchmark result.
- The paper is a full EuroSys/SOSP-style evaluation paper.

## 13. Reviewer Objection Coverage

| reviewer objection | paper revision answer | still weak? |
|---|---|---|
| "Is this just ChatGPT?" | No. ChatGPT is the high-severity reference case, but Claude adds a lower-severity non-ChatGPT microtask-path signal and Gemini adds a divergent low-INP / weak-context-continuity case. | Cross-system evidence remains opportunistic, not a controlled product matrix. |
| "Does Gemini disprove the thesis?" | No. Gemini shows responsiveness in this sample, but unreliable early-context access. That supports product-strategy tradeoffs rather than disproving long-session pressure. | Exact Gemini mechanism and architecture are unknown. |
| "Does Claude prove all systems fail?" | No. Claude supports mechanism-family similarity, but lower subjective severity than ChatGPT. | Claude evidence is a bounded sample, not universal proof. |
| "Are these product traces enough?" | They are enough for motivation and external-validity framing, not enough for publishable controlled benchmark proof. | Product-to-controlled mapping remains an evidence boundary. |
| "Where is the controlled evidence?" | Controlled evidence remains P1/P2/P3: F0-D reproduces the mechanism family, F1 tests worker offload, F2 tests worker scheduling, P2/P3 define bounded runtime contracts. | Controlled evidence still does not cover every long-session workload or production product behavior. |
| "Why is WebGPU not the thesis?" | Current evidence points first to state/fanout, scheduling, bounded projection, and context/surface tradeoffs. Renderer backends can be future gates but are not authorized by P3.5. | Future presentation bottlenecks may still justify renderer work under a separate gate. |
| "What exactly will the runtime control that current stacks do not?" | The runtime direction controls worker-resident session state/fanout, transaction scheduling, bounded projection, stale-result rejection, and explicit coordination boundaries. | Production integration, viewport lifecycle, accessibility, and product UI remain future work. |
| "How is this different from existing editor/terminal/document systems?" | Editors and terminals inform the viewport/history model, but long-lived AI surfaces combine streaming append, tail mutation, heterogeneous semantic blocks, active model context, artifact/card routing, and send/click interaction-critical coordination. | Related work needs careful citations and should not caricature mature systems. |
| "How do you know the controlled harness reproduces the product mechanism?" | We do not claim product replay. P0 motivates a mechanism family; F0-D/F1/F2 test controlled analogs of fanout/scheduling/projection. The bridge is mechanism-family, not source-level identity. | Product-to-controlled fidelity remains a limitation until stronger mapping evidence exists. |
| "Why only three products?" | P3.5 uses three bounded commercial-system observations to prevent ChatGPT-only overfitting and to reveal product-strategy divergence. It is external-validity framing, not a population study. | Broader product coverage remains future work. |
| "Are the tradeoff axes independent?" | Not proven. The axes are an analysis frame for benchmark design. Future synthetic/P5 benchmarks should vary visible history and active context separately to test independence. | Independence remains unvalidated until a controlled benchmark exists. |

## 14. P4/P5 Gate Implication

P4 remains not authorized by product traces alone.

P5/impossible-zone design must account for P3.5 tradeoff axes. It should not treat DOM length as the only independent variable.

Any future synthetic benchmark should model visible transcript continuity and active-context continuity separately.

If a full systems paper is the target later, P5/impossible-zone controlled evaluation becomes the likely evidence bridge. For v0.2, this remains future work.

## 15. Recommended Immediate Next Step

Primary:

Write a short-paper v0.2 outline first, then patch the draft.

Reason:

The thesis, venue assumption, contribution claims, and related-systems positioning need to be locked before prose edits. A direct draft patch risks mixing the old v0 paper frame with the new v1.1-quality plan.

Secondary:

If the outline is straightforward, proceed to a targeted short-paper v0.2 patch.

Rejected:

- more product testing;
- P4 implementation;
- runtime coding.

## 16. Final Classification

| field | value |
|---|---|
| `revision_plan_status` | `ready_for_short_paper_v0_2_after_v1_1_patch` |
| `target_paper_type` | `hotos_workshop_position_style_short_paper` |
| `thesis_change` | `core_thesis_refined_with_p3_5_qualifier` |
| `benchmark_axis_status` | `discussion_future_work_until_validated` |
| `related_systems_status` | `required_in_v0_2` |
| `product_naming_status` | `anonymize_or_bound_public_claims` |
| `p4_status` | `not_authorized` |
| `recommended_next` | `short_paper_v0_2_outline_then_patch` |
