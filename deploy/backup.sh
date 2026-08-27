#!/usr/bin/env bash
# Nightly Postgres dump -> OCI Object Storage.
#
# Authenticates with the instance principal granted by the dynamic group in
# provision.sh, so there are no API keys on this host. Objects older than 30
# days are removed by the bucket lifecycle policy, not by this script.
set -euo pipefail

BUCKET="${BUCKET:-panfleto-backups}"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOCAL="/data/panfleto/backups/miniflux-$STAMP.sql.gz"

cd /opt/panfleto/deploy

docker compose exec -T postgres pg_dump -U miniflux --clean --if-exists miniflux \
  | gzip -9 > "$LOCAL"

# A dump that small means pg_dump failed or the database is empty; either way
# it should not silently replace a good backup.
if [ "$(stat -c%s "$LOCAL")" -lt 4096 ]; then
  echo "backup aborted: dump is only $(stat -c%s "$LOCAL") bytes" >&2
  rm -f "$LOCAL"
  exit 1
fi

NS="$(oci os ns get --auth instance_principal --query 'data' --raw-output)"
oci os object put --auth instance_principal \
  --namespace "$NS" --bucket-name "$BUCKET" \
  --name "db/miniflux-$STAMP.sql.gz" \
  --file "$LOCAL" --force >/dev/null

# Keep only the last 3 locally; the bucket is the real archive.
ls -1t /data/panfleto/backups/miniflux-*.sql.gz | tail -n +4 | xargs -r rm -f

echo "backed up db/miniflux-$STAMP.sql.gz ($(du -h "$LOCAL" | cut -f1))"
