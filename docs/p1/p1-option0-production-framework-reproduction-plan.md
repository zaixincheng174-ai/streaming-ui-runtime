# P1 Option 0 Production Framework Reproduction Plan

## Purpose

Option 0 is the next offensive P1 gate. It is not another defensive refinement
of the hand-written optimized-DOM baseline. Its purpose is to verify whether key
P1 findings reproduce on a production framework baseline before proceeding to
B2, B3, P2, or broader workload escalation.

The immediate question is narrow: can production-grade React reproduce the burst
or boundary behavior that appeared in the B1/P1-C chain under fair, equivalent,
visible-foreground measurement conditions?

## Current Evidence State

The B1 optimized-DOM failure chain was real. Code-heavy streaming exposed
boundary behavior in the hand-written optimized-DOM baseline, and P1-C2a
closed-code-stable-reuse fixed deterministic repeated closed-code render,
highlight, and span churn in that baseline.

Under parity-usable visible foreground conditions, the accepted P1-C2a sample
set was 5/5 clean. That established that the targeted B1 mitigation fixed the
specific over-rendering mechanism.

The production React sanity target then ran an equivalent code-heavy tail-follow
workload. Equivalence was established through matching:

- `token_stream_hash`
- `active_message_source_hash`
- `semantic_block_sequence_hash`
- `code_block_signature_hash`
- `final_rendered_text_hash`

The production React 3-run sample was parity-usable and clean:

- `long_task_count_50ms=0`
- no MajorGC-dominant tail
- `react_closed_code_block_render_count=13`
- `highlight_call_count=13`
- `created_highlight_span_count=1184`

This materially increases B1 strawman risk. The current code-heavy tail-follow
cell no longer supports P2 by itself.

## Why Option 0 Is Mandatory

B2, B3, or P2 before production-framework reproduction would build on downgraded
B1 evidence. That would treat an implementation-specific hand-written baseline
failure as a broad DOM, VDOM, or runtime limitation before that claim survives a
production framework baseline.

Option 0 tests whether private/product-like burst patterns can be reproduced in
a production-grade controlled baseline. It is a gate, not one path among many.

## Scope

Allowed:

- production-react-sanity follow-up experiments
- parity-usable visible foreground capture protocol
- equivalent workload hashes
- fair harder workload ladders
- no-capture equivalence audits before capture

Blocked:

- P2 runtime
- Canvas, WebGPU, or runtime implementation
- allocation_probe
- new mitigation work
- input_probe or scrollback unless separately justified
- B2 or B3 implementation before the Option 0 decision

## Baseline Contract

The production framework baseline must satisfy:

- React 18 production build
- local vendored dependencies only
- no runtime CDN
- no Babel or bundler unless separately approved
- no `useDeferredValue`, Suspense, transition, or deferred rendering in first
  cells
- stable keys
- `React.memo` where appropriate
- no token coalescing
- no future output pre-render
- same P1 capture marks
- same visibility/frame parity gate

These requirements prevent the baseline from being either artificially weakened
or allowed to change the workload semantics.

## Measurement Validity Gate

A sample is measurement-valid only if:

- `visibility_frame_probe_status=ok`
- `stream_frame_parity_status=pass`
- `visibility_frame_parity_status=pass` or `pass_with_warning`
- `final_token_count=800`
- `token_800_present=true`
- no required marks are missing
- `p0:capture:end` is observed

Parity-fail samples are excluded from performance and allocation attribution.
This is measurement validity control, not cherry-picking. Hidden-window,
suppressed-frame, or missing-end samples do not provide comparable evidence
about workload behavior.

## Equivalence Gate

Before any capture:

- `token_stream_hash` must match where comparing the same workload.
- `active_message_source_hash` must match.
- `semantic_block_sequence_hash` must match.
- `code_block_signature_hash` must match.
- `final_rendered_text_hash` definition must be documented.
- `stream_code_block_count` and `stream_code_line_count` must match.
- `future_output_pre_rendered=false`.

If equivalence fails, capture is blocked until equivalence is repaired.

## Option 0 Experiment Ladder

### O0-A: React Standard Tail-Follow Reproduction

Purpose:

Confirm production React handles the standard streaming workload under the
parity gate.

Config:

- `baseline_id=production-react-sanity`
- `history_messages=160`
- `content_mix=standard`
- `scenario_mode=tail-follow`
- `stream_tokens=800`
- `token_interval_ms=20`
- no input_probe
- no scrollback

Success:

- one parity-usable smoke / contract check
- route, marks, counters, and parity fields present
- runtime counters present

This is intentionally not a sample-heavy gate. Production React has already
passed the heavier equivalent code-heavy tail-follow 3-run sanity check. O0-A is
a route, marks, counters, and parity sanity check for the standard workload.

### O0-B: React Code-Heavy Tail-Follow Reproduction

Purpose:

Record the current production React evidence for the equivalent code-heavy
tail-follow workload.

Config:

- `history_messages=160`
- `content_mix=code-heavy`
- `scenario_mode=tail-follow`
- `stream_tokens=800`
- `token_interval_ms=20`
- `highlight_policy=streaming-plain-until-close`

Current status:

- 3/3 parity-usable clean
- equivalent hashes matched
- React counters present

### O0-C: React Scale Ladder

Purpose:

Test whether production React stays robust when history scale increases.

Cells:

