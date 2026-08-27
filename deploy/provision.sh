#!/usr/bin/env bash
#
# Provision the Oracle Cloud Always Free infrastructure for panfleto.
#
# Idempotent: every resource is looked up by display name before it is created,
# so re-running after a failure picks up where it left off.
#
# Sized deliberately to the Always Free allowance as of June 2026
# (2 OCPU / 12 GB Ampere A1, 200 GB block storage) so nothing is reclaimed
# when the 30-day trial ends.
#
# Usage: ./deploy/provision.sh
set -euo pipefail

# ---------------------------------------------------------------- configuration
PREFIX="${PREFIX:-panfleto}"
REGION="${REGION:-mx-queretaro-1}"
VCN_CIDR="10.0.0.0/16"
SUBNET_CIDR="10.0.1.0/24"

OCPUS=2           # Always Free ceiling: 1,500 OCPU-hours/month
MEMORY_GB=12      # Always Free ceiling: 9,000 GB-hours/month
BOOT_GB=50        # minimum boot volume size
DATA_GB=50        # /data - Postgres + Miniflux state; 100 GB of the free 200 GB total

SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/panfleto_oci.pub}"
CLOUD_INIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cloud-init.yaml"

# SSH ingress is restricted to this address. Residential IPs rotate; when yours
# does, re-run deploy/allow-my-ip.sh to update the rule.
ADMIN_CIDR="${ADMIN_CIDR:-$(curl -fsS --max-time 15 https://api.ipify.org)/32}"

TENANCY="$(grep '^tenancy=' ~/.oci/config | cut -d= -f2)"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }

# Emit the OCID of the first live resource with this name, or empty string.
# Most services call the field 'display-name'; IAM compartments call it 'name'.
find_by_name() { # <json> <name>
  echo "$1" | python3 -c "
import sys, json
name = sys.argv[1]
try:
    data = json.load(sys.stdin).get('data') or []
except Exception:
    sys.exit(0)
dead = ('TERMINATED', 'TERMINATING', 'DELETED', 'FAILED')
for r in data:
    if r.get('display-name') == name or r.get('name') == name:
        if r.get('lifecycle-state') not in dead:
            print(r['id']); break
" "$2"
}

# ------------------------------------------------------------------ compartment
log "Compartment"
COMPARTMENT_ID="$(find_by_name "$(oci iam compartment list --compartment-id "$TENANCY" --all 2>/dev/null)" "$PREFIX")"
if [ -z "$COMPARTMENT_ID" ]; then
  COMPARTMENT_ID="$(oci iam compartment create \
    --compartment-id "$TENANCY" \
    --name "$PREFIX" \
    --description "panfleto / justread RSS reader" \
    --wait-for-state ACTIVE \
    --query 'data.id' --raw-output)"
  echo "    created $COMPARTMENT_ID"
  sleep 15   # IAM is eventually consistent; give the policy cache a moment
else
  echo "    exists $COMPARTMENT_ID"
fi
C=(--compartment-id "$COMPARTMENT_ID")

# ------------------------------------------------------------------------- VCN
log "VCN"
VCN_ID="$(find_by_name "$(oci network vcn list "${C[@]}" --all 2>/dev/null)" "$PREFIX-vcn")"
if [ -z "$VCN_ID" ]; then
  VCN_ID="$(oci network vcn create "${C[@]}" \
    --cidr-block "$VCN_CIDR" \
    --display-name "$PREFIX-vcn" \
    --dns-label "${PREFIX}vcn" \
    --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)"
  echo "    created $VCN_ID"
else
  echo "    exists $VCN_ID"
fi

# -------------------------------------------------------------- internet gateway
log "Internet gateway"
IGW_ID="$(find_by_name "$(oci network internet-gateway list "${C[@]}" --vcn-id "$VCN_ID" --all 2>/dev/null)" "$PREFIX-igw")"
if [ -z "$IGW_ID" ]; then
  IGW_ID="$(oci network internet-gateway create "${C[@]}" \
    --vcn-id "$VCN_ID" --is-enabled true \
    --display-name "$PREFIX-igw" \
    --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)"
  echo "    created $IGW_ID"
