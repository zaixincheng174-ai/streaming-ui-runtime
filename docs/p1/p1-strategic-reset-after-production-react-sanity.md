# P1 Strategic Reset After Production React Sanity

This note records a strategic reset for P1 after the `production-react-sanity`
result. It is not a P1 gate pass, not a P2 authorization, and not a claim that
React or conventional DOM approaches are sufficient in general.

## 1. Alignment With P1 Objective

P1 exists to test realistic AI streaming workloads against strong conventional
baselines before any new Streaming UI Runtime work begins. The relevant question
is not whether a hand-written baseline can fail. The question is whether fair,
production-grade baselines also expose a controlled boundary that justifies
runtime-level work.

The immediate P1 objective is therefore reset to Option 0: reproduce key
boundary findings on a production framework baseline before committing to B2,
B3, P2, or harder workload branches.

## 2. What React Sanity Changed

The `production-react-sanity` target ran the same code-heavy tail-follow
workload as the accepted P1-C2a optimized-DOM cell. Cross-baseline equivalence
was verified before capture:

- `token_stream_hash` matched.
- `active_message_source_hash` matched.
- `semantic_block_sequence_hash` matched.
- `code_block_signature_hash` matched.
- `final_rendered_text_hash` matched.

The parity-usable 3-run React sanity sample was clean:

- `long_task_count_50ms=0`.
- No MajorGC-dominant tail was observed.
- `react_closed_code_block_render_count=13`.
- `highlight_call_count=13`.
- `created_highlight_span_count=1184`.

This materially downgrades the generalizability of the P1-B, P1-C, and P1-C2a
mechanism chain. Those findings remain valid for the hand-written optimized-DOM
B1 implementation, but they no longer support broad DOM, VDOM, or runtime claims
unless reproduced on production-grade baselines.

## 3. Prior Findings That Remain Valid

The following findings remain valid within their original scope:

- P0-E showed that a controlled click-triggered batch-commit proxy can produce
  burst-like main-thread pressure.
- P1-A showed that B0 naive DOM is weaker than optimized DOM under the initial
  AI streaming workload.
- P1-B showed that the hand-written optimized-DOM B1 implementation could become
  boundary-positive under code-heavy streaming.
- P1-C showed that disabling syntax highlighting removed that B1 code-heavy
  failure.
- P1-C2a showed that closed-code stable reuse fixed deterministic repeated
  closed-code render, highlight, and span churn in B1.
- Visibility/frame parity work showed that some earlier GC-tail evidence was not
  attribution-clean when frame production was suppressed or the window was not
  parity-usable.

These findings are not discarded. They are now treated as scoped mechanism
evidence, not broad runtime-thesis evidence.

## 4. Prior Findings Downgraded

| Finding | Prior status | Updated status | Reason |
| --- | --- | --- | --- |
| Code-heavy optimized DOM showed boundary pressure | Valid mechanism result | Valid but B1-specific | Production React absorbed the equivalent workload. |
| Highlight/span churn was the key mechanism | Strong for B1 | Downgraded outside B1 | React emitted only 13 highlight calls and stayed clean. |
| Closed-code stable reuse solved the key workload | Strong mitigation result | Valid for B1 only | React already behaved similarly under equivalent semantics. |
| P1-C2a clean result strengthened the runtime thesis | Weak support | No longer sufficient | A production framework baseline also stayed clean. |
| Current code-heavy workload can justify P2 | Blocked | Still blocked | Controlled production-grade evidence is insufficient. |

## 5. Implications For Prior P0/P1 Docs

Prior P0/P1 documents should not be rewritten as if their data is invalid.
However, their interpretation must be read through this reset:

- P1-B and P1-C findings describe a hand-written optimized-DOM implementation
  boundary.
- P1-C2a documents a successful B1 mitigation, not a general browser/runtime
  limit.
- Production-react-sanity is a stronger conventional baseline sanity check for
  this workload family than B1 alone.
- Any future summary must distinguish B1-specific mechanism evidence from
  production-framework evidence.

## 6. Remaining Runtime-Thesis Evidence

After excluding B1-specific findings, controlled runtime-thesis evidence is
currently insufficient.

The remaining evidence is:

- P0-E proxy burst behavior.
- Private product burst observation.
- B0 naive DOM weakness.
- B1 implementation-specific boundary and mitigation history.

That evidence is useful, but it does not yet justify P2. It does not prove that
a new runtime is unnecessary, and it does not prove that the thesis is dead. It
means the controlled evidence is not strong enough after a production framework
baseline absorbed the equivalent code-heavy workload.

## 7. Private Product Burst Observation

The private product burst remains a real and important observation. It motivated
the controlled workload family and still matters.

What is real:

