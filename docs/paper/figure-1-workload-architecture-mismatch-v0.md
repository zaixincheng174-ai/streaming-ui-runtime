# Figure 1: Workload–Architecture Mismatch v0

## Purpose

This figure should visually explain the paper's core thesis: long-lived AI surfaces are append-heavy, viewport-centric, and session-scale, but current document-oriented DOM/VDOM stacks often couple session-scale state/fanout work to main-thread presentation updates.

## Core Message

The mismatch is not "DOM is bad" or "React is bad."

The mismatch is:

- workload wants bounded visible projection from long-lived session state;
- current stack often routes action-triggered session-scale state/fanout through the main thread;
- proposed runtime direction moves session truth and derived fanout toward worker-resident state and sends only bounded projection to main.

## Visual Structure

Create a two-panel figure.

Panel A: Current document-oriented stack

Show:

User action / new stream update
-> main-thread app state / context propagation
-> subscriber fanout / derived computation
-> microtask flush / framework coordination
-> DOM/VDOM commit / visible update

Emphasize:

- session-scale work touches main thread;
- viewport is bounded but update path may involve large session/fanout;
- long task risk.

Panel B: Proposed streaming UI runtime direction

Show:

User action / stream op
-> serialized op / transaction
-> Worker-resident op-log + session state
-> Worker-side scheduler
-> bounded visible projection
-> main-thread projection commit

Emphasize:

- session truth lives off-main-thread;
- urgent visible projection can be prioritized;
- main thread receives bounded, validated projection;
- renderer backend is secondary.

## ASCII Draft

```text
Panel A: Current document-oriented stack

                  Main Thread
  +------------------------------------------------------+
  | User action / stream update                          |
  |        |                                             |
  |        v                                             |
  | App state / context propagation                      |
  |        |                                             |
  |        v                                             |
  | Session-scale state/fanout                           |
  | subscriber fanout / derived computation              |
  |        |                                             |
  |        v                                             |
  | Run microtasks / app coordination                    |
  |        |                                             |
  |        v                                             |
  | DOM/VDOM presentation commit                         |
  |        |                                             |
  |        v                                             |
  | Bounded viewport update                              |
  |                                                      |
  | Risk: large session/fanout path creates long task    |
  +------------------------------------------------------+

  Visible region is bounded, but the action/update path can
  still carry session-scale coordination through the main thread.
```

```text
Panel B: Proposed streaming UI runtime direction

              Worker                                  Main Thread
  +--------------------------------------+      +---------------------------+
  | User action / stream op              |      |                           |
  |        |                             |      |                           |
  |        v                             |      |                           |
  | Serialized op / transaction          |      |                           |
  |        |                             |      |                           |
  |        v                             |      |                           |
  | op-log / session state               |      |                           |
  | worker-resident session truth        |      |                           |
  |        |                             |      |                           |
  |        v                             |      |                           |
  | transaction scheduler                |      |                           |
  | urgent > visible > stream > bg       |      |                           |
  |        |                             |      |                           |
  |        v                             |      |                           |
  | fail-closed validation               |      |                           |
  |        |                             |      |                           |
  |        v                             |      |                           |
  | bounded projection ------------------------> Main Thread projection     |
  |                                      |      | commit                    |
  +--------------------------------------+      +---------------------------+

  Session-scale truth and derived fanout live off-main-thread.
  Main receives a bounded, validated projection for presentation.
```

## Caption

Figure 1. Long-lived AI surfaces are append-heavy and viewport-centric, but their session state and derived fanout can grow far beyond the visible region. In a document-oriented stack, action-triggered state/fanout work may run on the main thread before a visible update. The proposed runtime direction moves session-scale state and scheduling into a Worker and sends only bounded, validated projections to the main thread.

## Claim Boundaries

- Not a claim that DOM/React universally fails.
- Not a claim that rendering is irrelevant.
- Not a claim that Worker runtime is already implemented.
- Not a claim that Canvas/WebGPU is needed.
- Not product source replay.

## Placement In Paper

Place this figure in the Introduction or Background section, before the evidence chain table if possible, because it explains the workload/architecture mismatch that the rest of the paper tests.

## Relation To Evidence

- P0 motivates the left panel by showing action-triggered microtask/app coordination.
- F0-D reproduces the left-panel bottleneck in controlled form.
- F1 supports the Worker offload arrow in the right panel.
- F2 supports the scheduler / urgent projection part in the right panel.
- P2 pure core freezes the right-panel correctness scaffold.

## What This Figure Should Not Show

- No product internals.
- No ChatGPT source claims.
- No Canvas/WebGPU pipeline.
- No full production runtime.
- No accessibility model yet.
- No exact pixel latency.

## Final Recommendation

After this spec, the next figure/table task should be Figure 3: F0-D vs F1 main-thread comparison, unless the paper draft first needs a small patch referencing Figure 1.
