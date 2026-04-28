# P0-E Click-Triggered Batch Commit Smoke

## Purpose

P0-E is a controlled P0 target for the private-product send-path pattern:

```text
click -> microtask / flush / batch traversal -> processing burst
```

P0-E v1 does not measure native pointer input dispatch. The target uses a visible button, but the capture run triggers it with `button.click()` after the page observes `p0:capture:start`. The measured surface is post-click batch and microtask processing.

## High-High Smoke Result

The high-high smoke passed after the target re-arm fix:

```text
valid_measured_runs=5
run_task_p95_ms=74.706
run_task_max_ms=85.848
long_task_count_50ms=1
MARK_CHECK=PASS
```

Each warmup and measured trace contained:

- `p0e:click`
- `p0e:batch:start`
- `p0e:batch:end`

The smoke used:

```text
block_count=10000
chars_per_block=800
operation_type=dom-text-scan
microtask_mode=true
mutation_mode=data-attribute-update
```

Target URL:

```text
http://127.0.0.1:4317/controlled_batch_commit_surface.html?block_count=10000&chars_per_block=800&operation_type=dom-text-scan&microtask_mode=true&mutation_mode=data-attribute-update
```

## Capture Command

Start the target server:

```bash
node scripts/p0/serve_controlled_target.mjs --host 127.0.0.1 --port 4317
```

Run five measured captures:

```bash
export P0E_RUN_STAMP="${P0E_RUN_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
export P0_BROWSER="${P0_BROWSER:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
export P0_MACHINE_LABEL="${P0_MACHINE_LABEL:-local-machine}"
export P0_MACHINE_CLASS="${P0_MACHINE_CLASS:-high-end-laptop}"
export P0_OPERATOR="${P0_OPERATOR:-$USER}"

bash scripts/p0/run_capture.sh \
  --browser "$P0_BROWSER" \
  --target-id "p0e-high-high-smoke" \
  --target-class controlled \
  --target-url "http://127.0.0.1:4317/controlled_batch_commit_surface.html?block_count=10000&chars_per_block=800&operation_type=dom-text-scan&microtask_mode=true&mutation_mode=data-attribute-update" \
  --target-description "P0-E click-triggered batch commit high-high smoke" \
  --build-label "p0e-click-batch-commit-high-high-smoke" \
  --notes "P0-E high-high smoke; programmatic button.click after p0:capture:start; measures post-click batch/microtask processing, not native pointer dispatch" \
  --machine-label "$P0_MACHINE_LABEL" \
  --machine-class "$P0_MACHINE_CLASS" \
  --network-mode local \
  --operator "$P0_OPERATOR" \
  --scenario bench/p0/scenarios/p0e_click_batch_commit.json \
  --warmup-runs 1 \
  --measured-runs 5 \
  --out-dir "/tmp/streaming-ui-runtime-p0/p0e-high-high-smoke-${P0E_RUN_STAMP}"
```

Summarize:

```bash
node scripts/p0/summarize_trace.mjs \
  --session-dir "/tmp/streaming-ui-runtime-p0/p0e-high-high-smoke-${P0E_RUN_STAMP}"
```

## Expansion Rule

Expand to the E1-E4 matrix only if the high-high smoke produces either:

- stable `long_task_count_50ms > 0`, or
- median `run_task_max_ms > 80`

The high-high smoke met both expansion conditions, so the minimal E1-E4 matrix is allowed.

## Matrix

Fixed knobs:

```text
operation_type=dom-text-scan
microtask_mode=true
mutation_mode=data-attribute-update
measured_runs=5
scenario=bench/p0/scenarios/p0e_click_batch_commit.json
```

Cells:

| Cell | `block_count` | `chars_per_block` |
| --- | ---: | ---: |
| `E1_low_blocks_low_chars` | `1000` | `80` |
| `E2_high_blocks_low_chars` | `10000` | `80` |
| `E3_low_blocks_high_chars` | `1000` | `800` |
| `E4_high_blocks_high_chars` | `10000` | `800` |

Use `scripts/p0/print_p0e_matrix.sh` to print exact capture, summarize, and mark-check commands. The helper is print-only and does not execute captures.

## Primary Metrics

P0-E primary metrics are:

- `run_task_max_ms`
- `run_task_p95_ms`
- `long_task_count_50ms`
- mark coverage for `p0e:click`, `p0e:batch:start`, and `p0e:batch:end` in every trace file

`run_task_busy_pct` is secondary for P0-E because the fixed capture window dilutes a short burst across the full trace window.

## Matrix Interpretation

- `E2 >> E1` means the boundary / block-count axis is the likely driver.
- `E3 >> E1` means the text-mass / chars axis is the likely driver.
- `E4 >> E2` and `E4 >> E3` means there is an interaction effect.
- Only `E4` strong means the burst likely requires both axes together.
- All cells weak means verify mark coverage and operation strength before interpreting the result.