else
  echo "    exists $IGW_ID"
fi

# ----------------------------------------------------------------- route table
log "Route table"
DEFAULT_RT="$(oci network vcn get --vcn-id "$VCN_ID" --query 'data."default-route-table-id"' --raw-output)"
oci network route-table update --rt-id "$DEFAULT_RT" --force \
  --route-rules "[{\"cidrBlock\":\"0.0.0.0/0\",\"networkEntityId\":\"$IGW_ID\"}]" >/dev/null
echo "    default route -> internet gateway"

# ---------------------------------------------------------------- security list
# 80/443 open to the world (Cloudflare fronts it, but ACME HTTP-01 needs
# direct reachability). 22 restricted to ADMIN_CIDR.
log "Security list"
DEFAULT_SL="$(oci network vcn get --vcn-id "$VCN_ID" --query 'data."default-security-list-id"' --raw-output)"
INGRESS="$(python3 - "$ADMIN_CIDR" <<'PY'
import json, sys
admin = sys.argv[1]
def tcp(src, port, desc):
    return {"protocol":"6","source":src,"isStateless":False,
            "tcpOptions":{"destinationPortRange":{"min":port,"max":port}},
            "description":desc}
print(json.dumps([
    tcp(admin, 22, "SSH from admin"),
    tcp("0.0.0.0/0", 80, "HTTP - ACME challenge + redirect"),
    tcp("0.0.0.0/0", 443, "HTTPS"),
    {"protocol":"1","source":"0.0.0.0/0","isStateless":False,
     "icmpOptions":{"type":3,"code":4},"description":"Path MTU discovery"},
]))
PY
)"
oci network security-list update --security-list-id "$DEFAULT_SL" --force \
  --ingress-security-rules "$INGRESS" \
  --egress-security-rules '[{"protocol":"all","destination":"0.0.0.0/0","isStateless":false}]' >/dev/null
echo "    SSH from $ADMIN_CIDR; 80/443 from anywhere"

# ---------------------------------------------------------------------- subnet
log "Subnet"
SUBNET_ID="$(find_by_name "$(oci network subnet list "${C[@]}" --vcn-id "$VCN_ID" --all 2>/dev/null)" "$PREFIX-public")"
if [ -z "$SUBNET_ID" ]; then
  SUBNET_ID="$(oci network subnet create "${C[@]}" \
    --vcn-id "$VCN_ID" \
    --cidr-block "$SUBNET_CIDR" \
    --display-name "$PREFIX-public" \
    --dns-label "public" \
    --route-table-id "$DEFAULT_RT" \
    --security-list-ids "[\"$DEFAULT_SL\"]" \
    --prohibit-public-ip-on-vnic false \
    --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)"
  echo "    created $SUBNET_ID"
else
  echo "    exists $SUBNET_ID"
fi

# ------------------------------------------------------------------- AD + image
AD="$(oci iam availability-domain list --compartment-id "$TENANCY" --query 'data[0].name' --raw-output)"
log "Availability domain $AD"

IMAGE_ID="$(oci compute image list "${C[@]}" \
  --operating-system "Canonical Ubuntu" \
  --operating-system-version "24.04" \
  --shape "VM.Standard.A1.Flex" \
  --sort-by TIMECREATED --sort-order DESC \
  --query 'data[0].id' --raw-output)"
log "Image $IMAGE_ID"

