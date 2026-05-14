# Streaming Markdown Stability Demo Post-Audit

## Status

PASS with scope limits.

The `p1_streaming_markdown_stability_demo.html` surface is a small browser demonstration for simulated token streams. It compares naive accumulated-source reparse against stable completed-block reuse plus mutable-tail rendering.

## Evidence Checked

- Demo target: `bench/p1/targets/p1_streaming_markdown_stability_demo.html`
- Shared deterministic core: `bench/p1/lib/streaming_markdown_stability_core.mjs`
- Local route: `http://127.0.0.1:4319/p1_streaming_markdown_stability_demo.html`
- Audit command: `node scripts/p1/audit_streaming_markdown_stability_demo.mjs`
- Targeted tests: `node --test tests/p1/streaming-markdown-stability-demo-contract.test.mjs`

## Covered Cases

- incomplete fenced code block;
- GFM table streamed across chunks;
- LaTeX/math-like partial input;
- mixed long assistant answer.

## Metrics Exposed

- render count;
- completed-block re-render count;
- approximate node churn;
- average and max update time.

## Claim Boundary

Safe claim:

The demo shows, on deterministic simulated Markdown-like token streams, how preserving completed blocks and re-rendering only the mutable tail can reduce completed-block churn compared with naive full accumulated-source reparse.

Boundary statements:

- not a production Markdown library;
- not a provider integration;
- not browser-level INP;
- not Event Timing evidence;
- not production runtime evidence;
- not an npm package;
- does not compare against external Markdown libraries;
- no customer or commercial product claim.

## Architecture Boundary

No runtime architecture rewrite was introduced. The demo is isolated under `bench/p1` and uses the existing P1 static-server pattern. It does not change `runtime/`, does not introduce a new app stack, and does not add network/provider calls.
