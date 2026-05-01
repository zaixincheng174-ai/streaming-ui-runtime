# P3.5 External Review Packet v0

## 1. Purpose

This packet is for external review / paper-facing interpretation after P3.5 closeout.

It is not a benchmark result, not a new measurement, and not P4 authorization. It translates the current thesis, controlled evidence chain, P3.5 cross-system findings, allowed claims, disallowed claims, and next paper revision direction into reviewer-readable form.

## 2. Current Thesis

Current AI long-session surfaces are append-heavy, viewport-centric, long-lived, and increasingly terminal/editor/log-like, while many browser UI stacks remain document/DOM/VDOM-oriented.

The core issue is workload-architecture mismatch, not simply "one product is slow." The paper thesis should stay centered on long-lived AI-surface workload shape, action-triggered app coordination, bounded projection, scheduling, and context/surface strategy.

## 3. Current Evidence Chain

| stage | evidence | role | boundary |
|---|---|---|---|
| P0 product motivation / ownership decomposition | Product traces, N-sweep analysis, and ownership decomposition showing `click/pointerup -> Run microtasks` / multi-bundle coordination. | Motivates the action-triggered app-coordination mechanism family. | Product motivation only; not source replay, exact ownership, root-cause proof, or publishable controlled benchmark evidence. |
| P1/P2/P3 controlled architecture evidence | F0-D controlled fanout reproduction, F1 Worker offload, F2 Worker scheduling, P2 pure core, and P3 frozen Worker/projection/rendering/transaction/commit-cycle boundaries. | Provides controlled architecture evidence for worker-resident state/fanout, transaction scheduling, bounded projection, and fail-closed runtime contracts. | Not production runtime, not product integration, not broad workload proof, not Canvas/WebGPU necessity. |
| P3.5 C0 ChatGPT diagnostic | Existing long ChatGPT session was clearly heavier than a fresh empty typing proxy, with C0 classified as `valid_lower_confidence` and mechanism `mixed_or_inconclusive`. | Keeps ChatGPT as the high-severity reference / strong symptom case. | Product diagnostic only; not root-cause proof, not same-family collection mandate, not P4 authorization. |
| P3.5 Gemini existing-long triage | Existing-long Gemini sample showed low INP / low processing, but unreliable or unavailable early-context recall. | Provides a product-strategy divergence case. | Does not prove Gemini solves long-session pressure or reveal exact architecture. |
| P3.5 Claude existing-long/fresh-send triage | Claude showed a non-ChatGPT microtask-path signal, lower subjective severity than ChatGPT, and stronger context continuity. | Provides a same-mechanism-family, lower-severity external-validity signal. | Does not prove Claude is a high-severity UX failure or reveal exact root cause. |
| P3.5 external-validity synthesis / closeout | Cross-system synthesis across ChatGPT, Claude, and Gemini. | Establishes that long-session pressure is product-strategy dependent and that benchmarks must model context/windowing and surface routing. | Interpretation-ready, not benchmark proof; does not authorize P4. |

## 4. P3.5 Cross-System Finding

Long-session AI surfaces do not fail uniformly.

Classification:

- ChatGPT: high-severity user-visible degradation reference case.
- Claude: same microtask/app-coordination mechanism family, lower subjective severity, stronger context continuity.
- Gemini: responsive low-INP divergence with unreliable early-context access.

## 5. Key Conceptual Upgrade

P3.5 separates these axes:

- mechanism-family signal;
- subjective UX severity;
- visible transcript continuity;
- active model-context fidelity;
- product scheduling / task slicing / surface routing;
- app-side coordination cost.

Mechanism similarity does not imply equal UX severity. Claude can support the microtask/app-coordination mechanism family without becoming a second ChatGPT-level subjective lag case.

Low INP does not imply full active-context continuity. Gemini can remain interaction-responsive in the observed window while early visible context is not reliably accessible as active model context.

## 6. Safe Paper-Facing Claims

