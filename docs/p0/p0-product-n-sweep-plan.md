# P0 Product N-Sweep Plan

## Goal

Measure whether private-product send-path cost scales approximately linearly, superlinearly, or via threshold/cliff as session length grows.

## Evidence Track

This experiment belongs to **Private Product Trace Attribution**.
It is not sufficient on its own to prove a generic DOM / VDOM architectural bottleneck.

## Buckets

- B0: new chat / near-0 history
- B1: medium chat / about 40 turns
- B2: long chat / 100+ turns
- B3: existing very long baseline chat

## Fixed Conditions

- same machine
- same browser
- same active foreground window
- same DevTools workflow
- same no-scroll / no-extra-typing measurement rule
- same short send prompt on the measured run

## Measured Prompt

Use a fixed short send action for the measured run.
Recommended:
"Reply with exactly: OK"

## Per-Run Fields

- run_id
- bucket
- estimated_turns
- replicate
- task_total_ms
- input_delay_ms
- processing_duration_ms
- presentation_delay_ms
- scripting_ms
- rendering_ms
- pointerup_chain_ms
- microtask_chain_ms
- click_rulu_chain_ms
- dominant_family
- notes

## Initial Sampling Plan

- 2 replicates for each bucket: B0 / B1 / B2 / B3
- If shape is ambiguous, add 1 more replicate to B1 and B2

## Output Interpretation

Primary question:
- near-linear
- superlinear
- threshold / cliff
- noisy / mixed

Secondary question:
Does the dominant family remain:
- async microtask / flush dominated
or shift across buckets?
