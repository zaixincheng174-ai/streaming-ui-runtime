# Controlled Local Target Spec

## Purpose

P0-B introduced the minimum repo-tracked controlled local target needed by the existing P0 harness. P0-C2 keeps that same target family and adds a narrow workload ladder so the harness can test intensity without changing browser, scenarios, or target class. The target remains intentionally narrow:

- one static HTML surface
- one Node stdlib server
- no framework
- no package manager
- no external assets
- no renderer or architecture work

Its only purpose is to give the existing `s01_tail_append`, `s02_append_scrollback`, and `s03_scroll_jump_resume` scenarios a stable `controlled` target, now with deterministic level selection.

## Files

- `bench/p0/targets/controlled_append_surface.html`
- `scripts/p0/serve_controlled_target.mjs`

## Served URL

The server exposes the controlled target at:

- `http://127.0.0.1:<port>/controlled_append_surface.html?level=L1|L2|L3|L4`
- `http://127.0.0.1:<port>/` as an alias for the configured default level

## Stress Ladder

The ladder stays inside one controlled target family. Tail behavior, main window scrolling, near-tail threshold, no-network policy, and scenario compatibility remain unchanged across all levels.

### L1

Reference workload. This preserves the existing controlled target behavior:

- fixed initial history count: `1200`
- append cadence: `80 ms`
- block pattern: uniform single-row append

### L2

Higher cadence only:

- fixed initial history count: `1200`
- append cadence: `40 ms`
- block pattern: uniform single-row append

### L3

Higher cadence plus larger or less uniform appended blocks:

- fixed initial history count: `1200`
- append cadence: `40 ms`
- block pattern: expanded append rows with deterministic extra lines and pill strips

### L4

Minimal richer AI-surface-like append pattern:

- fixed initial history count: `1200`
- append cadence: `32 ms`
- block pattern: deterministic assistant/plan/tool/result style blocks with nested list or code sections

Level selection is URL-parameterized through `level=L1|L2|L3|L4`. The level is part of the target URL so sessions remain reproducible and auditable.

## Behavioral Contract

The target must behave the same way on every fresh page load:

- fixed initial history count
- fixed append cadence
- deterministic initial content shape
- no network fetches
- no time-varying remote inputs

### Initial History

On load, the page seeds a fixed initial history of `1200` rows in every level. The content is deterministic and derived only from the row sequence number plus the selected level profile.

### Append Cadence

After seeding, the page appends using the configured level cadence:

- `L1`: `80 ms`
- `L2`: `40 ms`
- `L3`: `40 ms`
- `L4`: `32 ms`

### Tail Behavior

The page uses a near-tail threshold of `160 px`.

- If the viewport is within `160 px` of the bottom immediately before an append, the page auto-follows to tail after that append.
- If the viewport is farther than `160 px` from the bottom, appends continue but the page must not force a snap-back to bottom.

This is the behavior required for:

- `s01_tail_append`: tail-pinned append should remain tail-following.
- `s02_append_scrollback`: append must continue while the operator remains off-tail.
- `s03_scroll_jump_resume`: the operator can scroll through history and then return to tail without hidden framework state.

## DOM Model

The page is a plain document with a single append surface and no framework runtime. The main window scroll position is the relevant viewport state; the page does not use a nested scrolling container as the primary measurement surface.

Across the ladder:

- `L1` and `L2` use uniform rows
- `L3` uses taller and less uniform append rows
- `L4` uses still-minimal AI-surface-like blocks

All level variants remain deterministic and local. No level introduces framework code, package-managed code, external assets, or network-driven content.

## Non-Goals

This target is not intended to be realistic product UI. It intentionally does not add:

- filtering
- virtualization
- rich cards
- media
- third-party fonts
- router state
- background sync
- package-managed tooling

Those are deferred outside this narrow P0-B step.

## Local Run Flow

1. Start `scripts/p0/serve_controlled_target.mjs`.
2. Point the existing harness at `http://127.0.0.1:<port>/controlled_append_surface.html?level=<L1|L2|L3|L4>`.
3. Run the existing `s01`, `s02`, and `s03` sessions with `target_class=controlled`.

## Verification Expectations

Verification for this P0-B step does not require agent-run GUI Chrome. The minimum useful checks are:

- `node --check scripts/p0/serve_controlled_target.mjs`
- local server startup
- HTTP fetch of `/controlled_append_surface.html?level=L1|L2|L3|L4`
- static inspection confirming all four workload levels, fixed initial history count, level-specific append cadences, and near-tail auto-follow logic are present in the served file
