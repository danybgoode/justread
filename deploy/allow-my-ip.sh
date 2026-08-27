#!/usr/bin/env bash
# Re-point the SSH ingress rule at whatever address you are on now.
# Residential IPs rotate; run this from the machine you want to connect from.
set -euo pipefail

PREFIX="${PREFIX:-panfleto}"
TENANCY="$(grep '^tenancy=' ~/.oci/config | cut -d= -f2)"
MY_IP="$(curl -fsS --max-time 15 https://api.ipify.org)/32"

COMPARTMENT_ID="$(oci iam compartment list --compartment-id "$TENANCY" --all \
  --query "data[?name=='$PREFIX'].id | [0]" --raw-output)"
VCN_ID="$(oci network vcn list --compartment-id "$COMPARTMENT_ID" --all \
  --query "data[?\"display-name\"=='$PREFIX-vcn'].id | [0]" --raw-output)"
SL_ID="$(oci network vcn get --vcn-id "$VCN_ID" \
  --query 'data."default-security-list-id"' --raw-output)"

RULES="$(oci network security-list get --security-list-id "$SL_ID" \
  --query 'data."ingress-security-rules"' | python3 -c "
import json, sys
rules = json.load(sys.stdin)
for r in rules:
    opts = r.get('tcp-options') or {}
    rng = opts.get('destination-port-range') or {}
    if rng.get('min') == 22:
        r['source'] = sys.argv[1]
print(json.dumps(rules))
" "$MY_IP")"

oci network security-list update --security-list-id "$SL_ID" --force \
  --ingress-security-rules "$RULES" >/dev/null

echo "SSH ingress now allows $MY_IP"
