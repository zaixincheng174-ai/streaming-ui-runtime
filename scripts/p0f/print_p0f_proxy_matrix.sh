#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.." || exit 1

echo "P0-F Proxy Baseline Variant Matrix"
echo
python3 - <<'PY'
from urllib.parse import urlencode

host = "127.0.0.1"
port = 4318
scenario_path = "bench/p0f/scenarios/p0f_proxy_click_batch_commit.json"
output_root = "/tmp/streaming-ui-runtime-p0f"
reference_url = f"http://{host}:{port}/p0e-reference.html"
baseline_url = f"http://{host}:{port}/p0f_proxy_baseline_surface.html"

workloads = [
    {
        "workload_id": "E4_data_attribute_update",
        "block_count": 10000,
        "chars_per_block": 800,
        "operation_type": "dom-text-scan",
        "microtask_mode": "true",
        "mutation_mode": "data-attribute-update",
    },
    {
        "workload_id": "E4_read_only",
        "block_count": 10000,
        "chars_per_block": 800,
        "operation_type": "dom-text-scan",
        "microtask_mode": "true",
        "mutation_mode": "read-only",
    },
]

baselines = [
    {
        "baseline_id": "p0e-reference",
        "target_path": "p0e-reference.html",
        "target_url_base": reference_url,
        "operation_scope": None,
        "description": "P0-E unchanged reference target",
    },
    {
        "baseline_id": "naive-dom",
        "target_path": "p0f_proxy_baseline_surface.html",
        "target_url_base": baseline_url,
        "operation_scope": "logical-full",
        "description": "P0-F naive full DOM proxy baseline",
    },
    {
        "baseline_id": "optimized-dom",
        "target_path": "p0f_proxy_baseline_surface.html",
        "target_url_base": baseline_url,
        "operation_scope": "logical-full",
        "description": "P0-F optimized full DOM proxy baseline",
    },
    {
        "baseline_id": "virtualized-dom",
        "target_path": "p0f_proxy_baseline_surface.html",
        "target_url_base": baseline_url,
        "operation_scope": "logical-full",
        "description": "P0-F virtualized DOM logical-full proxy baseline",
    },
    {
        "baseline_id": "text-buffer-proxy",
        "target_path": "p0f_proxy_baseline_surface.html",
        "target_url_base": baseline_url,
        "operation_scope": "logical-full",
        "description": "P0-F no-dependency text-buffer proxy baseline",
    },
]

print("This helper is print-only. It does not execute captures, summaries, or analyzers.")
print()
print("Start P0-F proxy target server:")
print(f"  node scripts/p0f/serve_p0f_proxy_baselines.mjs --host {host} --port {port}")
print()
print("Set capture defaults once:")
print('  export P0F_RUN_STAMP="${P0F_RUN_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"')
print('  export P0_BROWSER="${P0_BROWSER:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"')
print('  export P0_MACHINE_LABEL="${P0_MACHINE_LABEL:-local-machine}"')
print('  export P0_MACHINE_CLASS="${P0_MACHINE_CLASS:-high-end-laptop}"')
print('  export P0_OPERATOR="${P0_OPERATOR:-$USER}"')
print()
print("Primary metrics: run_task_max_ms, run_task_p95_ms, long_task_count_50ms, per-trace mark coverage, and batch-window microtask dominance when available.")
print("Secondary metric: run_task_busy_pct, because the fixed capture window dilutes short burst cost.")
print("Primary virtualized comparison uses operation_scope=logical-full. Visible-only virtualization is diagnostic only and is not printed here.")
print()

for baseline in baselines:
    for workload in workloads:
        baseline_id = baseline["baseline_id"]
        workload_id = workload["workload_id"]
        params = {
            "block_count": workload["block_count"],
            "chars_per_block": workload["chars_per_block"],
            "operation_type": workload["operation_type"],
            "microtask_mode": workload["microtask_mode"],
            "mutation_mode": workload["mutation_mode"],
        }
        if baseline_id != "p0e-reference":
            params = {
                "baseline_id": baseline_id,
                **params,
                "operation_scope": baseline["operation_scope"],
            }

        target_url = f'{baseline["target_url_base"]}?{urlencode(params)}'
        cell_id = f"{baseline_id}-{workload_id}"
        out_dir = f"{output_root}/p0f-{cell_id}-${{P0F_RUN_STAMP}}"
        operation_scope = baseline["operation_scope"] or "p0e-reference"

        print(cell_id)
        print(f"  baseline_id={baseline_id}")
        print(f"  workload_id={workload_id}")
        print(f"  block_count={workload['block_count']}")
        print(f"  chars_per_block={workload['chars_per_block']}")
        print(f"  operation_type={workload['operation_type']}")
        print(f"  microtask_mode={workload['microtask_mode']}")
        print(f"  mutation_mode={workload['mutation_mode']}")
        print(f"  operation_scope={operation_scope}")
        print("  warmup_runs=1")
        print("  measured_runs=5")
        print(f"  target_url={target_url}")
        print(f"  out_dir={out_dir}")
        print("  capture_command:")
        print("    bash scripts/p0/run_capture.sh \\")
        print('      --browser "$P0_BROWSER" \\')
        print(f'      --target-id "p0f-{cell_id}" \\')
        print("      --target-class controlled \\")
        print(f'      --target-url "{target_url}" \\')
        print(f'      --target-description "{baseline["description"]} {workload_id}" \\')
        print(f'      --build-label "p0f-proxy-baselines-{cell_id}" \\')
        print(f'      --notes "P0-F proxy baseline={baseline_id}; workload={workload_id}; operation_scope={operation_scope}; programmatic button.click after p0:capture:start; measures post-click batch/microtask processing, not native pointer dispatch" \\')
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
        print("  analyze_command:")
        print(f'    node scripts/p0f/analyze_p0f_trace_windows.mjs --session-dir "{out_dir}"')
        print()
PY
