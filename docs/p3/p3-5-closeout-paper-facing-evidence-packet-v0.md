> **Status:** Historical / superseded draft.
> This document is retained for project history and should not be read as the current claim boundary. For current public-facing claims, start with `README.md` and `docs/portfolio/document-status-map.md`.

# P3.5 Closeout / Paper-Facing Evidence Packet v0

## 1. Purpose

This packet closes the current P3.5 external-validity branch and summarizes what can and cannot be claimed after ChatGPT C0, Gemini triage, Claude triage, and the external-validity synthesis.

It is a synthesis/control document for paper-facing review, an external review packet, or future P4 gate discussion. It is not a new result, not a new measurement, and not P4 authorization.

## 2. Current Project Position

- P3 implementation is frozen after P3-L.
- Active work was P3.5 external validity / diagnostic interpretation.
- P4 is not started.
- This packet does not authorize P4 by itself.
- Product traces and opportunistic DevTools observations are evidence for framing and external-validity interpretation, not controlled benchmark proof.

## 3. Evidence Inventory

| evidence item | source doc | evidence type | supports | boundary |
|---|---|---|---|---|
| P0 product traces / ownership decomposition | `docs/p0/p0-product-n-sweep-analysis.md`; `docs/p0/p0-product-click-ownership-decomposition.md` | Product trace motivation / ownership decomposition | Long-session and richer ChatGPT product rows show click/pointerup into `Run microtasks`, scripting-heavy processing, and multi-bundle coordination. | Not raw replay-grade proof, not exact source ownership, not exact minified-function semantics, not controlled benchmark evidence, and not Canvas/WebGPU necessity. |
| C0 ChatGPT diagnostic result | `docs/p3/p3-5-c0-existing-chatgpt-long-session-devtools-diagnostic-result-v0.md` | Privacy-bounded product diagnostic | Existing long ChatGPT session was clearly heavier than a fresh empty typing proxy; ChatGPT remains the primary reference / strong symptom case. | `valid_lower_confidence`; mechanism `mixed_or_inconclusive`; does not isolate root cause, authorize P4, or justify more same-family ChatGPT collection. |
| Post-C0 direction decision | `docs/p3/p3-5-post-c0-direction-decision-v0.md` | Direction decision | Stops same-family ChatGPT collection and chooses Claude/Gemini external-validity follow-up, with synthetic accumulation as fallback. | Not a measurement result, not a performance claim, not runtime authorization, and not P4 authorization. |
| Gemini existing-long triage | `docs/p3/p3-5-gemini-existing-long-session-triage-result-v0.md` | Opportunistic existing-long external-validity triage | Gemini showed low INP / low processing in the observed window while early-context recall was unreliable or unavailable. | Not a clean negative result; does not prove Gemini solves long-session pressure, exact architecture, source ownership, or artifact/card adequacy. |
| Claude existing-long/fresh-send triage | `docs/p3/p3-5-claude-existing-long-session-triage-result-v0.md` | Opportunistic existing-long plus fresh-send triage | Claude showed a non-ChatGPT microtask-path signal with lower subjective severity than ChatGPT and stronger context continuity. | Does not prove Claude is a high-severity UX failure, exact root cause, exact architecture, or universal AI-product behavior. |
| P3.5 external-validity synthesis | `docs/p3/p3-5-external-validity-synthesis-v0.md` | Cross-system synthesis / interpretation control | Long-session pressure is product-strategy dependent across ChatGPT, Claude, and Gemini. | Not a new result, not publishable benchmark evidence, not P4 authorization, and not proof that all systems fail the same way. |

## 4. Cross-System Finding

Long-session AI surfaces do not fail uniformly.

Three-system classification:

- ChatGPT: high-severity user-visible degradation reference case.
- Claude: same microtask/app-coordination mechanism family, lower subjective severity, stronger context continuity.
- Gemini: responsive low-INP divergence with unreliable early-context access.

## 5. Mechanism, Severity, and Context Are Separate Axes

P3.5 separates:

- mechanism-family signal;
- subjective UX severity;
- visible transcript continuity;
- active model-context fidelity;
- product scheduling / task slicing / surface routing.

Claude shows mechanism-family similarity without ChatGPT-level subjective severity. Gemini shows low observed interaction cost but weak early-context reliability. ChatGPT remains the strongest high-severity user-visible case.

## 6. Paper-Facing Claims Allowed

Allowed:

- Product systems differ materially under long-session AI-surface pressure.
- ChatGPT provides the strongest high-severity reference symptom.
- Claude provides a non-ChatGPT microtask-path signal at lower subjective severity.
- Gemini provides a divergence case where low INP coexists with unreliable early-context access.
- Long-session UI pressure must be modeled together with context/windowing and surface-routing strategy.
- Future benchmarks should model both visible long history and active-context continuity.

## 7. Claims Not Allowed

- Universal AI-product behavior.
- Exact root cause.
- Exact source ownership.
- Exact implementation of Claude, Gemini, or ChatGPT.
- Gemini solves long-session pressure.
- Claude is a high-severity UX failure.
- Product traces are publishable controlled benchmark results.
- P4 is authorized.
- Canvas/WebGPU necessity is proven.
- All systems fail the same way.

## 8. Implication for Benchmark Design

Future synthetic/local benchmarks should not only model DOM length. They should model:

- visible transcript length;
- active context size / recall fidelity;
- append-heavy output;
- send/click interaction path;
- scroll/old-history interaction;
- artifact/card/separate-surface routing;
- background task scheduling;
- main-thread interaction critical path.

## 9. Recommended Next Step

Primary:

P3.5 closeout complete, then prepare paper-facing external review packet / short-paper revision.

Secondary fallback:

If controlled evidence is required before P4, design a synthetic local accumulation fallback.

Rejected for now:

- more same-family ChatGPT collection;
- more opportunistic Gemini/Claude testing without a new specific question;
- P4 implementation;
- runtime coding.

## 10. Final Classification

| field | value |
|---|---|
| `p3_5_status` | `closeout_ready_after_packet` |
| `chatgpt_status` | `high_severity_reference_case` |
| `claude_status` | `same_mechanism_family_lower_subjective_severity` |
| `gemini_status` | `responsive_divergence_with_unreliable_early_context` |
| `cross_system_conclusion` | `long_session_pressure_is_product_strategy_dependent` |
| `paper_claim_status` | `interpretation_ready_not_benchmark_proof` |
| `p4_status` | `not_authorized_from_product_traces_alone` |
| `recommended_next` | `paper_facing_external_review_packet_or_short_paper_revision` |
