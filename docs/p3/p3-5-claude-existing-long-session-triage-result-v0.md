> **Status:** Privacy-bounded triage note.
> This document contains sanitized, bounded observations only. It is not raw product trace evidence, not product ranking, and not current production-readiness evidence.

# P3.5 Claude Existing Long-Session Triage Result v0

## 1. Purpose

This document records a concise Claude existing-long plus fresh-send baseline external-validity triage after the post-C0 direction decision.

The goal was to test whether a non-ChatGPT AI product shows interaction-critical send/click pressure in a long-session setting, while preserving the boundary that this is a sanitized triage note, not a controlled benchmark.

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

## 4. Claude Existing-Long Send/Click Observation

- Existing-long send/click INP: 312 ms.
- Input delay: 14 ms.
- Processing duration: 263 ms.
- Presentation delay: 36 ms.
- CLS: 0.20.
- Event click / pointerup was around 261-267 ms.
- Run microtasks was around 253.6 ms and dominant in the selected path.
- Nested anonymous was around 226.5 ms.
- Bottom-up showed unattributed around 127-132 ms, `vendor-Ds81Zvrw.js` around 101-105 ms, and `index-D6ODg8pU.js` around 18-21 ms.
- Secondary contributors included Recalculate style around 70.2 ms, `clearTimeout` around 17.6 ms, Minor GC around 11.6 ms, and Layout around 6.7 ms.

## 5. Claude Fresh/New First-Turn Observation

- The same prompt class was used in a fresh/new Claude conversation.
- Claude invoked cross-conversation/project memory, including QBO-related memory.
- INP was about 229 ms.
- This observation is lower-confidence because the full decomposition was not captured.
- Boundary: the new Claude conversation was not stateless when cross-conversation memory activated.

## 6. Claude Fresh/New Second-Turn Observation

- Fresh/new second-turn INP: 96 ms.
- Input delay: 13 ms.
- Processing duration: 46 ms.
- Presentation delay: 36 ms.
- Event pointerup was around 48.4 ms.
- Run microtasks was around 41.6 ms.
- The send/click path still showed Run microtasks, but at much smaller scale than the existing-long observation.

## 7. Subjective UX Severity Boundary

- The user did not perceive clear lag in the Claude existing-long sample despite the 312 ms INP.
- Claude's observed delay was much lower-severity than prior ChatGPT samples, where INP repeatedly reached roughly 600-800+ ms with obvious subjective delay.
- Therefore Claude should be treated as a microtask-mechanism signal with low subjective UX severity in this sample, not as a second high-severity degradation case.
- Low input delay and fast visible feedback may explain why the user experience remained acceptable despite the DevTools processing cost.

## 8. Context Recall

Claude could clearly recall prior context / memory in this sample, unlike the Gemini existing-long sample where early visible context was not reliably accessible as active model context.

This supports treating interaction responsiveness and context continuity as a possible tradeoff axis rather than assuming that visible transcript length, active model context, memory access, and send-path cost move together in the same way across products.

## 9. Interpretation

Claude provides a non-ChatGPT external-validity signal for interaction-critical microtask/app-coordination pressure.

The signal is mechanism-family positive but UX-severity lower than ChatGPT. The existing-long observation is a moderate DevTools signal, not a strong subjective-lag signal, and should not be phrased as "Claude is also clearly laggy."

The existing-long observation showed Run microtasks dominant in the selected send/click path. The fresh/new second-turn observation shows that Claude's send/click path may normally include small Run-microtasks work, while long/context-rich/memory-rich conditions can amplify the cost.

The fresh/new first-turn observation suggests that cross-conversation memory and active context can affect send-path cost, but this remains a suspected amplifier rather than an isolated cause. The first-turn sample is lower-confidence because the full decomposition was not captured.

## 10. What This Supports

- Claude existing-long showed a moderate DevTools INP / processing signal, but not clear subjective UX degradation.
- The existing-long selected path showed a dominant Run-microtasks segment.
- Claude supports cross-system mechanism-family similarity.
- Claude does not support claiming ChatGPT-level severity.
- Claude's fresh/new second turn was responsive, suggesting the microtask path exists at smaller scale even in short-session send flows.
- Cross-conversation/project memory may affect send-path cost.
- Claude showed strong context continuity in this sample.
- Cross-system behavior differs from ChatGPT and Gemini in ways that matter for P3.5 external-validity synthesis.

## 11. What This Does Not Prove

- Universal AI-product behavior.
- Claude is worse or better overall.
- Claude has ChatGPT-level subjective degradation.
- Claude is a second high-severity UX failure case.
- 312 ms INP necessarily implies user-visible lag.
- Exact Claude implementation or architecture.
- Exact source ownership.
- Exact root cause.
- Cross-conversation memory is the only explanation.
- Publishable benchmark evidence.
- P4 eligibility.

## 12. Final Classification

| field | value |
|---|---|
| `system` | `Claude` |
| `sample_type` | `existing_long_plus_fresh_send_baseline_triage` |
| `existing_long_interaction_result` | `moderate_devtools_signal_subjectively_responsive` |
| `fresh_second_turn_result` | `responsive_low_inp` |
| `chatgpt_like_microtask_cascade` | `observed_in_existing_long` |
| `run_microtasks_role` | `dominant_existing_long_small_fresh_second_turn` |
| `ux_severity` | `low_subjective_lag_in_this_sample` |
| `comparison_to_chatgpt` | `same_mechanism_family_lower_severity` |
| `mechanism_signal` | `positive_microtask_path_signal` |
| `severity_signal` | `not_chatgpt_level` |
| `cross_memory_effect` | `suspected_first_turn_amplifier` |
| `context_recall_result` | `strong_context_continuity_observed` |
| `external_validity_signal` | `supports_cross_system_microtask_pressure_with_lower_ux_severity_and_context_tradeoff` |
| `recommended_next` | `record_result_then_synthesize_p3_5_external_validity` |