# -------------------------------------------------------------------- instance
log "Compute instance (A1.Flex ${OCPUS} OCPU / ${MEMORY_GB} GB)"
INSTANCE_ID="$(find_by_name "$(oci compute instance list "${C[@]}" --all 2>/dev/null)" "$PREFIX-prod")"
if [ -z "$INSTANCE_ID" ]; then
  # "Out of host capacity" is the usual A1 failure. Retry rather than fall over.
  for attempt in $(seq 1 20); do
    if INSTANCE_ID="$(oci compute instance launch "${C[@]}" \
        --availability-domain "$AD" \
        --display-name "$PREFIX-prod" \
        --shape "VM.Standard.A1.Flex" \
        --shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEMORY_GB}" \
        --image-id "$IMAGE_ID" \
        --boot-volume-size-in-gbs "$BOOT_GB" \
        --subnet-id "$SUBNET_ID" \
        --assign-public-ip true \
        --ssh-authorized-keys-file "$SSH_KEY_FILE" \
        --user-data-file "$CLOUD_INIT" \
        --wait-for-state RUNNING \
        --query 'data.id' --raw-output 2>/tmp/panfleto-launch.err)"; then
      echo "    launched $INSTANCE_ID"
      break
    fi
    if grep -qi 'capacity' /tmp/panfleto-launch.err; then
      warn "attempt $attempt: out of host capacity, retrying in 60s"
      sleep 60
    else
      cat /tmp/panfleto-launch.err >&2
      exit 1
    fi
  done
  [ -n "${INSTANCE_ID:-}" ] || { warn "could not get capacity after 20 attempts"; exit 1; }
else
  echo "    exists $INSTANCE_ID"
fi

# ---------------------------------------------------------------- block volume
log "Block volume (/data, ${DATA_GB} GB)"
VOL_ID="$(find_by_name "$(oci bv volume list "${C[@]}" --all 2>/dev/null)" "$PREFIX-data")"
if [ -z "$VOL_ID" ]; then
  VOL_ID="$(oci bv volume create "${C[@]}" \
    --availability-domain "$AD" \
    --display-name "$PREFIX-data" \
    --size-in-gbs "$DATA_GB" \
    --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)"
  echo "    created $VOL_ID"
else
  echo "    exists $VOL_ID"
fi

ATTACHED="$(oci compute volume-attachment list "${C[@]}" --instance-id "$INSTANCE_ID" \
  --query "data[?\"volume-id\"=='$VOL_ID' && \"lifecycle-state\"=='ATTACHED'].id | [0]" --raw-output 2>/dev/null || true)"
if [ -z "$ATTACHED" ] || [ "$ATTACHED" = "null" ]; then
  # iSCSI rather than paravirtualized: cloud-init's disk setup runs before the
  # attachment exists, so /data is mounted by the runcmd block instead.
  oci compute volume-attachment attach \
    --instance-id "$INSTANCE_ID" --volume-id "$VOL_ID" \
    --type paravirtualized --device /dev/oracleoci/oraclevdb \
    --wait-for-state ATTACHED >/dev/null
  echo "    attached"
else
  echo "    already attached"
fi

# ------------------------------------------------------------ reserved public IP
# A reserved IP survives instance rebuilds, so the Cloudflare records stay valid.
log "Reserved public IP"
VNIC_ID="$(oci compute instance list-vnics "${C[@]}" --instance-id "$INSTANCE_ID" --query 'data[0].id' --raw-output)"
PRIV_IP_ID="$(oci network private-ip list --vnic-id "$VNIC_ID" --query 'data[0].id' --raw-output)"

RESERVED_ID="$(find_by_name "$(oci network public-ip list "${C[@]}" --scope REGION --all --lifetime RESERVED 2>/dev/null)" "$PREFIX-ip")"
if [ -z "$RESERVED_ID" ]; then
  # Drop the ephemeral IP first - a private IP can hold only one public IP.
  EPH_ID="$(oci network public-ip list "${C[@]}" --scope AVAILABILITY_DOMAIN \
    --availability-domain "$AD" --all --lifetime EPHEMERAL \
    --query "data[?\"private-ip-id\"=='$PRIV_IP_ID'].id | [0]" --raw-output 2>/dev/null || true)"
  if [ -n "$EPH_ID" ] && [ "$EPH_ID" != "null" ]; then
    oci network public-ip delete --public-ip-id "$EPH_ID" --force --wait-for-state TERMINATED >/dev/null 2>&1 || true
    sleep 10
  fi
  RESERVED_ID="$(oci network public-ip create "${C[@]}" \
    --display-name "$PREFIX-ip" --lifetime RESERVED \
    --private-ip-id "$PRIV_IP_ID" \
    --wait-for-state ASSIGNED \
    --query 'data.id' --raw-output)"
  echo "    created $RESERVED_ID"
else
  echo "    exists $RESERVED_ID"
