# P3.5 External-Validity Synthesis v0

## 1. Purpose

This document synthesizes P3.5 external-validity findings after C0, Gemini triage, and Claude triage. It is not a new measurement result and does not authorize P4.

The purpose is to preserve the cross-system interpretation boundary: ChatGPT, Claude, and Gemini now show different product/runtime tradeoff shapes rather than one uniform long-session failure mode.

## 2. Phase Alignment

- We are in P3.5.
- ChatGPT same-family collection has stopped.
- P4 is not started.
- This synthesis is for interpretation and next-step control only.
- It does not create publishable benchmark evidence.
- It does not authorize captures, browser automation, script changes, benchmark changes, runtime implementation, Canvas work, or WebGPU work.

## 3. System-Level Summary

| system | role in evidence | interaction result | mechanism signal | context / memory signal | UX severity | classification |
|---|---|---|---|---|---|---|
| ChatGPT | primary reference / strong symptom case | existing long sessions clearly worse | microtask / multi-bundle / mixed product pressure | stronger long-session continuity assumed from prior use, but not the focus here | high | high_severity_reference_case |
| Claude | non-ChatGPT mechanism-family signal | existing-long INP 312 ms; fresh second turn INP 96 ms | Run microtasks dominant in existing-long, smaller in fresh second turn | strong context continuity observed | low subjective lag despite moderate DevTools signal | same_family_lower_severity |
| Gemini | divergence case | existing-long INP 112 ms, processing 15 ms | Run microtasks tiny / not dominant | early visible context unreliable / unavailable | low | responsive_context_windowing_divergence |

## 4. Main Finding

Long-session AI surfaces do not fail uniformly.

The evidence now suggests three different product/runtime tradeoff shapes:

1. ChatGPT: high-severity user-visible degradation under long-session pressure.
2. Claude: similar microtask/app-coordination mechanism family, but lower subjective severity and stronger context continuity.
3. Gemini: responsive interaction path, but unreliable early-context access, suggesting product-level context/windowing divergence.

## 5. Mechanism vs Severity

Mechanism-family similarity is not the same as UX severity.

Claude shows a Run-microtasks-heavy send/click path, but user experience was acceptable in this sample. ChatGPT remains the stronger subjective degradation case, with prior samples repeatedly reaching roughly 600-800+ ms INP and obvious subjective lag.

Therefore, Claude should not be collapsed into "Claude is also badly laggy." The better classification is: Claude is a non-ChatGPT mechanism-family signal, not a non-ChatGPT high-severity UX degradation case.

## 6. Context Continuity as a Tradeoff Axis

Gemini's low interaction cost may be partly related to active-context/windowing differences. Visible transcript continuity should not be assumed equivalent to active model-context continuity.

Claude appears to preserve or access context/memory more strongly, but may pay more app-coordination cost. This introduces a key tradeoff axis:

- interaction responsiveness;
- active context fidelity;
- visible transcript continuity;
- app-side coordination cost.

## 7. What This Supports

- ChatGPT is not the only system with product-side interaction pressure signals.
- Claude provides a non-ChatGPT microtask-path signal.
- Gemini shows a divergent product strategy where low INP coexists with unreliable early-context recall.
- External systems differ materially, so the benchmark/workload model must include product architecture differences.
- Future synthetic benchmarks should model both long visible history and active-context continuity.

## 8. What This Does Not Prove

- Universal AI-product behavior.
- Exact product implementation.
- Exact minified source ownership.
- That Gemini solves long-session pressure.
- That Claude is a high-severity UX failure.
- That ChatGPT evidence alone generalizes.
- That Canvas/WebGPU is now authorized or necessary.
- That P4 can start.
- That all systems fail the same way.

## 9. P3.5 Decision

- Stop further same-family ChatGPT collection.
- Do not continue opportunistic Gemini/Claude testing unless a new clear symptom or question appears.
- Do not enter P4 yet from these product traces alone.
- Next best step is a compact P3.5 closeout / paper-facing evidence synthesis, or a synthetic local accumulation fallback if controlled evidence is needed.

## 10. Final Classification

| field | value |
|---|---|
| `chatgpt_status` | `high_severity_reference_case` |
| `claude_status` | `same_mechanism_family_lower_subjective_severity` |
| `gemini_status` | `responsive_divergence_with_unreliable_early_context` |
| `cross_system_conclusion` | `long_session_pressure_is_product_strategy_dependent` |
| `main_tradeoff_axis` | `responsiveness_vs_context_fidelity_vs_coordination_cost` |
| `p4_status` | `not_authorized` |
| `recommended_next` | `p3_5_closeout_or_synthetic_fallback` |
