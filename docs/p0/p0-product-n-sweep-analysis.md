# P0 Product N-sweep Analysis

## Purpose

This analysis summarizes existing product DevTools summary evidence from the
Product N-sweep CSV. It is not raw trace replay evidence and not controlled
benchmark evidence.

The goal is to quantify what the existing product observations support before
requesting any new capture. The analysis preserves the source rows as supplied
and keeps interpretation separate from raw data.

## Data Source And Integrity

Input CSV:

`bench/p0/product-trace-n-sweep.csv`

Integrity checks:

- Columns: 19
- Data rows: 16
- `source_row_id`: R001 through R016
- `source_status`: `user_provided_summary`
- Repeated `run_id` values are preserved and disambiguated by
  `source_row_id`.
- Empty fields remain empty.
- Missing fields are not inferred or filled.

The rows are Product DevTools summary observations. They are not raw `.trace`
files, exported DevTools call trees, or replay-grade artifacts.

## High-Level Finding

The product N-sweep supports a real product-level trend: send/click processing
cost increases with session length and content richness. The dominant cost
family is processing, scripting, and microtasks, not input delay or rendering.

This is a product trend finding, not a root-cause finding. It does not identify
exact product function ownership or prove that a new runtime is required.

## New Conversation Baseline

The B0 rows are preserved separately:

- R001 is an untimestamped/preliminary source row.
- R002 is the timestamped B0 source row.

Timestamped B0 row R002:

| metric | value |
| --- | ---: |
| click_ms | 44.43 |
| scripting_ms | 36 |
| rendering_ms | 1 |
| inp_ms | 96 |
| input_delay_ms | 13 |
| processing_ms | 45 |
| presentation_ms | 38 |
| long_task_total_ms | 372.95 |
| dominant_family | flush |

B0 shows a light click/processing path compared with long-session rows. For
example, B3 has `click_ms=622.46` and `processing_ms=623`, roughly 14x the B0
timestamped row on both click and processing time. This ratio is descriptive
only because the rows are product observations, not a controlled regression
dataset.

## Long-session Send/Click Scaling

Core long-session rows:

| row | turns | click_ms | microtasks_ms | scripting_ms | rendering_ms | inp_ms | processing_ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B1 / R004 | 21 | 122.08 | 116.07 | 93 | 14 | 179 | 122 |
| B2 / R005 | 40 | 157.93 | 149.41 | 138 | 14 | 229 | 158 |
| B4 / R007 | 58 | 455.47 | 427.56 | 381 | 28 | 529 | 456 |
| B3 / R006 | 100 | 622.46 | 573.46 | 543 | 32 | 712 | 623 |

Descriptive comparisons against timestamped B0:

- B1: `click_ms` is about 2.7x B0; `processing_ms` is about 2.7x B0.
- B2: `click_ms` is about 3.6x B0; `processing_ms` is about 3.5x B0.
- B4: `click_ms` is about 10.3x B0; `processing_ms` is about 10.1x B0.
- B3: `click_ms` is about 14.0x B0; `processing_ms` is about 13.8x B0.

These rows support session-length-associated send/click cost growth, with the
strongest long-session rows showing hundreds of milliseconds in processing,
scripting, and microtasks. The rows are heterogeneous product observations, so
this document does not fit a regression or claim a precise slope.

## Light / Short Turn-count Scaling

Light and short rows:

| row | turns | output_class | click_ms | microtasks_ms | scripting_ms | rendering_ms | inp_ms | processing_ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| R012 | 10 | 200token | 71.18 | 66.18 | 64 | 7 | 129 | 71 |
| R013 | 20 | 100token | 84.72 | 80.09 | 73 | 8 | 146 | 85 |
| R016 | 50 | count20 | 167.55 | 157.34 | 149 | 15 | 229 | 168 |
| R009 | 60 |  | 211.27 | 199.96 | 183 | 18 | 296 | 211 |
| R010 | 80 | short | 282.69 | 266.23 | 249 | 23 | 379 | 283 |
| R011 | 100 | short | 428.37 | 405.97 | 354 | 27 | 512 | 429 |

These are not identical workloads. The output class and product context differ.
Even with that caveat, the rows support a turn-count-associated growth signal
in lighter and routine product cases.

Descriptive comparisons:

- R012 10-turn 200-token row: `click_ms=71.18`, `processing_ms=71`.
- R013 20-turn 100-token row: `click_ms=84.72`, `processing_ms=85`.
- R009 60-short row: `click_ms=211.27`, `processing_ms=211`.
- R010 80-short row: `click_ms=282.69`, `processing_ms=283`.
- R011 100-short row: `click_ms=428.37`, `processing_ms=429`.
- R016 50-count20 row: `click_ms=167.55`, `processing_ms=168`.

