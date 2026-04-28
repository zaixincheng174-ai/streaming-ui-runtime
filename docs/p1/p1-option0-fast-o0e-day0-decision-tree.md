# P1 Option 0 Fast O0-E Day 0 Decision Tree

## Current Evidence State

Option 0 has reached the point where another broad methodology pass would add
less value than a concrete execution decision.

Current accepted state:

- O0-A standard one-smoke passed.
- O0-B code-heavy 160 passed with 3/3 parity-usable clean captures.
- O0-C code-heavy 500 passed one smoke.
- O0-C code-heavy 1000 passed with 3/3 parity-usable clean captures.
- Production React remains clean through the current Option 0 cells, including
  1000-history code-heavy tail-follow.
- B1-based evidence remains valid as B1-specific mechanism discovery and
  reusable methodology, but it is not sufficient as primary controlled evidence
  for the runtime thesis.
- P2 remains blocked.
- `allocation_probe` remains blocked.

The current controlled production-framework evidence does not justify P2.

## Why O0-D Is Skipped

O0-D is skipped because no-code structured cells have lower decision value at
this point.

Production React already passed the heavier code-heavy tail-follow path under
parity-usable visible foreground conditions. Running tool-heavy-no-code and
markdown-heavy-no-code now would mostly add deferred coverage, not a stronger
thesis decision.

O0-D remains valid future coverage, but it is not the next action.

## Why Full O0-E Is Rejected

Full O0-E is rejected because a broad burst/boundary search risks becoming
adversarial workload hunting.

The goal is not to manufacture a React failure. The goal is one grounded
reproduction attempt, tied to a real observed pattern, with pre-committed stop
rules and interpretation rules.

Fast O0-E is therefore limited to at most one primary grounded cell and one
optional second cell only if the same source independently justifies it.

## Grounding Source Selection

Selected source artifact:

- source type: private product trace attribution note
- date/session identifier: P0 attribution artifact referenced from the
  2026-04-24 P0 gate state; workspace artifact
  `docs/p0/p0-product-trace-attribution.md`
- observed pattern:
  - long-session send action can trigger a heavy long task while typing and
    scrolling are held fixed
  - dominant chain is scripting-heavy and centered on
    `pointerup -> Run microtasks -> o -> c`
  - secondary click chain is `click -> Ru -> Lu -> Ru -> Lu ...`
  - current attribution is app-side async microtask / flush overhead plus
    secondary framework commit traversal overhead
- why it maps to O0-E1:
  - O0-E1 should test whether production React can reproduce a send-path
    microtask/flush-like burst over an already mounted long AI surface
  - this maps more directly to the private observation than another steady
    token-tail-follow cell
- what is excluded:
  - product-specific internals hidden behind minified function names
  - claims about exact private implementation ownership
  - native pointer input dispatch claims beyond the controlled trigger path
  - arbitrary code-heavy escalation not tied to the send-path observation
  - hidden-window, parity-fail, or background samples
- why this is not synthetic adversarial construction:
  - the source predates Option 0 and records a real private-product trace shape
  - the proposed cell is constrained to the documented send-path microtask /
    flush and commit-traversal pattern
  - the cell must preserve production React baseline discipline: stable keys,
    `React.memo`, no deferred rendering, no token coalescing, and no intentional
    weakening

The raw private trace is not present in this repository. Therefore O0-E1 may
only reproduce the documented pattern in the attribution artifact. It must not
claim stronger source fidelity than the artifact supports.

## O0-E1 Cell Definition

Workload name:

`O0-E1_private_send_microtask_flush_replay`

Baseline:

- `baseline_id=production-react-sanity`

Scenario mode:

- `scenario_mode=send-flush-replay`

Timing:

- `stream_tokens` and `token_interval_ms` are not the primary control if the
  implementation uses a click/send-triggered batch path.
- If a streamed setup phase is used, it must complete before the measured
  send-triggered path and must be included in the audit so the measured phase
  cannot be confused with tail-follow streaming.

Content shape derived from source:

- long-session AI surface already mounted before the send trigger
- visible active input/send surface
- deterministic send trigger
- post-send microtask / flush-like processing path
- framework commit traversal over mounted message/block structure
- scripting-heavy controlled workload with rendering and paint treated as
  observed outputs, not forced bottlenecks

Structures allowed because the source contains or implies them:

- accumulated long-session output
- segmented message or block structure
- post-click / post-send microtask processing
- framework commit traversal
- mixed text surface only when needed to represent mounted output structure

Structures explicitly excluded:

- synthetic over-rendering
- intentionally unstable keys
- disabled `React.memo`
- hidden or background capture
- input probe
- scrollback
- multi-stream behavior unless justified by the same source
- code-heavy escalation unless tied to the send-path source pattern

Parity and equivalence requirements:

- `config_valid=true`
- `capture_allowed=true`
- `future_output_pre_rendered=false`
- source/workload hash fields emitted before capture
- semantic block or action-sequence hash emitted before capture
- visible audit must identify `scenario_mode=send-flush-replay`
- `visibility_frame_probe_status=ok`
- `stream_frame_parity_status=pass`
- `visibility_frame_parity_status=pass` or `pass_with_warning`
- `p0:capture:end` observed
- parity-fail samples excluded from workload attribution

Capture count:

- one parity-probed smoke first
- maximum of 3 parity-usable samples only if the smoke passes

## O0-E2 Eligibility

O0-E2 is allowed only if the same grounding source independently shows
burst/batch/multi-stream behavior not covered by O0-E1.

Examples that would qualify:

- a documented batch reveal after send
- a documented multi-stream agent update
- a documented long review flush pattern
- a trace-replay-inspired sequence from the same product observation

If the source does not show a separate pattern, O0-E2 is prohibited.

## Stop Rules

Stop Fast O0-E if:

- no grounded source exists
- equivalence fails
- parity-usable samples cannot be collected
- production React remains robust through O0-E1 and no grounded O0-E2 exists
- only parity-fail samples show tails
- workload changes become synthetic failure-seeking

If any stop rule triggers, the next action is a commit decision, not another
methodology document.

## One-Week Timebox

Fast O0-E has a one-week cap from the first implementation day.

At the end of the week, no Option 0.5 methodology refinement document is
allowed. The next document must be one of:

1. commit pause
2. commit pivot
3. proceed to next gated phase review

## Interpretation Rules

If production React is robust under O0-E1:

- controlled runtime-thesis evidence remains insufficient after excluding
  B1-specific findings
- P2 remains blocked
- the next decision should be pause or pivot unless a grounded O0-E2 source
  exists

If production React is boundary-positive under parity/equivalence:

- preserve the finding as production-framework controlled evidence
- targeted attribution may be planned
- B2/B3 planning may re-enter scope
- P2 still requires a later gated review

If only parity-fail samples show tails:

- treat the result as invalid for workload attribution
- diagnose measurement environment only if needed
- do not claim workload failure

## Explicitly Blocked

Blocked during Fast O0-E:

- P2
- `allocation_probe`
- B2/B3
- input_probe or scrollback unless directly grounded
- new mitigation
- synthetic adversarial workload
- more methodology-only docs
- claims that React wins
- claims that runtime is unnecessary
- claims that P1 passed

## Final Recommendation

Proceed with O0-E1 only if the implementation can faithfully encode the
documented private send-path microtask / flush pattern from
`docs/p0/p0-product-trace-attribution.md`.

Do not run O0-D now. Do not start full O0-E search. Do not implement O0-E2
unless the same source independently justifies a second grounded cell.

If O0-E1 cannot be implemented without inventing synthetic failure pressure,
block workload implementation and move directly to offline thesis audit / pause
decision.
