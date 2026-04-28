# P1-A AI Streaming B0/B1 Bring-up

Date: 2026-04-24  
Stage: P1-A bring-up, not complete P1 gate

## Scope

P1-A introduces the first true P1 workload surface:

- token-by-token AI streaming append
- long pre-mounted conversation history
- local deterministic markdown parsing
- local deterministic syntax highlighting
- active input box present during output
- tail-follow and scrollback/resume scenarios
- visible Chrome capture through the existing P0 harness

This is not P0-F. It does not use the click-triggered batch proxy workload.

This is not P2. It does not introduce a runtime abstraction, scheduler, renderer, worker model, Canvas backend, or Streaming UI Runtime implementation.

B2 virtualization and B3 CodeMirror/Monaco remain required before the true P1 gate is complete.

## Workload

The first slice uses:

- `history_messages=160`
- `stream_tokens=800`
- `token_interval_ms=20`
- `content_mix=standard`
- `scenario_mode=tail-follow|scrollback-resume`

The target supports `token_interval_ms=50` for later sensitivity checks, but the first run matrix only prints 20ms scenarios.

The 160-message history is fully generated and mounted before capture. The page exposes visible ready/idle state and requires at least 2 seconds of idle time before it will start a capture-triggered stream.

## Local Markdown And Highlighting

The target deliberately avoids runtime CDN and package dependencies.

Supported markdown subset:

- headings
- paragraphs
- bullet lists
- inline code
- fenced code blocks
- tool-output-like fenced blocks

Supported deterministic highlighting subset:

- JavaScript / TypeScript-like keywords
- JSON keys, strings, numbers, booleans, and null
- shell-like commands, flags, comments, and strings
- fallback escaped plain code

This is not CommonMark, Prism, Highlight.js, CodeMirror, or Monaco. It is a deterministic local parser/highlighter for the P1-A supported workload only.

## Baselines

### B0 naive DOM chat

B0 keeps the full history mounted and rerenders the conversation content naively during token append. It parses markdown and highlights code through the same local logic as B1.

### B1 optimized DOM chat

B1 keeps identical logical content and visible output. It mounts the full history, keeps stable DOM references, and updates the active streaming message without rerendering stable history. It does not pre-render future tokens, reduce token count, skip code/list/tool-output cases, or weaken parsing/highlighting obligations.

## Marks

Each trace should include:

- `p1:capture:<n>:ready:idle-ms=<value>`
- `p1:capture:<n>:stream:start`
- `p1:capture:<n>:stream:token-100`
- `p1:capture:<n>:stream:token-200`
- `p1:capture:<n>:stream:token-300`
- `p1:capture:<n>:stream:token-400`
- `p1:capture:<n>:stream:token-500`
- `p1:capture:<n>:stream:token-600`
- `p1:capture:<n>:stream:token-700`
- `p1:capture:<n>:stream:token-800`
- `p1:capture:<n>:metric:final-token-count=800`
- `p1:capture:<n>:metric:tail_miss_count=<value>`
- `p1:capture:<n>:stream:end`

The scrollback/resume scenario also requires:

- `p1:capture:<n>:scrollback:start`
- `p1:capture:<n>:scrollback:resume-tail`

If capture starts too early, the target emits:

- `p1:capture:<n>:error:not-ready:idle-ms=<value>`

## Tail Miss Definition

During auto-follow mode, after an append and follow attempt, the target counts a tail miss when:

```text
scrollTop < scrollHeight - clientHeight - 2
```

The final count is emitted as `tail_miss_count`.

## Scenarios

First-slice scenarios:

- `bench/p1/scenarios/p1a_stream_tail_follow_20ms.json`
- `bench/p1/scenarios/p1a_stream_scrollback_resume_20ms.json`

Both use a 45 second capture window. Although `800 * 20ms` is nominally 16 seconds, real Chrome P1-A naive-DOM streams have shown roughly 25 second stream windows once markdown parsing, syntax highlighting, layout, and DOM updates are included; the earlier 30 second window was too tight and could truncate a measured run.

## Commands

Start the P1-A target server:

```bash
node scripts/p1/serve_p1_streaming_baselines.mjs --host 127.0.0.1 --port 4319
```

Print exact B0/B1 run commands:

```bash
bash scripts/p1/print_p1a_b0_b1_matrix.sh
```

Analyze a session after capture:

```bash
node scripts/p1/analyze_p1a_streaming_trace.mjs --session-dir /tmp/streaming-ui-runtime-p1/<session_id>
```

The existing summary remains:

```bash
node scripts/p0/summarize_trace.mjs --session-dir /tmp/streaming-ui-runtime-p1/<session_id>
```

## Bring-up Success Criteria

P1-A bring-up success requires:

- 5/5 valid measured runs
- stream completion for all 800 tokens
- 100% required P1 mark coverage
- token sample marks at 100 through 800
- history ready/idle confirmed before capture with `idle-ms >= 2000`
- `tail_miss_count` emitted for every warmup and measured trace
- scrollback/resume marks in every scrollback scenario trace
- measurable B0/B1 differentiation, or a clear conclusion that the workload is too weak
- no claim that DOM is insufficient from B0/B1 alone

## Interpretation Boundary

B0/B1 results can validate the workload and establish an initial conventional DOM spread. They cannot by themselves justify P2 runtime implementation. True P1 still requires B2 virtualization and B3 editor-grade baseline work.