The 100-short row is about 6.0x the 10-turn 200-token row on click and
processing time. That is a descriptive product trend, not a controlled slope.

## Content Richness Amplifier

Rich/content-heavy rows:

| row | turns | description | click_ms | microtasks_ms | scripting_ms | rendering_ms | inp_ms | processing_ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 rich / R008 | 41 | rich daily medium task, no code | 257.07 | 244.62 | 204 | 16 | 329 | 257 |
| B4 / R007 | 58 | project progress and pricing discussion | 455.47 | 427.56 | 381 | 28 | 529 | 456 |
| B3 / R006 | 100 | project path confirmation | 622.46 | 573.46 | 543 | 32 | 712 | 623 |

Content richness and project-like context appear to amplify cost beyond turn
count alone. The 41-turn `4 rich` row is heavier than the 40-turn B2 row:

- B2/R005: `click_ms=157.93`, `processing_ms=158`.
- 4 rich/R008: `click_ms=257.07`, `processing_ms=257`.

B4 at 58 turns is also heavier than the 100-short row on click and processing
cost:

- 100-short/R011: `click_ms=428.37`, `processing_ms=429`.
- B4/R007: `click_ms=455.47`, `processing_ms=456`.

That comparison is not proof of a precise content-complexity coefficient, but
it is enough to treat content richness as a real product-side amplifier.

## Cost Family Interpretation

The cost-family pattern is consistent across the heavier rows:

- `input_delay_ms` is mostly stable around 13-15ms where present.
- `processing_ms` grows strongly across long-session and richer rows.
- `microtasks_ms` tracks `click_ms` closely where both are present.
- `scripting_ms` dominates `rendering_ms` in heavier rows.
- `rendering_ms` is nonzero but not the dominant family.

Examples:

- B3/R006: `microtasks_ms=573.46`, `scripting_ms=543`,
  `rendering_ms=32`, `processing_ms=623`, `input_delay_ms=13`.
- B4/R007: `microtasks_ms=427.56`, `scripting_ms=381`,
  `rendering_ms=28`, `processing_ms=456`, `input_delay_ms=15`.
- 100-short/R011: `microtasks_ms=405.97`, `scripting_ms=354`,
  `rendering_ms=27`, `processing_ms=429`, `input_delay_ms=14`.
- 4 rich/R008: `microtasks_ms=244.62`, `scripting_ms=204`,
  `rendering_ms=16`, `processing_ms=257`, `input_delay_ms=14`.

This supports a product-side signal centered on processing, scripting, and
microtasks. It does not identify exact function ownership, React/DOM
architecture cause, or raw trace replay fidelity.

## Event-Tree Snippet Evidence

The N-sweep matrix is now supported by event-tree snippets for multiple rows:

`bench/p0/product-trace-event-tree-snippets.csv`

The event-tree snippets show a repeated structure:

`Task -> Event: click -> Run microtasks`

The heavy rows are dominated by scripting and `Run microtasks` rather than
rendering. This upgrades the product evidence from summary-only to summary plus
event-tree mechanism snippets.

Representative examples:

| snippet | linked row | task_ms | click_ms | run_microtasks_ms | scripting_ms | rendering_ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| S014 | R016 / A3 count20 | 182.34 | 167.55 | 157.34 | 149 | 15 |
| S004 | R006 / B3 | 654.20 | 622.46 | 573.46 | 543 | 32 |
| S005 | R007 / B4 | 482.68 | 455.47 | 427.56 | 381 | 28 |
| S009 | R011 / 100 short | 458.52 | 428.37 | 405.97 | 354 | 27 |
| S006 | R008 / 4 rich | 274.41 | 257.07 | 244.62 | 204 | 16 |

Interpretation:

- S014/R016 A3 shows a `182.34ms` long task with `Event: click=167.55ms`,
  `Run microtasks=157.34ms`, `scripting=149ms`, and `rendering=15ms`.
- S004/R006 B3 shows a `654.20ms` long task with
  `Event: click=622.46ms`, `Run microtasks=573.46ms`,
  `scripting=543ms`, and `rendering=32ms`.
- S005/R007 B4 shows a `482.68ms` long task with
  `Event: click=455.47ms`, `Run microtasks=427.56ms`,
  `scripting=381ms`, and `rendering=28ms`.
- S009/R011 100 short shows a `458.52ms` long task with
  `Event: click=428.37ms`, `Run microtasks=405.97ms`,
  `scripting=354ms`, and `rendering=27ms`.
- S006/R008 4 rich shows a `274.41ms` long task with
  `Event: click=257.07ms`, `Run microtasks=244.62ms`,
  `scripting=204ms`, and `rendering=16ms`.

