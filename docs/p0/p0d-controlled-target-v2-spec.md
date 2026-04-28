# P0-D Controlled Target v2 Specification

## Scope

P0-D strengthens the repo-owned controlled target so P0 can test architecture-level workload claims under reproducible conditions.

This is separate from private-product traces. Private-product traces may narrow mechanism families, but controlled baselines are required for architecture-level claims.

## Motivation

The existing controlled target is disciplined and non-idle, but still modest:

- shallow uniform rows
- plain DOM
- top-level window scrolling
- no framework runtime
- no nested scroller
- no images
- no rich cards
- no remote inputs

The prior controlled run stayed negative and produced the formal recommendation: stay in P0.

P0-D upgrades the controlled workload using orthogonal knobs derived from private-product attribution:

- history mass
- boundary count
- optional richness

## Primary Axes

### Axis 1: history_mass

Proxy for total rendered text volume.

Controlled by:

- `seed_blocks`
- `chars_per_block`

### Axis 2: boundary_count

Proxy for number of independently represented message / block / row boundaries.

Controlled by:

- `seed_blocks`

### Optional Axis 3: richness

Proxy for structural complexity.

Controlled by:

- `block_style`

Initial values:

- `plain`
- `rich` later, only after the 2x2 matrix runs

## Required Matrix

### C1: Low Mass / Low Boundary

- `seed_blocks = 200`
- `chars_per_block = 40`
- `append_interval_ms = 80`
- `capture_window_s = 20`
- `block_style = plain`

### C2: High Mass / Low Boundary

- `seed_blocks = 200`
- `chars_per_block = 400`
- `append_interval_ms = 80`
- `capture_window_s = 20`
- `block_style = plain`

### C3: Low Mass / High Boundary

- `seed_blocks = 2000`
- `chars_per_block = 40`
- `append_interval_ms = 80`
- `capture_window_s = 20`
- `block_style = plain`

### C4: High Mass / High Boundary

- `seed_blocks = 2000`
- `chars_per_block = 400`
- `append_interval_ms = 80`
- `capture_window_s = 20`
- `block_style = plain`

## Replicates

Minimum:

- C1 x 3
- C2 x 3
- C3 x 3
- C4 x 3

If noisy, extend C3 and C4 to 5 replicates.

## Metrics

Each run must preserve the existing P0 metric surface:

- `run_task_p95_ms`
- `run_task_max_ms`
- `run_task_busy_pct`
- `long_task_count_50ms`
- `layout_event_count`
- `paint_event_count`

Preferred additional metrics if the existing summarizer can expose them without fragile changes:

- scripting share
- rendering share
- total task time
- max task family if attributable

## Primary Questions

### Q1: Does boundary count independently increase cost?

Compare:

- C1 -> C3

### Q2: Does history mass independently increase cost?

Compare:

- C1 -> C2

### Q3: Is there an interaction effect?

Compare:

- C4 against C2 and C3

## Success Criteria

P0-D succeeds if at least two of the following hold:

1. C2 is clearly heavier than C1.
2. C3 is clearly heavier than C1.
3. C4 is clearly heavier than both C2 and C3.
4. At least one high-pressure cell consistently shows `long_task_count_50ms > 0`.
5. `run_task_busy_pct` clearly stratifies across low-pressure and high-pressure cells.

## Failure Criteria

P0-D remains negative if:

- C1 / C2 / C3 / C4 remain weakly separated.
- high-pressure cells do not produce stable long tasks.
- busy percentage does not meaningfully stratify.
- p95 / max task values remain too close to the prior modest baseline.

If this happens, the next pressure knobs are:

1. increase `seed_blocks`
2. increase `chars_per_block`
3. add internal nested scroller
4. add richer block style
5. increase append cadence

## Interpretation Policy

Do not claim DOM / VDOM architectural mismatch from private-product traces alone.

Architecture-level interpretation requires repo-owned controlled evidence.

P0-D is the next controlled step toward deciding whether P0 can progress toward P1 strong baselines and P2 runtime abstraction.
