# Streaming UI Runtime Figures and Tables Spec v0

## Purpose

The assembled draft is evidence-consistent but prose-heavy. The next paper improvement is to add front-loaded tables and figures that let reviewers quickly audit the evidence chain, claim boundaries, and F2 scheduling mechanism.

This spec uses only existing accepted evidence and paper text. It does not add new experimental numbers, open implementation work, or unfreeze P2 pure core v0.

## Table 1: Evidence Chain

Placement: near the end of the Introduction, before the paper structure/contributions paragraph.

Purpose: give reviewers a fast map from evidence stage to result to safe interpretation.

Schema:

| Stage | Question | Evidence / Method | Key Result | Safe Interpretation | Boundary |
|---|---|---|---|---|---|
| Product/P0 | What mechanism family appears in product traces? | `click/pointerup` trace ownership decomposition. | `click/pointerup -> Run microtasks` / multi-bundle state-context coordination. | Product traces motivate an action-triggered app-coordination hypothesis. | Not source replay; not exact product implementation. |
| F0-D | Can controlled derived fanout reproduce a main-thread long task? | Controlled 3x derived fanout workload. | `f0_run_task_max_ms` mean ≈ `68.633ms`; `long_task_count_50ms = 1/run`. | Controlled mechanism-family reproduction. | Not quantitative product replay. |
| F1 | Can equivalent derived fanout leave the main thread? | Worker B 3x with equivalence counters. | Main max task mean ≈ `2.679ms`; long task count = `0`. | Worker offload is a credible solution lever for derived/session-scale fanout. | Not proof all UI work can move off-main-thread. |
| F2 | Does Worker-side scheduling matter after offload? | Paired monolithic vs scheduled Worker A/B. | Urgent ack ≈ `20.933ms -> 0.900ms`; urgent projection-commit ≈ `22.867ms -> 3.333ms`. | Scheduled Worker improves urgent responsiveness. | Not throughput win; not full pixel latency. |
| P2 Pure Core | What runtime direction follows? | Frozen pure core scaffold. | Protocol/state/scheduler/projection correctness kernel frozen. | Engineering scaffold for future runtime gates. | Not production runtime. |

Implementation notes:

- Keep the table compact enough to fit near the Introduction.
- Use "projection-commit" rather than "visible latency" for the F2 result label.
- Do not add new stages or new metrics without source evidence.

## Table 2: Claim Boundaries

Placement: near the end of Introduction or immediately after Evidence Chain Table.

Purpose: prevent reviewers from interpreting the paper as overclaiming.

Schema:

| Claim Area | Supported Claim | Not Claimed | Future Evidence Needed |
|---|---|---|---|
| Product traces | Mechanism-family hypothesis. | Exact source replay / full product root cause. | Broader product traces / source-level validation if available. |
| F0-D reproduction | Controlled derived fanout can create main-thread long tasks. | Quantitative product replay. | Broader controlled workloads. |
| F1 worker offload | Equivalent derived work can move off-main-thread. | All UI work can move to Worker. | Real Worker boundary / more workload classes. |
| F2 worker scheduling | Scheduled Worker reduces urgent projection-commit latency. | Total throughput improvement / exact pixel latency. | Multi-urgent stress / display pipeline timing. |
| P2 pure core | Frozen correctness scaffold. | Production runtime. | Real Worker/main/projection gates. |
| Rendering backend | Renderer is not the first lever in current evidence. | Canvas/WebGPU irrelevant forever. | Presentation backend experiments after runtime boundary. |
| Production readiness | None. | Accessibility/product readiness. | Accessibility, focus/caret/input, integration tests. |
| Generalization | Current controlled workload family. | All AI surfaces. | Broader workload matrix. |

Implementation notes:

- This table should absorb some repeated caveat prose currently spread across the draft.
- Keep "Production readiness" deliberately strict: supported claim is none.
- Use this table to reduce the risk of a hostile reviewer reading P2 as production evidence.

## Figure 4: F2 Monolithic vs Scheduled Worker Timeline

Placement: in Section 6: Worker-side Scheduling, before or after the main result table.

Purpose: visually explain why F2-B improves urgent projection latency even though total Worker time is higher.

Figure type: two-panel, two-lane timeline.

### Panel A: F2-A Monolithic Worker

Timeline content:

- Main thread sends heavy transaction.
- Worker runs one monolithic heavy transaction.
- Urgent projection request arrives while Worker is busy.
- Urgent projection waits until heavy transaction completes.
- Result: higher urgent ack / visible projection latency.

Annotations:

- Urgent ack mean ≈ `20.933ms`.
- Urgent projection-commit mean ≈ `22.867ms`.
- Worker total mean ≈ `26.8ms`.
- Worker chunk count = `1`.
- Worker yield count = `0`.
- Worker preemptions = `0`.

### Panel B: F2-B Scheduled Worker

Timeline content:

- Main thread sends heavy transaction.
- Worker splits heavy work into `313` chunks.
- Worker yields `312` times via `message-channel`.
- One urgent projection request arrives during heavy work.
- Scheduler admits urgent projection between chunks.
- Result: lower urgent ack / projection-commit latency.

Annotations:

- Urgent ack mean ≈ `0.900ms`.
- Urgent projection-commit mean ≈ `3.333ms`.
- Worker total mean ≈ `48.533ms`.
- `chunk_count=313`.
- `yield_count=312`.
- `preemptions=1`.

Caption:

"F2 shows a responsiveness tradeoff: scheduled Worker execution increases total Worker compute time but admits urgent projection work much earlier than monolithic Worker execution."

Design notes:

- Show the Worker lane longer in Panel B to make the overhead visible.
- Show the urgent request marker at the same conceptual point during heavy work in both panels.
- Do not imply full pixel latency; label the result as urgent ack and projection-commit latency.
- Do not imply multiple urgent requests; show exactly one urgent request.

## Optional Later Figure Specs

These should be listed for future work but not fully specified in this document:

- Figure 1: Workload-architecture mismatch.
- Figure 2: P0 product trace mechanism shape.
- Figure 3: F0-D vs F1 main-thread comparison.
- Table 3: P2 module evidence classification.

## Integration Notes For Draft v0.1

When patching the assembled short-paper draft:

- add Table 1 near the end of Introduction;
- add Table 2 after Table 1 or in a Claim Boundaries subsection;
- add Figure 4 in the F2 section;
- trim repeated caveats after Table 2 is added;
- standardize wording from "urgent visible latency" to "urgent projection-commit latency" where appropriate.

Suggested order:

1. Insert Table 1.
2. Insert Table 2.
3. Trim nearby repeated boundary prose.
4. Add Figure 4 or a figure placeholder once table placement is stable.

## Final Recommendation

Next step should be to patch the assembled short-paper draft v0.1 by inserting Table 1 and Table 2 first. Figure 4 can follow after tables are in place.
