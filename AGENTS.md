<!-- GLOBAL_CODEX_CONSTITUTION_START -->
# Global Codex Constitution

Project-specific AGENTS.md may add narrower rules for local architecture, tooling, workflows, and deliverables. When global and project instructions differ, follow the narrower project-specific rule for that project.

Follow these rules across all projects unless a more specific project instruction explicitly narrows them.

## 1. Think Before Coding
- Do not assume silently.
- State assumptions explicitly when they matter.
- If there are multiple plausible interpretations, present them instead of picking one silently.
- If something is unclear, stop and name the ambiguity.
- If a simpler approach exists, say so.
- Push back when the requested path is overcomplicated, risky, or misaligned.

## 2. Simplicity First
- Prefer the minimum code that solves the actual problem.
- Do not add speculative features, abstraction layers, configurability, or flexibility that was not requested.
- Do not add defensive code for unrealistic scenarios.
- If a solution can be materially simpler, prefer the simpler one.
- Before finalizing, ask: would a strong senior engineer consider this overengineered? If yes, simplify.

## 3. Surgical Changes
- Touch only what is necessary for the request.
- Do not refactor unrelated code.
- Do not "clean up" adjacent code unless the task requires it.
- Match existing style and structure unless explicitly told otherwise.
- Remove only the unused code/imports/variables caused by your own changes.
- If you notice unrelated issues, mention them separately instead of changing them.

## 4. Goal-Driven Execution
- Turn tasks into verifiable success criteria.
- For bug fixes, prefer reproducing the issue first, then verifying the fix.
- For behavioral changes, define what check proves success.
- For multi-step tasks, provide a short plan with verification points.
- Do not stop at "implemented"; verify.

## 5. Plan Before Execution
- For non-trivial tasks, stay in plan mode first.
- Give:
  1. Alignment
  2. Methodology
  3. Value Optimization
  4. Impact Analysis
- Before meaningful code changes, also give:
  5. Strongest objection
  6. Narrower alternative
  7. Self-rebuttal
  8. Final recommendation

## 6. Scope Discipline
- Do not perform opportunistic rewrites or architecture cleanup unless explicitly requested.
- Do not expand scope silently.
- Do not introduce architecture changes without explicit justification.
- Do not trade correctness for demo value.
- Do not convert a narrow task into a broad refactor.

## 7. Verification Discipline
- Prefer checks, tests, traces, or reproducible commands over narrative confidence.
- When suggesting implementation work, include exact commands when possible.
- Be explicit about what remains unverified.

## 8. Communication Discipline
- Be direct, concrete, and reviewable.
- Surface tradeoffs early.
- Do not hide uncertainty behind confident wording.
- If blocked by ambiguity, say exactly what is blocking progress.

## 9. Default Bias
- Bias toward caution over speed for non-trivial work.
- Bias toward measurable progress over large speculative rewrites.
- Bias toward narrower, safer, high-confidence changes.
<!-- GLOBAL_CODEX_CONSTITUTION_END -->

# AGENTS.md

## Project identity
Project name: Streaming UI Runtime for Long-Lived AI Surfaces

## North star
Current AI long-session interfaces are increasingly serving append-heavy, viewport-centric, long-lived workloads.
Do not treat this project as a "faster chat UI" or a renderer demo.
The core thesis is workload-architecture mismatch between document-oriented DOM/VDOM stacks and terminal/editor-like AI surfaces.

## Frozen strategic direction
The official path is:

Pre-P0: Related systems audit
P0: Profiling + measurement harness + pivot gate
P1: Strong baselines
P2: Runtime abstraction + scheduling
P3: Canvas/OffscreenCanvas prototype
P4: WebGPU ceiling backend
P5: Impossible-zone benchmark
P6: Paper + OSS + product validation
P7: Product-grade expansion

## Immediate execution rule
Do not start with WebGPU.
Do not start with a renderer-first implementation.
Do not start with UI polish.
The first implementation work is P0 measurement harness and profiling scaffold.

## Dynamic alignment protocol
For every major recommendation or execution step, provide these sections exactly:
1. Alignment
2. Methodology
3. Value Optimization
4. Impact Analysis

Before executing meaningful changes, also provide:
5. Strongest objection
6. Narrower alternative
7. Self-rebuttal
8. Final recommendation

## Hard constraints
- No free refactors.
- Preserve the current architecture.
- Prefer minimal, high-confidence changes.
- Plan first, execute second.
- Do not change page/component hierarchy unless explicitly approved.
- When editing existing files, prefer full-file replacements if the user requests them.
- Keep scope tightly bounded to the current phase.
- Do not quietly expand from P0 into P1/P2/P3.
- Do not introduce WebGPU work before P0/P1/P2 are complete.
- Do not use "demo value" as justification for architectural drift.

## What counts as success right now
Success for the current phase means:
- a clear P0 measurement spec
- profiling-harness scaffold
- scenario definitions
- run scripts
- summary scripts
- minimal instrumentation hooks
- no renderer implementation yet

## Expected near-term deliverables
- docs/p0/measurement-spec.md
- bench/p0/scenarios/
- scripts/p0/run_capture.sh
- scripts/p0/summarize_trace.mjs

## Evaluation mindset
Always compare against strong baselines.
Avoid strawman DOM baselines.
Assume reviewer skepticism by default.

## If uncertain
Choose the narrower, safer, more measurable path.
