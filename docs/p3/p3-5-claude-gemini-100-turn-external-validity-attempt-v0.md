> **Status:** Privacy-bounded triage note.
> This document contains sanitized, bounded observations only. It is not raw product trace evidence, not product ranking, and not current production-readiness evidence.

# P3.5 Claude/Gemini 100-Turn External-Validity Attempt v0

## 1. Purpose

This document records the first attempted Claude/Gemini 100-turn external-validity test after the post-C0 direction decision.

The attempt was blocked by product/model limits before the first 20-turn checkpoint (`L1`). It is not a measurement result, not a benchmark result, not DevTools evidence, and not evidence of Claude/Gemini degradation or non-degradation.

## 2. Phase Alignment

- Active phase: P3.5 external-validity / diagnostic track.
- P3 remains frozen after P3-L.
- P4 is not started.
- This result does not authorize runtime implementation.
- This result does not authorize Canvas, OffscreenCanvas, WebGPU, benchmark, capture, or script work.

This note only records the sanitized blocked attempt and defines the next quota-aware protocol direction.

## 3. Privacy Boundary

| Item | Status |
|---|---|
| Attempt-provided `STATUS_AFTER_P35_EXTERNAL_VALIDITY` | `?? docs/p3/p3-5-post-c0-direction-decision-v0.md` |
| Notes root | `PRIVATE_LOCAL_ONLY: local private notes path omitted from public repo` |
| Screenshots | None saved |
| Traces | None recorded |
| Raw artifacts in repo | None reported |
| Raw private notes included here | No |
| Private prompts/responses included here | No |

The attempt-provided repo status contained only one unrelated untracked docs file at the time of the user run. No screenshots, traces, or raw artifacts entered the repository.

## 4. Result Summary

- Claude reached the fresh baseline and 3 turns, then hit a usage/rate limit before `L1`.
- Gemini reached the fresh baseline and 6 turns, then hit a model limit before `L1`.
- No 20 / 40 / 60 / 80 / 100 checkpoint was reached for either system.
- No DevTools target was identified.
- Artifact/card/PDF surface behavior was not tested at a checkpoint.

## 5. CSV Result

```csv
system,level,turns,artifact_or_card_surface,main_chat_inline_code,typing_score,scroll_score,artifact_score,surface_switch_score,visible_lag,relative_to_fresh,confidence,termination_reason,notes
Claude,L0_fresh,0,none,none,0,not_tested,n/a,n/a,none,n/a,high,none,Fresh typing was responsive; no separate artifact/card/PDF surface observed.
Claude,L1_20_turns,20,none,mostly_inline,not_tested,not_tested,n/a,n/a,unclear,not_reached,high,rate_limit,Terminated after 3 turns before L1 due Claude usage limit; early code/content stayed inline.
Claude,L2_40_turns,40,unclear,unclear,not_tested,not_tested,n/a,n/a,unclear,not_reached,high,rate_limit,Not reached; Claude usage limit occurred before L1.
Claude,L3_60_turns,60,unclear,unclear,not_tested,not_tested,n/a,n/a,unclear,not_reached,high,rate_limit,Not reached; Claude usage limit occurred before L1.
Claude,L4_80_turns,80,unclear,unclear,not_tested,not_tested,n/a,n/a,unclear,not_reached,high,rate_limit,Not reached; Claude usage limit occurred before L1.
Claude,L5_100_turns,100,unclear,unclear,not_tested,not_tested,n/a,n/a,unclear,not_reached,high,rate_limit,Not reached; Claude usage limit occurred before L1.
Gemini,L0_fresh,0,none,none,0,not_tested,n/a,n/a,none,n/a,high,none,Fresh typing was responsive; no artifact/card/PDF before sending.
Gemini,L1_20_turns,20,mixed,mostly_inline,not_tested,not_tested,n/a,n/a,unclear,not_reached,medium,model_limit,Stopped after 6 turns before L1; first planning response produced a PDF/file card, later tables/code/review/checklist stayed mostly inline.
Gemini,L2_40_turns,40,unclear,unclear,not_tested,not_tested,n/a,n/a,unclear,not_reached,medium,model_limit,Not reached; Gemini displayed Thinking model limit before L1.
Gemini,L3_60_turns,60,unclear,unclear,not_tested,not_tested,n/a,n/a,unclear,not_reached,medium,model_limit,Not reached; Gemini displayed Thinking model limit before L1.
Gemini,L4_80_turns,80,unclear,unclear,not_tested,not_tested,n/a,n/a,unclear,not_reached,medium,model_limit,Not reached; Gemini displayed Thinking model limit before L1.
Gemini,L5_100_turns,100,unclear,unclear,not_tested,not_tested,n/a,n/a,unclear,not_reached,medium,model_limit,Not reached; Gemini displayed Thinking model limit before L1.
```

## 6. Interpretation

This attempt is blocked/inconclusive for UI degradation.

It does not prove Claude or Gemini are stable under long-session pressure. It also does not prove Claude or Gemini degrade under long-session pressure.

It does not prove artifact/card/PDF surfaces solve the problem. Artifact/card/PDF surface behavior was not tested at a reached checkpoint.

The attempt does show that the original 100-turn continuous protocol is not feasible under current product/model limits for this run. A quota-aware protocol is required before this external-validity branch can continue.

## 7. Early Surface-Routing Observations

- Claude early output stayed inline in the observed early turns.
- Gemini had mixed early routing: the first response produced a PDF/file card, while later observed long content, tables, code, review output, and checklist-style content stayed mostly inline.
- These are early observations only.
- They should not be treated as evidence that artifact/card/PDF surfaces solve or fail to solve long-session pressure.

## 8. Decision

- Do not run DevTools from this attempt.
- Do not claim Claude/Gemini degradation.
- Do not claim Claude/Gemini non-degradation.
- Do not claim artifact/card/PDF surface adequacy.
- Revise the protocol into a quota-aware continuation design.

## 9. Next Protocol

Primary next protocol:

Quota-aware continuation in the same conversation across usage windows.

Expected properties:

- continue the same Claude and Gemini conversations rather than restarting from zero each time;
- checkpoint at the first safely reached levels rather than assuming uninterrupted 20-turn increments;
- record product/model limit events as protocol state, not UI outcomes;
- keep observations sanitized and outside raw private content;
- defer DevTools until a clear UI symptom appears at a reached checkpoint;
- preserve the P3.5 user-run boundary for any browser or product interaction.

Secondary protocol if continuation is too slow:

Reduced-output variant with response length caps.

Expected properties:

- use shorter prompts or explicit response-length constraints to reduce product/model quota pressure;
- preserve the same target interactions where possible;
- mark reduced-output runs as lower-confidence for long-content pressure;
- use reduced output only as a feasibility fallback, not as a replacement for full long-session evidence.

## 10. Final Classification

| field | value |
|---|---|
| `attempt_status` | `blocked_before_L1` |
| `claude_reached_turns` | `3` |
| `gemini_reached_turns` | `6` |
| `ui_degradation_judgment` | `not_judgable` |
| `artifact_surface_judgment` | `not_tested` |
| `devtools_target` | `none` |
| `recommended_next` | `quota_aware_continuation_protocol` |
