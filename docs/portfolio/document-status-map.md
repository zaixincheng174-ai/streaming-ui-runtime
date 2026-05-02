# Document Status Map

## Purpose

This file helps external readers distinguish current canonical documents from historical drafts, intermediate evidence notes, internal process notes, and privacy-bounded triage notes.

Use this map before quoting old documents. The current public claim boundary is defined by the canonical entry path below, not by every historical note retained in `docs/`.

## Current Canonical Entry Path

| file | status | purpose | current/public-facing? | notes |
| --- | --- | --- | --- | --- |
| `README.md` | current entry point | Repository overview, current claim, limits, and reader path. | yes | Start here. |
| `docs/portfolio/README.md` | current portfolio overview | Five-minute external reader summary. | yes | Portfolio-facing, conservative. |
| `docs/portfolio/document-status-map.md` | current document-status map | Distinguishes current docs from historical drafts and triage notes. | yes | Use before quoting older files. |
| `docs/portfolio/evidence-map.md` | current evidence map | Maps portfolio claims to evidence and boundaries. | yes | Use for claim-to-artifact checks. |
| `docs/portfolio/privacy-and-data.md` | current privacy boundary | Public-release data and trace hygiene policy. | yes | Explains raw/private artifact exclusions. |
| `docs/paper/streaming-ui-runtime-related-work-v0.md` | current related-systems positioning | Positions the project against DOM/VDOM, virtualization, editors, terminals, Workers, OffscreenCanvas, WebGPU, and agent traces. | yes | Not a final bibliography-complete related work section. |
| `docs/paper/streaming-ui-runtime-short-paper-draft-v0.md` | current short paper draft | Main paper-style project argument. | yes | Current v0 draft; not a production-system claim. |
| `docs/paper/appendix/p5-scheduling-evidence-appendix.md` | current appendix | Paper appendix for P5 scheduling evidence. | yes | Synthetic scheduling-delay proxy only. |
| `docs/p5/p5y-final-reviewer-evidence-packet.md` | current P5 evidence packet | Final reviewer-facing P5 claim-boundary packet after P5-X. | yes | Authoritative P5 evidence packet. |
| `docs/p5/p5y-reviewer-adversarial-audit.md` | current P5 adversarial audit | Strict reviewer risk register and rejected-claim list. | yes | Use to avoid overclaiming. |

## Current Claim Boundary

Current conservative claim:

Controlled P1 evidence plus synthetic P5 scheduling-delay proxy evidence supports that worker-resident ownership/offload can reduce and localize main-thread blocking under long-lived AI-surface workloads, while bounded main-thread projection commit remains the remaining blocking window.

Must not claim:

- browser-level INP improvement;
- Event Timing improvement;
- real product superiority;
- production readiness;
- complete production Worker/Main runtime;
- complete Canvas/OffscreenCanvas/WebGPU backend;
- WebGPU/P4 authorization;
- P7 productization;
- production Agent Trace Viewer;
- precise user-perceived speedup ratios.

## Historical / Superseded Drafts

| file | status | why historical/superseded | safe reader note |
| --- | --- | --- | --- |
| `docs/paper/streaming-ui-runtime-abstract-intro-v0.md` | historical paper fragment | Earlier abstract/introduction fragment superseded by the current short paper draft. | Use only for history; current claims live in `streaming-ui-runtime-short-paper-draft-v0.md`. |
| `docs/paper/streaming-ui-runtime-background-workload-v0.md` | historical paper fragment | Earlier section draft. | Use as background history only. |
| `docs/paper/streaming-ui-runtime-conclusion-v0.md` | historical paper fragment | Earlier conclusion fragment. | Do not quote as final conclusion. |
| `docs/paper/streaming-ui-runtime-external-review-packet-v0.md` | historical review packet | Earlier external review packet before P5-Y/P5-X final packaging. | Superseded for public-reader claims by README, evidence map, and P5-Y. |
| `docs/paper/streaming-ui-runtime-f0d-reproduction-v0.md` | historical paper section | Earlier F0-D section draft. | Evidence remains useful, but current paper draft controls wording. |
| `docs/paper/streaming-ui-runtime-f1-worker-offload-v0.md` | historical paper section | Earlier F1 section draft. | Evidence remains useful, but current paper draft controls wording. |
| `docs/paper/streaming-ui-runtime-f2-worker-scheduling-v0.md` | historical paper section | Earlier F2 section draft. | Use current wording for projection-commit timing, not visible-latency wording. |
| `docs/paper/streaming-ui-runtime-p0-motivation-v0.md` | historical paper section | Earlier P0 motivation draft. | Product trace material is motivating, not source replay. |
| `docs/paper/streaming-ui-runtime-p2-design-implications-v0.md` | historical paper section | Earlier P2 design implication draft. | P2 is pure core, not production runtime. |
| `docs/paper/streaming-ui-runtime-short-paper-outline.md` | superseded outline | Earlier outline before P6 claim-boundary reconciliation. | Use current short paper draft instead. |
| `docs/paper/short-paper-v0-2-outline.md` | superseded outline | Earlier v0.2 outline. | Use as planning history only. |
| `docs/paper/short-paper-v0-2-revision-plan.md` | superseded revision plan | Earlier revision plan. | Use as process history only. |
| `docs/paper/p3-5-external-review-packet-v0.md` | historical external review packet | Earlier P3.5 packet before P5-Y/P5-X final evidence packaging. | Retained for history; not current claim boundary. |
| `docs/p0/p0-current-gate-note.md` | historical P0 process note | Captures an earlier gate state. | Use for process history only. |
| `docs/p0/p0-product-n-sweep-analysis.md` | historical P0 analysis | Product-trace-derived analysis from the motivation phase. | Motivating evidence only; raw trace-derived source CSVs are not public evidence. |
| `docs/p0/p0-product-mechanism-verdict-and-thesis-reframe.md` | historical P0 synthesis | Earlier thesis-reframe note. | Superseded by current README/short paper claim boundary. |
| `docs/p3/p3-5-closeout-paper-facing-evidence-packet-v0.md` | historical P3.5 closeout | Closed an earlier external-validity branch. | Superseded by current P6/P5-Y packaging. |
| `docs/p5/p5h-b0-b1-b2-r0-comparison-summary.md` | historical intermediate P5 summary | Earlier P5 comparison before later P5-M/O/Q/S/U/X/Y evidence. | Use P5-Y for current P5 claims. |
| `docs/p5/p5w-evidence-packet-freeze.md` | superseded P5 packet | P5-W was superseded by P5-Y after P5-X. | Useful as history; P5-Y is authoritative. |