fi
PUBLIC_IP="$(oci network public-ip get --public-ip-id "$RESERVED_ID" --query 'data."ip-address"' --raw-output)"

# ------------------------------------------------ instance principal for backups
# A dynamic group + policy lets the VM write backups to Object Storage using its
# own identity, so no API keys ever land on disk.
log "Instance principal for Object Storage backups"
DG_NAME="$PREFIX-instances"
if ! oci iam dynamic-group list --all --query "data[?name=='$DG_NAME'].id | [0]" --raw-output 2>/dev/null | grep -q ocid1; then
  oci iam dynamic-group create \
    --name "$DG_NAME" \
    --description "panfleto compute instances" \
    --matching-rule "instance.compartment.id = '$COMPARTMENT_ID'" >/dev/null
  echo "    dynamic group created"
else
  echo "    dynamic group exists"
fi

POLICY_NAME="$PREFIX-backup-policy"
if ! oci iam policy list --compartment-id "$TENANCY" --all --query "data[?name=='$POLICY_NAME'].id | [0]" --raw-output 2>/dev/null | grep -q ocid1; then
  oci iam policy create --compartment-id "$TENANCY" \
    --name "$POLICY_NAME" \
    --description "Allow panfleto instances to write backups" \
    --statements "[\"Allow dynamic-group $DG_NAME to manage objects in compartment $PREFIX\",\"Allow dynamic-group $DG_NAME to read buckets in compartment $PREFIX\"]" >/dev/null
  echo "    policy created"
else
  echo "    policy exists"
fi

# ------------------------------------------------------------- backup bucket
log "Object Storage bucket"
NAMESPACE="$(oci os ns get --query 'data' --raw-output)"
if ! oci os bucket get --namespace "$NAMESPACE" --bucket-name "$PREFIX-backups" >/dev/null 2>&1; then
  oci os bucket create --namespace "$NAMESPACE" "${C[@]}" \
    --name "$PREFIX-backups" --storage-tier Standard \
    --public-access-type NoPublicAccess >/dev/null
  echo "    created"
else
  echo "    exists"
fi

# Lifecycle rules are executed by the Object Storage service principal, which
# needs its own grant before it will accept a policy on the bucket.
OS_POLICY_NAME="$PREFIX-objectstorage-lifecycle"
if ! oci iam policy list --compartment-id "$TENANCY" --all --query "data[?name=='$OS_POLICY_NAME'].id | [0]" --raw-output 2>/dev/null | grep -q ocid1; then
  oci iam policy create --compartment-id "$TENANCY" \
    --name "$OS_POLICY_NAME" \
    --description "Let Object Storage expire old backups" \
    --statements "[\"Allow service objectstorage-$REGION to manage object-family in compartment $PREFIX\"]" >/dev/null
  echo "    service principal granted"
  sleep 20   # IAM propagation, otherwise the policy put below still 400s
else
  echo "    service principal already granted"
fi

# 30-day retention keeps us far inside the 20 GB Always Free allowance.
oci os object-lifecycle-policy put --force --namespace "$NAMESPACE" --bucket-name "$PREFIX-backups" \
  --items '[{"name":"expire-30d","action":"DELETE","timeAmount":30,"timeUnit":"DAYS","isEnabled":true,"objectNameFilter":{"inclusionPrefixes":["db/"]}}]' >/dev/null
echo "    30-day retention policy applied"

# -------------------------------------------------------------------- summary
cat <<SUMMARY

────────────────────────────────────────────────────────────
  Provisioned
────────────────────────────────────────────────────────────
  Compartment   $COMPARTMENT_ID
  Instance      $INSTANCE_ID
  Public IP     $PUBLIC_IP   (reserved)
  Bucket        $PREFIX-backups  (namespace $NAMESPACE)

  ssh -i ${SSH_KEY_FILE%.pub} ubuntu@$PUBLIC_IP

  Point these Cloudflare A records at $PUBLIC_IP :
    panfleto.win        A  $PUBLIC_IP
    www.panfleto.win    A  $PUBLIC_IP
    app.panfleto.win    A  $PUBLIC_IP
────────────────────────────────────────────────────────────
SUMMARY
