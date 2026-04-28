#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.." || exit 1

echo "P0-D Controlled Target v2 Matrix"
echo
python3 - <<'PY'
import json
from pathlib import Path
from urllib.parse import urlencode

cfg = json.loads(Path("bench/p0/scenarios/p0d_matrix.json").read_text())
common = cfg["common"]
host = "127.0.0.1"
port = 4317
scenario_path = "bench/p0/scenarios/s01_tail_append.json"
output_root = "/tmp/streaming-ui-runtime-p0"
base_url = f"http://{host}:{port}/controlled_append_surface.html"

print("Start target server:")
print(f"  node scripts/p0/serve_controlled_target.mjs --host {host} --port {port}")
print()
print("Set capture defaults once:")
print('  export P0D_RUN_STAMP="${P0D_RUN_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"')
print('  export P0_BROWSER="${P0_BROWSER:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"')
print('  export P0_MACHINE_LABEL="${P0_MACHINE_LABEL:-local-machine}"')
print('  export P0_MACHINE_CLASS="${P0_MACHINE_CLASS:-high-end-laptop}"')
print('  export P0_OPERATOR="${P0_OPERATOR:-$USER}"')
print()

for cell in cfg["cells"]:
    cell_id = cell["cell_id"]
    params = {
        "cell_id": cell_id,
        "seed_blocks": cell["seed_blocks"],
        "chars_per_block": cell["chars_per_block"],
        "append_interval_ms": common["append_interval_ms"],
        "capture_window_s": common["capture_window_s"],
        "block_style": common["block_style"],
    }
    target_url = f"{base_url}?{urlencode(params)}"
    out_dir = f"{output_root}/p0d-{cell_id}-${{P0D_RUN_STAMP}}"

    print(cell["cell_id"])
    print(f"  mass_bucket={cell['mass_bucket']}")
    print(f"  boundary_bucket={cell['boundary_bucket']}")
    print(f"  seed_blocks={cell['seed_blocks']}")
    print(f"  chars_per_block={cell['chars_per_block']}")
    print(f"  append_interval_ms={common['append_interval_ms']}")
    print(f"  capture_window_s={common['capture_window_s']}")
    print(f"  block_style={common['block_style']}")
    print(f"  replicates={common['replicates']}")
    print(f"  target_url={target_url}")
    print(f"  out_dir={out_dir}")
    print("  capture_command:")
    print("    bash scripts/p0/run_capture.sh \\")
    print('      --browser "$P0_BROWSER" \\')
    print(f"      --target-id p0d-{cell_id} \\")
    print("      --target-class controlled \\")
    print(f'      --target-url "{target_url}" \\')
    print(f'      --target-description "P0-D controlled target v2 {cell_id}" \\')
    print(f'      --build-label "p0d-controlled-target-v2-{cell_id}" \\')
    print(f'      --notes "P0-D cell_id={cell_id}; capture_window_s={common["capture_window_s"]} is target audit metadata; harness scenario owns capture_ms" \\')
    print('      --machine-label "$P0_MACHINE_LABEL" \\')
    print('      --machine-class "$P0_MACHINE_CLASS" \\')
    print("      --network-mode local \\")
    print('      --operator "$P0_OPERATOR" \\')
    print(f"      --scenario {scenario_path} \\")
    print("      --warmup-runs 1 \\")
    print(f"      --measured-runs {common['replicates']} \\")
    print(f'      --out-dir "{out_dir}"')
    print("  summarize_command:")
    print(f'    node scripts/p0/summarize_trace.mjs --session-dir "{out_dir}"')
    print()
PY
