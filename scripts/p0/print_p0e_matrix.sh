#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.." || exit 1

echo "P0-E Click-Triggered Batch Commit Matrix"
echo
python3 - <<'PY'
from urllib.parse import urlencode

host = "127.0.0.1"
port = 4317
scenario_id = "p0e_click_batch_commit"
scenario_path = "bench/p0/scenarios/p0e_click_batch_commit.json"
output_root = "/tmp/streaming-ui-runtime-p0"
base_url = f"http://{host}:{port}/controlled_batch_commit_surface.html"

fixed = {
    "operation_type": "dom-text-scan",
    "microtask_mode": "true",
    "mutation_mode": "data-attribute-update",
}

cells = [
    {
        "cell_id": "E1_low_blocks_low_chars",
        "block_count": 1000,
        "chars_per_block": 80,
    },
    {
        "cell_id": "E2_high_blocks_low_chars",
        "block_count": 10000,
        "chars_per_block": 80,
    },
    {
        "cell_id": "E3_low_blocks_high_chars",
        "block_count": 1000,
        "chars_per_block": 800,
    },
    {
        "cell_id": "E4_high_blocks_high_chars",
        "block_count": 10000,
        "chars_per_block": 800,
    },
]

mark_check_js = (
    'import fs from "node:fs"; '
    'import path from "node:path"; '
    'const sessionDir=process.env.SESSION_DIR; '
    'if (!sessionDir) { console.error("MARK_CHECK=FAIL missing SESSION_DIR"); process.exit(1); } '
    f'const runsDir=path.join(sessionDir,"{scenario_id}","runs"); '
    'const traces=["warmup-01.trace.json","measure-01.trace.json","measure-02.trace.json","measure-03.trace.json","measure-04.trace.json","measure-05.trace.json"]; '
    'const prefixes=["p0e:click","p0e:batch:start","p0e:batch:end"]; '
    'let failed=false; '
    'for (const trace of traces) { '
    'const file=path.join(runsDir,trace); '
    'let names=[]; '
    'try { '
    'const payload=JSON.parse(fs.readFileSync(file,"utf8")); '
    'const events=Array.isArray(payload)?payload:(Array.isArray(payload.traceEvents)?payload.traceEvents:[]); '
    'names=events.map((event)=>event.name).filter((name)=>typeof name==="string"); '
    '} catch (error) { '
    'console.error("MARK_CHECK=FAIL "+trace+" unreadable "+error.message); '
    'failed=true; '
    'continue; '
    '} '
    'const missing=prefixes.filter((prefix)=>!names.some((name)=>name===prefix || name.startsWith(prefix+":"))); '
    'if (missing.length > 0) { '
    'console.error("MARK_CHECK=FAIL "+trace+" missing "+missing.join(",")); '
    'failed=true; '
    '} else { '
    'console.log("MARK_CHECK=PASS "+trace); '
    '} '
    '} '
    'if (failed) process.exit(1); '
    'console.log("MARK_CHECK=PASS all_traces "+sessionDir);'
)

print("This helper is print-only. It does not execute captures, summaries, or mark checks.")
print()
print("Start target server:")
print(f"  node scripts/p0/serve_controlled_target.mjs --host {host} --port {port}")
print()
print("Set capture defaults once:")
print('  export P0E_RUN_STAMP="${P0E_RUN_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"')
print('  export P0_BROWSER="${P0_BROWSER:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"')
print('  export P0_MACHINE_LABEL="${P0_MACHINE_LABEL:-local-machine}"')
print('  export P0_MACHINE_CLASS="${P0_MACHINE_CLASS:-high-end-laptop}"')
print('  export P0_OPERATOR="${P0_OPERATOR:-$USER}"')
print()
print("Primary metrics: run_task_max_ms, run_task_p95_ms, long_task_count_50ms, and per-trace p0e mark coverage.")
print("Secondary metric: run_task_busy_pct, because the fixed capture window dilutes short burst cost.")
print()

for cell in cells:
    cell_id = cell["cell_id"]
    params = {
        "block_count": cell["block_count"],
        "chars_per_block": cell["chars_per_block"],
        **fixed,
    }
    target_url = f"{base_url}?{urlencode(params)}"
    out_dir = f"{output_root}/p0e-{cell_id}-${{P0E_RUN_STAMP}}"

    print(cell_id)
    print(f"  block_count={cell['block_count']}")
    print(f"  chars_per_block={cell['chars_per_block']}")
    print(f"  operation_type={fixed['operation_type']}")
    print(f"  microtask_mode={fixed['microtask_mode']}")
    print(f"  mutation_mode={fixed['mutation_mode']}")
    print("  warmup_runs=1")
    print("  measured_runs=5")
    print(f"  target_url={target_url}")
    print(f"  out_dir={out_dir}")
    print("  capture_command:")
    print("    bash scripts/p0/run_capture.sh \\")
    print('      --browser "$P0_BROWSER" \\')
    print(f"      --target-id p0e-{cell_id} \\")
    print("      --target-class controlled \\")
    print(f'      --target-url "{target_url}" \\')
    print(f'      --target-description "P0-E click-triggered batch commit {cell_id}" \\')
    print(f'      --build-label "p0e-click-batch-commit-{cell_id}" \\')
    print(f'      --notes "P0-E matrix cell_id={cell_id}; programmatic button.click after p0:capture:start; measures post-click batch/microtask processing, not native pointer dispatch" \\')
    print('      --machine-label "$P0_MACHINE_LABEL" \\')
    print('      --machine-class "$P0_MACHINE_CLASS" \\')
    print("      --network-mode local \\")
    print('      --operator "$P0_OPERATOR" \\')
    print(f"      --scenario {scenario_path} \\")
    print("      --warmup-runs 1 \\")
    print("      --measured-runs 5 \\")
    print(f'      --out-dir "{out_dir}"')
    print("  summarize_command:")
    print(f'    node scripts/p0/summarize_trace.mjs --session-dir "{out_dir}"')
    print("  mark_check_command:")
    print(f'    SESSION_DIR="{out_dir}" node --input-type=module -e \'{mark_check_js}\'')
    print()
PY
