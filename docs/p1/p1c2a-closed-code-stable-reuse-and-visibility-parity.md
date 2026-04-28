# P1-C2a Closed-Code Stable Reuse And Visibility Parity

Date: 2026-04-24  
Project: Streaming UI Runtime for Long-Lived AI Surfaces  
Stage: P1-C2a close-out note

## Alignment With P1

P1 is the strong-baseline stage. Its purpose is to test whether strong conventional UI architectures can handle realistic AI streaming workloads before a new runtime is justified.

This note records one narrow P1-C2a result for the optimized DOM baseline under the code-heavy tail-follow workload. It is not a P1 gate pass and does not start P2.

## What Changed In P1-C2a

P1-C2a added an opt-in optimized DOM strategy for active-message closed fenced-code blocks:

- `active_render_strategy=closed-code-stable-reuse`
- closed fenced-code blocks inside the active streaming message are reused when their ordinal, language, and content signature remain stable
- the current active unclosed code block continues to update normally
- non-code markdown blocks, lists, tables, tool output, and history blocks are outside the scope of this mitigation

The strategy preserves markdown parsing and syntax highlighting obligations for closed code blocks. It is a conventional DOM mitigation, not a P2 runtime abstraction.

## Mechanism Result

P1-C2a fixed the deterministic closed-code over-rendering mechanism observed in the code-heavy tail-follow workload.

Before the mitigation, already-closed code blocks in the active message were repeatedly rerendered, rehighlighted, and replaced during token streaming. The mechanism probe showed high closed-block churn, repeated closed-code highlight calls, and large highlighted-span creation.

With closed-code stable reuse, the mechanism counters showed the closed code blocks were rendered once and then reused across subsequent token ticks. This removed the deterministic closed-code repeated render, highlight, and span churn for the tested workload.

## Why Early GC Tail Evidence Was Not Accepted Directly

Earlier same-page and no-warmup runs showed low-frequency GC-tail behavior. That evidence was not accepted directly as workload-intrinsic because follow-up trace audits found visibility and frame-production anomalies in some tail traces.

Some tail traces had missing or suppressed paint/frame-production activity during the stream window. Those traces were not comparable to visible foreground captures and therefore were excluded from allocation attribution.

The accepted interpretation is narrower:

- P1-C2a solved the deterministic closed-code churn mechanism
- early GC-tail traces remain useful diagnostics
- early GC-tail traces are not sufficient evidence for an allocation-rooted workload failure without visible foreground/frame-production parity

## Visibility And Frame-Production Validity Gate

A helper-side visibility/frame probe and classifier were added to separate parity-usable visible foreground captures from invalid attribution samples.

A capture is attribution-usable only when:

- `visibility_frame_probe_status=ok`
- `stream_frame_parity_status=pass`
- `visibility_frame_parity_status=pass` or `pass_with_warning`
- the stream completes with `final_token_count=800`
- `token_800_present=true`
- rAF covers the capture through `p0:capture:end`
- `p0:capture:end` is observed by the rAF probe
- required rAF scalar fields are present
- frame-production evidence is comparable

Post-capture focus loss may remain a warning for this non-input rendering workload. Mid-capture hidden-window or rAF-end failures invalidate the sample for allocation attribution.

## Accepted Result

Under the current parity-usable visible foreground validity gate, the accepted P1-C2a sample set is clean:

- 5/5 parity-usable visible foreground samples completed the stream
- `visibility_frame_probe_status=ok`
- `stream_frame_parity_status=pass`
- `visibility_frame_parity_status=pass` or `pass_with_warning`
- `final_token_count=800`
- `token_800_present=true`
- `long_task_count_50ms=0`
- no MajorGC-dominant tail was accepted in the parity-usable set

Parity-fail samples are excluded from allocation attribution because their visibility or frame-production state is not comparable.

## What This Proves

This result proves that, for the current code-heavy tail-follow workload and optimized DOM baseline, the deterministic closed-code repeated render/highlight/span churn mechanism can be removed by a narrow conventional DOM mitigation.

It also proves that the remaining low-frequency tail evidence must be filtered through a visible foreground/frame-production validity gate before it can support allocation or GC attribution.

## What This Does Not Prove

This result does not prove that GC is universally solved.

This result does not prove that optimized DOM is sufficient for all AI streaming workloads.

This result does not prove that a new runtime is unnecessary.

This result does not cover editor-grade baselines.

This result does not cover B2 virtualization, B3 CodeMirror/Monaco-style editor-grade baselines, input-probe behavior, scrollback-resume behavior, or harder workload families.

## Impact On Runtime Thesis

The current code-heavy tail-follow workload no longer justifies P2 by itself.

P2 remains blocked for this workload because the accepted parity-usable P1-C2a result is clean after a conventional optimized DOM mitigation.

The runtime thesis must be tested against stronger P1 baselines, harder workloads, or cases where conventional approaches fail without weakening workload semantics.

## Next Allowed Steps

Allowed next steps:

- document this P1-C2a result and its boundaries
- plan B2 virtualization under true P1 constraints
- plan B3 CodeMirror 6 or Monaco-style editor-grade baselines if dependencies are explicitly approved
- design harder P1 workloads only after preserving shared workload semantics and reviewer-grade fairness

## Explicitly Blocked Steps

The following remain blocked by this result:

- `allocation_probe`
- P2 runtime implementation
- new mitigation work
- input-probe captures unless separately justified
- scrollback-resume captures unless separately justified
- claims that DOM baselines win
- claims that GC is universally solved
- claims that the runtime thesis is disproven
- claims that editor-grade baselines are covered

## Reviewer Notes

This is a P1-C2a close-out note, not a P1 gate pass.

The result should be read as a mechanism-specific finding: active-message closed-code repeated rendering was the dominant deterministic issue in the tested cell, and a narrow stable-reuse strategy removed it.

The remaining open question is broader P1 coverage. Stronger baselines and harder workloads remain necessary before any runtime claim can be made.