- The private product exhibited burst-like main-thread behavior on a send-path
  pattern.
- The shape motivated click-triggered and streaming controlled workloads.

What has not been reproduced yet:

- The same burst has not been reproduced in a production-grade controlled
  baseline.
- It has not been shown that React, a virtualized DOM baseline, or an
  editor-grade baseline fails under equivalent fair semantics.
- It has not been shown that the private burst requires a new runtime rather
  than a production-framework rendering policy, editor buffer, virtualization,
  or narrower implementation fix.

## 8. Option 0: Production Framework Reproduction

Option 0 is the mandatory next gate.

The next P1 step is not B2, B3, P2, allocation probing, or more B1 defensive
refinement. The next step is to reproduce or fail to reproduce key P1 findings
on a production framework baseline.

Required reproduction targets:

1. React baseline reproduction of P1-A style standard streaming.
2. React baseline reproduction of P1-B code-heavy stress.
3. React baseline reproduction of P1-C style mechanism checks only if a fair
   React boundary appears.
4. Harder but fair React workload ladder, if needed:
   - `history_messages=500`.
   - `history_messages=1000`.
   - code-heavy variants.
   - tool-heavy and markdown-heavy variants only with clear semantic parity.

The target question is specific: can production React reproduce burst or boundary
behavior under fair AI-streaming semantics, or did the prior mechanism chain
depend on the hand-written B1 implementation?

## 9. Decision Options After Option 0

If React remains robust under reasonable harder workloads:

- Pause the runtime thesis.
- Redesign workload and baseline strategy.
- Do not proceed to P2 from B1-specific evidence.

If React becomes boundary-positive under equivalent fair workload:

- Restore controlled support for the runtime thesis.
- Preserve the B1 mechanism chain as supporting evidence.
- Proceed to B2 and B3 planning before P2.

If React results are mixed:

- Add only targeted attribution for the production React boundary.
- Do not generalize from a single weak or non-parity result.
- Do not enter P2 until B2/B3 and attribution have been considered.

## 10. Commit Criteria For P2

P2 becomes eligible only when all of the following are true:

- A production-grade baseline becomes boundary-positive under a fair,
  equivalence-checked workload.
- The result is parity-usable and visible-foreground clean.
- Runtime marks, workload hashes, and final output checks are complete.
- The failure is not explained by an obvious baseline implementation flaw.
- B2 virtualization and B3 editor-grade or text-buffer baselines have been
  evaluated or explicitly deferred with written justification.
- The private product burst is reproduced in a controlled production baseline,
  or a tight mechanism bridge is documented.

P2 remains blocked until those criteria are met.

## 11. Sunk Cost Honesty

P1-B, P1-C, and P1-C2a were not wasted. They found and fixed a real mechanism in
the hand-written optimized-DOM baseline. They also improved capture validity,
mark coverage, equivalence discipline, and foreground/frame parity handling.

The sunk-cost risk is using those valid local findings to support claims they no
longer carry. The React sanity result means the next move must be offensive
reproduction on production baselines, not more defensive refinement of B1.

## 12. Explicitly Blocked Steps

The following are blocked until Option 0 is resolved:

- P2 runtime implementation.
- Claims that React wins.
- Claims that a new runtime is unnecessary.
- Claims that the runtime thesis is dead.
- Claims that P1 has passed.
- Allocation probe work.
- New B1 mitigation work.
- Input probe expansion.
- Scrollback expansion.
- B2 virtualization implementation.
- B3 CodeMirror or Monaco implementation.
- Harder workload escalation that is not tied to Option 0.

## 13. Reviewer Objections And Responses

Objection: The React sanity sample is only 3 runs.

Response: Correct. It is not a P1 gate pass. It is strong enough to downgrade
general claims from B1-specific failures and require Option 0 before broader
claims.

Objection: The private product still showed a burst.

Response: Correct. The private burst remains important, but it has not been
reproduced in a production-grade controlled baseline.

Objection: React may fail under harder workload.

Response: That is exactly what Option 0 must test. The current workload is no
longer enough.

Objection: This delays P2.

Response: Yes. P2 without production-framework reproduction would be
under-justified.

Objection: B1 findings should still matter.

Response: They do matter as scoped mechanism evidence. They do not currently
carry broad DOM, VDOM, or runtime-thesis claims.

## 14. Final Recommendation

Proceed with Option 0 as the mandatory next gate. Reproduce key P1 findings on
the production React baseline before starting B2, B3, allocation probes, harder
random stress, or P2.

The current code-heavy tail-follow workload no longer justifies P2. The thesis
is not dead, and runtime work is not ruled out. The evidence standard has moved:
future runtime claims must survive production-grade conventional baselines under
equivalent fair workloads.