- `history_messages=500`, `content_mix=code-heavy`
- `history_messages=1000`, `content_mix=code-heavy`

Rules:

- one smoke first
- then 3 parity-usable samples only if smoke passes
- no input_probe
- no scrollback
- no new mitigation

### O0-D: React Structured No-Code Ladder

Purpose:

Confirm no-code structured output remains robust under production React.

Cells:

- `tool-heavy-no-code`
- `markdown-heavy-no-code`
- optional `tool-heavy` if equivalence can be proven

### O0-E: React Burst/Boundary Search

Purpose:

Only after O0-A, O0-B, O0-C, and O0-D, design a harder but fair workload that
attempts to reproduce private/product-like burst behavior without B1-specific
over-rendering.

The workload must be grounded in at least one of:

- private product burst trace pattern
- manual product profiling observation
- agent trace, long review, or multi-stream real usage pattern
- trace replay-inspired controlled workload

Do not manufacture a synthetic adversarial workload merely to make React fail.

Allowed dimensions:

- larger history
- larger active message
- mixed markdown, code, and tool blocks
- multiple concurrent streams only if semantics are clearly defined
- realistic agent trace pattern

Forbidden:

- artificial over-rendering
- disabling stable keys
- intentionally weakening React
- hidden or background captures
- changing token semantics to manufacture failure

## Decision Rules

If production React remains robust through O0-A, O0-B, and O0-C:

- current B1-based runtime evidence remains downgraded
- pause runtime thesis
- redesign workload and baseline strategy
- do not enter P2

If production React becomes boundary-positive under an equivalent fair workload:

- preserve the finding
- run targeted attribution
- then proceed to B2/B3 planning
- P2 still requires B2/B3 evidence or a strong written reason to bypass

If only parity-fail samples show tails:

- treat this as an environment or capture issue
- do not interpret it as workload failure

If React fails equivalence:

- block capture
- repair equivalence first

## Option 0 Timebox And Stop Rule

Option 0 has a 14 calendar day cap, or a fixed approved experiment-cell budget,
whichever is reached first.

At the end of that cap, the next document must be a commit decision:

1. commit pause
2. commit pivot
3. commit proceed to next gated phase / P2 eligibility review

No "Option 0.5" methodology refinement document is allowed. Option 0 may refine
individual cells as needed for validity, but it may not become an open-ended
methodology phase.

## P2 Eligibility Criteria

P2 may be reconsidered only if:

- a production framework baseline shows boundary-positive behavior under a fair
  realistic workload
- B2/B3 cannot absorb the same workload or expose a meaningful tradeoff
- marks, equivalence, and parity are complete
- the private-product burst is reproduced or tightly mapped to a controlled
  baseline
- the failure is not caused by an intentionally weak baseline, hidden-window
  state, or measurement artifact

## Pivot Criteria

Pivot or pause the runtime thesis if:

- production React remains robust across a reasonable stress ladder
- B2/B3 remain robust
- failures only appear in hand-written, proxy, or weak baselines
- the private product burst cannot be reproduced or mapped to a controlled
  production framework baseline

## Reviewer Objections And Responses

Objection: React sanity has only 3 samples.

Response: Correct. It is not a P1 gate pass. It is enough to require Option 0
before making broader claims from B1-specific failures.

Objection: This is still not a full production app.

Response: Correct. It is a production-framework controlled baseline, not a full
app. That is why Option 0 is a gate before B2/B3/P2, not a final conclusion.

Objection: You are filtering parity-fail samples.

Response: Parity filtering is measurement validity control. Hidden-window,
suppressed-frame, or missing-end samples are not comparable evidence about the
workload.

Objection: The private product still bursts.

Response: The private burst remains important, but it has not yet been
reproduced in a production-grade controlled baseline.

Objection: P1-B/C work was wasted.

Response: No. P1-B/C found a real mechanism in the hand-written B1 baseline and
improved workload, audit, equivalence, and parity discipline. They are valid as
B1-specific mechanism discovery and reusable as methodology. They are not
sufficient as primary controlled evidence for the runtime thesis unless
reproduced on production-grade baselines.

Objection: After production React 3x clean, the controlled side currently has no
primary thesis evidence that does not depend on the hand-written B1 baseline.
P1-B/C/C2a may be internally valid, but their concrete mechanism findings are
not primary paper evidence unless reproduced on production-grade baselines.

Response: Accept this. P1-B/C/C2a are method and benchmark-development evidence,
not broad runtime-thesis evidence. Their concrete findings are B1-specific until
reproduced under Option 0.

Objection: This delays P2.

Response: Yes. P2 without production-framework reproduction would be
under-justified.

## Explicitly Blocked Steps

The following remain blocked:

- P2 runtime implementation
- Canvas/WebGPU/runtime work
- allocation_probe
- new mitigation
- input_probe
- scrollback
- B2/B3 implementation
- unverified harder workloads
- claims that React wins
- claims that runtime is unnecessary
- claims that P1 passed

## Final Recommendation

Option 0 is the required next gate. The next implementation should be the
smallest production-react-sanity reproduction cell plan, not runtime work.

B1 findings remain valid as B1-specific mechanism discovery and reusable as
methodology. They are not sufficient as primary controlled evidence for the
runtime thesis until they reproduce on a production-grade baseline. Controlled
runtime-thesis evidence is currently insufficient after excluding B1-specific
findings. Production framework reproduction is required before B2, B3, or P2
decisions.
