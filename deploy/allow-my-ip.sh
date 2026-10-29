#!/usr/bin/env bash
# Moved to danybgoode/oracle-edge (ops/allow-my-ip.sh) on 2026-10-29, with everything else the VM's tenants share.
# It now also updates the operator allowlist the shared proxy uses. This stub keeps the old path working.
set -euo pipefail
target="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/oracle-edge/ops/allow-my-ip.sh"
[ -x "$target" ] || { echo "Clone danybgoode/oracle-edge next to this repo, then run ops/allow-my-ip.sh" >&2; exit 1; }
exec "$target" "$@"
