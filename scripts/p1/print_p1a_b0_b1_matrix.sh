#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.." || exit 1

echo "P1-A AI Streaming B0/B1 Bring-up Matrix"
echo
python3 - <<'PY'
from urllib.parse import urlencode

host = "127.0.0.1"
port = 4319
target_base_url = f"http://{host}:{port}/p1_streaming_chat_baseline.html"
output_root = "/tmp/streaming-ui-runtime-p1"

baselines = [
    {
        "baseline_id": "naive-dom",
        "label": "B0 naive DOM chat",
        "description": "P1-A B0 naive DOM chat AI streaming workload",
    },
    {
        "baseline_id": "optimized-dom",
        "label": "B1 optimized DOM chat",
        "description": "P1-A B1 optimized DOM chat AI streaming workload",
    },
]

scenarios = [
    {
        "scenario_id": "p1a_stream_tail_follow_20ms",
        "scenario_path": "bench/p1/scenarios/p1a_stream_tail_follow_20ms.json",
        "scenario_mode": "tail-follow",
    },
    {
        "scenario_id": "p1a_stream_scrollback_resume_20ms",
        "scenario_path": "bench/p1/scenarios/p1a_stream_scrollback_resume_20ms.json",
        "scenario_mode": "scrollback-resume",
    },
]

print("This helper is print-only. It does not execute captures, summaries, or analyzers.")
print()
print("Start P1-A streaming baseline target server:")
print(f"  node scripts/p1/serve_p1_streaming_baselines.mjs --host {host} --port {port}")
print()
print("Set capture defaults once:")
print('  export P1A_RUN_STAMP="${P1A_RUN_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"')
print('  export P0_BROWSER="${P0_BROWSER:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"')
print('  export P0_MACHINE_LABEL="${P0_MACHINE_LABEL:-local-machine}"')
print('  export P0_MACHINE_CLASS="${P0_MACHINE_CLASS:-high-end-laptop}"')
print('  export P0_OPERATOR="${P0_OPERATOR:-$USER}"')
print()
print("P1-A bring-up success requires 5/5 valid measured runs, 800 streamed tokens, 100% p1 mark coverage, ready/idle confirmation, and a clear B0/B1 differentiation result or workload-too-weak conclusion.")
print("Primary metrics: run_task_max_ms, run_task_p95_ms, long_task_count_50ms, P1 stream mark coverage, final token count, and tail_miss_count.")
print("busy_pct is secondary because the fixed 45s capture window dilutes streaming bursts.")
print("B2 virtualization and B3 CodeMirror/Monaco are not included in this first slice.")
print()

for baseline in baselines:
    for scenario in scenarios:
        cell_id = f'{baseline["baseline_id"]}-{scenario["scenario_id"]}'
        params = {
            "baseline_id": baseline["baseline_id"],
            "history_messages": 160,
            "stream_tokens": 800,
            "token_interval_ms": 20,
            "content_mix": "standard",
            "scenario_mode": scenario["scenario_mode"],
            "seed": "p1a-v1",
        }
        target_url = f"{target_base_url}?{urlencode(params)}"
        out_dir = f"{output_root}/p1a-{cell_id}-${{P1A_RUN_STAMP}}"

        print(cell_id)
        print(f"  baseline={baseline['label']}")
        print(f"  scenario_id={scenario['scenario_id']}")
        print("  history_messages=160")
        print("  stream_tokens=800")
        print("  token_interval_ms=20")
        print("  content_mix=standard")
        print(f"  scenario_mode={scenario['scenario_mode']}")
        print("  warmup_runs=1")
        print("  measured_runs=5")
        print(f"  target_url={target_url}")
        print(f"  out_dir={out_dir}")
        print("  capture_command:")
        print("    bash scripts/p0/run_capture.sh \\")
        print('      --browser "$P0_BROWSER" \\')
        print(f'      --target-id "p1a-{cell_id}" \\')
        print("      --target-class controlled \\")
        print(f'      --target-url "{target_url}" \\')
        print(f'      --target-description "{baseline["description"]}; scenario={scenario["scenario_id"]}" \\')
        print(f'      --build-label "p1a-ai-streaming-b0-b1-{cell_id}" \\')
        print(f'      --notes "P1-A bring-up only; true AI streaming workload; baseline={baseline["baseline_id"]}; scenario={scenario["scenario_id"]}; 800 tokens at 20ms; history mounted before capture; not a P2 runtime implementation" \\')
        print('      --machine-label "$P0_MACHINE_LABEL" \\')
        print('      --machine-class "$P0_MACHINE_CLASS" \\')
        print("      --network-mode local \\")
        print('      --operator "$P0_OPERATOR" \\')
        print(f"      --scenario {scenario['scenario_path']} \\")
        print("      --warmup-runs 1 \\")
        print("      --measured-runs 5 \\")
        print(f'      --out-dir "{out_dir}"')
        print("  summarize_command:")
        print(f'    node scripts/p0/summarize_trace.mjs --session-dir "{out_dir}"')
        print("  analyze_command:")
        print(f'    node scripts/p1/analyze_p1a_streaming_trace.mjs --session-dir "{out_dir}"')
        print()
PY
