#!/usr/bin/env bash
cat <<'TXT'
P0 Product N-Sweep Checklist

1. Use the same browser and machine.
2. Keep the measured run fixed: no extra scrolling, no extra typing.
3. Use fixed measured prompt: Reply with exactly: OK
4. Buckets:
   - B0 new chat
   - B1 ~40 turns
   - B2 100+ turns
   - B3 very long baseline
5. Collect 2 replicates per bucket first.
6. Record:
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
TXT
