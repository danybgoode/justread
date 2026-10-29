#!/usr/bin/env bash
# Weekly restore drill: restore the newest local dump into a THROWAWAY Postgres and compare it with the live database.
# Run by panfleto-restore-drill.timer (Sunday 05:45 UTC). A backup that has never been restored is a hope, not a
# backup, and until 2026-10-29 panfleto's never had been.
#
# Production is never touched: the scratch container has no network and is removed WITH its volume on exit
# (`rm -fv`; the postgres image declares a VOLUME, and a plain `rm -f` leaves a full copy of the data behind).
# A failure exits non-zero, which leaves a failed systemd unit that the VM watchdog (danybgoode/oracle-edge)
# reports to Telegram.
set -euo pipefail

cd /opt/panfleto/deploy
# DUMP= overrides the newest dump, e.g. to prove the drill fails on a truncated one.
DUMP=${DUMP:-$(ls -1t /data/panfleto/backups/miniflux-*.sql.gz 2>/dev/null | head -1 || true)}
[ -n "$DUMP" ] || { echo "✗ no dump in /data/panfleto/backups" >&2; exit 1; }
NAME="panfleto-restore-drill-$$"
trap 'docker rm -fv "$NAME" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$NAME" --network none -e POSTGRES_USER=miniflux -e POSTGRES_PASSWORD=drill \
  -e POSTGRES_DB=miniflux --memory 1536m --cpus 0.5 postgres:17-alpine >/dev/null
# Over TCP: during init the entrypoint runs a socket-only server that answers pg_isready too early.
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -h 127.0.0.1 -U miniflux -d miniflux >/dev/null 2>&1 && break; sleep 2; done

echo "restoring $(basename "$DUMP") ($(du -h "$DUMP" | cut -f1))"
gunzip -c "$DUMP" | docker exec -i "$NAME" psql -q -v ON_ERROR_STOP=1 -U miniflux -d miniflux >/dev/null

count() { docker exec "$1" psql -U miniflux -d miniflux -tAc "select count(*) from $2"; }
live=$(docker compose ps -q postgres)
[ -n "$live" ] || { echo "✗ the live postgres is not running; nothing to compare against" >&2; exit 1; }

# The dump is from 04:30 and feeds keep polling, so exact equality is not expected. Users and feeds barely move;
# entries grow, and Miniflux also removes old ones. A restore far below live means a truncated or broken dump.
bad=0
for spec in users:95 feeds:90 entries:80; do
  t=${spec%%:*}; pct=${spec##*:}
  r=$(count "$NAME" "$t"); l=$(count "$live" "$t")
  if [ "$r" -lt 1 ] || [ $(( r * 100 )) -lt $(( l * pct )) ]; then
    echo "✗ $t: restored $r vs live $l (need ≥ ${pct}%)"; bad=1
  else
    echo "✓ $t: restored $r vs live $l"
  fi
done
[ "$bad" = 0 ] || exit 1
echo "✓ restore drill passed"
