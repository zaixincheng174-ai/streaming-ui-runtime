> **Status:** Privacy-bounded triage note.
> This document contains sanitized, bounded observations only. It is not raw product trace evidence, not product ranking, and not current production-readiness evidence.

# P3.5 Gemini Existing Long-Session Triage Result v0

## 1. Purpose

This document records an opportunistic Gemini existing-long-session external-validity triage after the post-C0 direction decision.

The user used an existing long Gemini conversation rather than attempting to build a new 100-turn session. The goal was to test whether Gemini shows ChatGPT-like long-session interaction degradation under real-product conditions.

## 2. Phase Alignment

- We are in P3.5.
- ChatGPT same-family collection has stopped.
- This does not authorize P4.
- This is not a controlled benchmark or publishable performance result.
- This note does not authorize captures, browser automation, script changes, benchmark changes, or runtime implementation.

## 3. Privacy Boundary

- No raw traces entered the repo.
- No screenshots entered the repo.
- No private content was copied into this note.
- No URLs, account IDs, or message IDs are included.
- Only sanitized timing and qualitative observations are recorded.

## 4. DevTools Observation

- Existing long Gemini session send/pointer interaction was observed.
- INP: 112 ms.
- Input delay: 63 ms.
- Processing duration: 15 ms.
- Presentation delay: 35 ms.
- CLS: 0.02.
- Many red long-task markers were visible in the trace, but the selected interaction path showed low INP.
- One selected task was approximately 76.7 ms total, dominated by Commit around 75.5 ms, with Paint around 0.7 ms, Animation frame fired around 0.4 ms, and tiny Layerize / Hit test rows.
- Another visible larger task showed Timer fired around 386.9 ms, Function call around 384.4 ms, and Run microtasks around 2.4 ms.
- Bottom-up showed mostly unattributed / Gemini gstatic BardChat bundle labels with tiny per-bundle rows in one view.
- Run microtasks was visible but tiny, not comparable to the prior ChatGPT large Run-microtasks cascade.
- Subjectively, there was no clear user-visible lag in this sample.

## 5. Context / Memory Probe

- The user asked Gemini whether it remembered earlier content in the same long conversation.
- Gemini initially produced confident but incorrect / recent-context-based recall, including "Cycle 01" and a placeholder-induced fabricated section involving "[PASTE_SYNTHETIC_PHRASE]".
- After a stricter exact-match visible-history recall probe, Gemini answered: "I cannot reliably access that earlier context."
- Interpretation: early visible transcript content was not reliably accessible as active model context in this sample.

## 6. Interpretation

Gemini did not reproduce ChatGPT-like high-INP / large Run-microtasks send interaction degradation in this sample.

This is not a clean negative result. It should be treated as a product-strategy / architecture-divergence case, not as evidence that Gemini has no long-session degradation.

Low interaction cost may be associated with different scheduling, task slicing, rendering, windowing, surface routing, and/or active-context truncation. Visible transcript continuity should not be assumed equivalent to reliable active model-context continuity.

## 7. What This Supports

- Gemini existing-long sample remained interaction-responsive in the observed send/pointer window.
- Many red tasks did not necessarily imply high INP.
- Run microtasks was not a dominant owner in this sample.
- Gemini's early-context recall was unreliable/unavailable.
- Cross-system behavior differs from ChatGPT.

## 8. What This Does Not Prove

- Gemini has no long-session degradation.
- Gemini is superior.
- Exact Gemini implementation or architecture.
- Source ownership.
- Artifact/card/PDF surfaces solve the problem.
- Publishable performance evidence.
- P4 eligibility.
- Context truncation is the only explanation.

## 9. Final Classification

| field | value |
|---|---|
| `system` | `Gemini` |
| `sample_type` | `existing_long_session_opportunistic_triage` |
| `interaction_result` | `responsive_low_inp` |
| `chatgpt_like_microtask_cascade` | `not_observed` |
| `run_microtasks_role` | `tiny_visible_not_dominant` |
| `context_recall_result` | `unreliable_or_unavailable_for_early_history` |
| `external_validity_signal` | `architecture_or_product_strategy_divergence` |
| `devtools_target_for_followup` | `none_yet` |
| `recommended_next` | `record_result_then_decide_claude_or_synthetic_fallback` |