- Product systems differ materially under long-session AI-surface pressure.
- ChatGPT is the strongest high-severity reference symptom.
- Claude gives a non-ChatGPT microtask-path signal at lower subjective severity.
- Gemini gives a divergence case where low INP coexists with unreliable early-context access.
- Future benchmarks should model visible history, active context continuity, and surface routing, not just DOM length.
- P3.5 strengthens external-validity framing but does not replace controlled benchmarks.

## 7. Claims Not Allowed

- Universal AI-product behavior.
- Exact root cause.
- Exact source ownership.
- Exact internal architecture of ChatGPT / Claude / Gemini.
- Gemini solves long-session pressure.
- Claude is a high-severity UX failure.
- Product traces are publishable controlled benchmark results.
- P4 is authorized.
- Canvas/WebGPU necessity is proven.
- All systems fail the same way.

## 8. Reviewer Objections and Answers

| objection | answer | remaining weakness |
|---|---|---|
| "Is this just ChatGPT?" | No. ChatGPT remains the high-severity reference case, but Claude provides a non-ChatGPT microtask-path signal and Gemini provides a divergent low-INP / weak-context-access case. P3.5 shows product-strategy dependence, not universal behavior. | External-validity evidence is still opportunistic and product-bounded rather than controlled across all systems. |
| "Are you comparing apples to apples?" | Not as controlled benchmarks. The comparison is interpretive: same broad long-session surface class, different product strategies and observed tradeoffs. The paper should use this to refine benchmark design, not to rank products. | Workload, account state, memory behavior, and product routing differ across systems. |
| "Are product traces enough for a systems claim?" | Product traces motivate and constrain the thesis; they do not replace controlled evaluation. The systems claim must rest on the controlled P1/P2/P3 evidence chain plus clearly bounded product motivation. | Product-to-controlled mapping remains imperfect and should be stated as a limitation. |
| "Does Gemini disprove the thesis?" | No. Gemini shows low observed interaction cost in this sample, but also unreliable early-context access. That supports a tradeoff axis between responsiveness, active context fidelity, visible transcript continuity, and coordination cost. | The exact Gemini mechanism is unknown, and this is not proof of stability under all long-session pressures. |
| "Does Claude prove all systems fail?" | No. Claude supports mechanism-family similarity, but lower subjective severity than ChatGPT. It is not a second high-severity UX failure case. | The Claude sample is not a controlled broad workload matrix. |
| "Why not start P4 now?" | P4 is not authorized by product traces alone. P3.5 improves paper-facing external-validity framing, but it does not provide production renderer, viewport manager, scheduler, or WebGPU authorization. | A future P4 gate still needs a separate plan and acceptance criteria. |

## 9. Implication for Next Paper Revision

The paper / short paper should be revised to emphasize:

- workload-architecture mismatch;
- product-strategy-dependent pressure;
- separation between interaction responsiveness and active-context fidelity;
- need for synthetic/local benchmarks that include visible history and active-context continuity;
- no claim that WebGPU is the thesis.

## 10. Recommended Next Step

Primary:

Paper-facing short-paper revision / external review packet refinement.

Secondary:

Synthetic local accumulation fallback only if a controlled evidence gap blocks the next paper revision.

Rejected for now:

- further same-family ChatGPT collection;
- opportunistic Claude/Gemini testing without a new specific question;
- P4 implementation;
- runtime coding.

## 11. Final Classification

| field | value |
|---|---|
| `packet_status` | `ready_for_external_review` |
| `p3_5_status` | `closeout_complete` |
| `paper_claim_status` | `interpretation_ready_not_benchmark_proof` |
| `cross_system_conclusion` | `long_session_pressure_is_product_strategy_dependent` |
| `main_tradeoff_axis` | `responsiveness_vs_context_fidelity_vs_coordination_cost` |
| `p4_status` | `not_authorized` |
| `recommended_next` | `short_paper_revision_v0_2` |