## Privacy-Bounded / Triage Notes

| file | status | why privacy-bounded | safe reader note |
| --- | --- | --- | --- |
| `docs/p3/p3-5-claude-existing-long-session-triage-result-v0.md` | privacy-bounded triage note | Sanitized Claude observation, not raw trace evidence. | Not product ranking, not product superiority, not production-readiness evidence. |
| `docs/p3/p3-5-gemini-existing-long-session-triage-result-v0.md` | privacy-bounded triage note | Sanitized Gemini observation, not raw trace evidence. | Does not prove Gemini solves long-session pressure. |
| `docs/p3/p3-5-claude-gemini-100-turn-external-validity-attempt-v0.md` | privacy-bounded blocked-attempt note | Sanitized blocked attempt; no raw screenshots/traces. | Does not prove degradation or non-degradation. |
| `docs/p3/p3-5-external-validity-synthesis-v0.md` | privacy-bounded synthesis | Cross-system interpretation from bounded observations. | Product-strategy framing only, not controlled benchmark evidence. |
| `docs/paper/p3-5-external-review-packet-v0.md` | privacy-bounded historical packet | Summarizes product triage in paper-facing form. | Historical; use current short paper and P5-Y for public claims. |
| `docs/paper/short-paper-v0-2-revision-plan.md` | privacy-bounded planning note | Discusses ChatGPT/Claude/Gemini public-anonymization choices. | Planning history only. |

## Evidence Packets

| file | status | what it supports | what it does not prove |
| --- | --- | --- | --- |
| `docs/p1/p1-f0d-product-range-3x-result.md` | current controlled evidence | Controlled derived-fanout main-thread long-task reproduction. | Product replay or exact root cause. |
| `docs/p1/p1-f1-worker-offload-3x-result.md` | current controlled evidence | Worker offload reduces main-thread max task in a controlled workload. | All UI work can move off-main-thread. |
| `docs/p1/p1-f2-worker-scheduler-ab-3x-result.md` | current controlled evidence | Worker-side scheduling improves controlled urgent projection timing. | Throughput win, browser INP, or user-perceived latency. |
| `docs/p2/p2-pure-core-v0-freeze.md` | current scaffold evidence | P2 pure-core runtime scaffold and freeze validation. | Production Worker/Main runtime. |
| `docs/p5/p5y-final-reviewer-evidence-packet.md` | current P5 evidence packet | Final P5 scheduling-mechanism claim boundary after P5-X. | Browser-level INP, Event Timing, production readiness, P4. |
| `docs/p5/p5y-reviewer-adversarial-audit.md` | current P5 audit | Strict rejected-claims list and reviewer risk register. | New measurement or proof beyond P5 evidence. |
| `docs/paper/appendix/p5-scheduling-evidence-appendix.md` | current appendix | Paper-facing P5 evidence chain. | Real product trace superiority or precise speedup. |

## How To Read This Repo

1. Start with [README.md](../../README.md).
2. Read [docs/portfolio/README.md](README.md) for the portfolio summary.
3. Use [docs/portfolio/evidence-map.md](evidence-map.md) for claim-to-evidence mapping.
4. Read [docs/paper/streaming-ui-runtime-related-work-v0.md](../paper/streaming-ui-runtime-related-work-v0.md) for related-systems positioning.
5. Read [docs/paper/streaming-ui-runtime-short-paper-draft-v0.md](../paper/streaming-ui-runtime-short-paper-draft-v0.md), then [docs/paper/appendix/p5-scheduling-evidence-appendix.md](../paper/appendix/p5-scheduling-evidence-appendix.md), [docs/p5/p5y-final-reviewer-evidence-packet.md](../p5/p5y-final-reviewer-evidence-packet.md), and [docs/p5/p5y-reviewer-adversarial-audit.md](../p5/p5y-reviewer-adversarial-audit.md) for the current paper/evidence packet.

Reader shortcuts:

- **Recruiters:** README, portfolio overview, and evidence map.
- **Engineers:** evidence map, related systems positioning, and short paper draft.
- **Reviewers:** short paper draft, P5 appendix, P5 final reviewer packet, and P5 adversarial audit.
