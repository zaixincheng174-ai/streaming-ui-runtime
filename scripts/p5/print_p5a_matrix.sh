#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.." || exit 1

node scripts/p5/audit_p5a_synthetic_workload.mjs