This supports product-side click-triggered long task mechanism evidence,
`Run microtasks` as a dominant child path, scripting-heavy processing, and a
flush/app-side async family as a strong candidate. Rendering/layout is present
but not the dominant component in these snippets.

Boundaries:

- These snippets are not raw trace files.
- They do not prove exact function ownership.
- They do not prove exact `o`/`c`/`Ru`/`Lu` semantics.
- They do not prove controlled production React reproduction.
- They do not prove P2 eligibility.

The remaining gap is raw trace replay and exact implementation ownership.

## Ownership Decomposition Evidence

The N-sweep interpretation is now also supported by three Product DevTools
ownership-decomposition runs:

`docs/p0/p0-product-click-ownership-decomposition.md`

Primary data:

- `bench/p0/product-click-ownership-decomposition-runs.csv`
- `bench/p0/product-click-ownership-bottomup.csv`

These observations confirm the N-sweep mechanism interpretation. The heavier
product rows are consistent with click/pointerup-triggered `Run microtasks` and
multi-bundle scripting-heavy flush rather than rendering-dominant cost.

Run summaries:

- Run1: INP `646ms`, processing `549ms`, click `548.9ms`,
  `Run microtasks=501.4ms`.
- Run2: INP `829ms`, processing `647ms`, click/pointerup around `647ms`,
  `Run microtasks=599.6ms`.
- Run3: INP `745ms`, processing `612ms`, pointerup `612.4ms`,
  `Run microtasks=564.5ms`.

The bottom-up views show owner drift across bundles and unattributed regions:

- Run1: `2340486e=210.2ms`, `[unattributed]=183.1ms`,
  `4813494d=152.4ms`, `conversation-small=44.7ms`.
- Run2: `4813494d=226.2ms`, `2340486e=160.3ms`,
  `[unattributed]=160.1ms`, `conversation-small=80.7ms`.
- Run3: `4813494d=206.7ms`, `[unattributed]=148.8ms`,
  Recalculate style `47.0ms`, `setTimeout=36.8ms`,
  `clearTimeout=28.2ms`, Major GC `16.7ms`.

The correct interpretation is not "one minified function is the root cause."
The stronger interpretation is action-triggered microtask flush / multi-bundle
app coordination / state propagation family.

Boundaries:

- These are screenshot-backed DevTools observations, not raw `.trace` files.
- They do not prove exact `o`/`Ze` semantics.
- They do not prove exact source ownership.
- They do not prove controlled production React reproduction.
- They do not prove P2 eligibility.

## What This Supports

The Product N-sweep supports:

- Real product long-session send/click scaling exists.
- Processing/scripting/microtask cost is the strongest current product-side
  signal.
- Event-tree snippets support the same mechanism family:
  `Task -> Event: click -> Run microtasks`.
- Ownership decomposition confirms the same mechanism family across three
  runs, with drifting bundle ownership rather than one stable slow function.
- Content richness amplifies cost.
- New/empty conversation send is materially lighter than long/rich sessions.
- Evidence mapping and targeted raw-trace acquisition are justified if the next
  decision requires mechanism detail.

## What This Does Not Prove

The Product N-sweep does not prove:

- Raw trace replay fidelity.
- Exact function ownership.
- Exact `o`/`c`/`Ru`/`Lu` semantics.
- Production React controlled reproduction of the product N-sweep trend.
- P2 eligibility by itself.
- That a new runtime is necessary.
- That React or conventional baselines are sufficient in general.

## Controlled-Reproduction Gap

Current production-react-sanity controlled cells are clean, including the
code-heavy 1000-history 3x result.

Therefore the current gap is:

> Product N-sweep trend exists, but controlled production React reproduction is
> missing.

This gap matters. Without a production-grade controlled reproduction, the
product trend remains strong product evidence but insufficient runtime-thesis
evidence.

## Next Decision

Do not collect new traces by default.

Only collect a new trace if it closes one of these specific gaps:

- raw long-session send/click event tree
- microtask/flush ownership
- payload/queue context
- foreground/frame parity
- mapping to a controlled production framework workload

Do not create a synthetic harder workload from these rows alone. The rows define
observed trend pressure; they do not define replay-grade workload constants.

## Final Recommendation

Treat the Product N-sweep as medium-high product trend evidence.

Treat raw trace and replay-grade mechanism evidence as missing.

Do not enter P2 from this analysis. Do not implement `allocation_probe`. Do not
create a synthetic harder workload from these rows alone.

The next step after this analysis should be either:

1. a targeted raw trace acquisition protocol, if a raw trace can close a
   specific mapping gap; or
2. an offline thesis/pivot review, if no raw trace can be obtained.
