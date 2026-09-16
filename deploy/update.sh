#!/usr/bin/env bash
# Deploy panfleto: fetch main, pull the reader image CI already built, restart.
# Run on the host: /opt/panfleto/deploy/update.sh
#
# The reader is NOT compiled here any more (Roadmap/09-platform-infra/ci-build-pipeline). The image
# is built for linux/arm64 by the `panfleto image` workflow on danybgoode/panfleto-core and pushed to
# ghcr.io/danybgoode/panfleto-core:<commit-sha>. This script derives that tag from the submodule pin
# itself, so the running container can never be a different commit from the one `main` points at.
#
# Rolling back (ci-build-pipeline story 2.2): put the old image in deploy/.env and re-run this —
#   MINIFLUX_IMAGE_PIN=ghcr.io/danybgoode/panfleto-core:<previous-sha>
# Delete that line and re-run to roll forward. MINIFLUX_IMAGE_PIN always wins over the submodule pin;
# MINIFLUX_IMAGE below is a managed line and is rewritten on every run.
#
# `landing` is still built here: it is a small Next.js image in this repo, not Go next to Postgres.
#
# NOTE, when a commit changes THIS script: bash keeps reading the replaced inode, so a plain run
# executes the old script. Reset first, then invoke the new one:
#   cd /opt/panfleto && git fetch origin && git reset --hard origin/main \
#     && git submodule update --init --recursive --force && ./deploy/update.sh
set -euo pipefail

REGISTRY_IMAGE=ghcr.io/danybgoode/panfleto-core
cd /opt/panfleto
git fetch origin
git reset --hard origin/main

# panfleto-core is a submodule pinned at a SHA (Roadmap/09-platform-infra/miniflux-upstream-resync).
# A checkout that predates the submodule can keep a plain directory there if it held untracked or
# ignored files, and `submodule update` refuses to clone into it - move it aside once.
if [ -d panfleto-core ] && [ ! -e panfleto-core/.git ]; then
  mv panfleto-core "panfleto-core.vendored-$(date +%Y%m%d%H%M%S)"
fi
git submodule sync --recursive
git submodule update --init --recursive --force

cd deploy
[ -f .env ] || { echo "deploy/.env is missing - see .env.example" >&2; exit 1; }

# Which image? A hand-set MINIFLUX_IMAGE_PIN (a deliberate rollback) beats the submodule pin.
pinned_sha=$(git -C ../panfleto-core rev-parse HEAD)
override=$(sed -n 's/^MINIFLUX_IMAGE_PIN=//p' .env | tail -n1)
image=${override:-$REGISTRY_IMAGE:$pinned_sha}
if [ -n "$override" ]; then
  echo "==> MINIFLUX_IMAGE_PIN is set in .env - deploying $image instead of the submodule pin ($pinned_sha)"
else
  echo "==> submodule pin $pinned_sha -> $image"
fi

# Rewrite the managed MINIFLUX_IMAGE line in place, preserving the file's mode.
tmp=$(mktemp)
cp -p .env "$tmp"
grep -v '^MINIFLUX_IMAGE=' "$tmp" > "$tmp.new" || true
printf 'MINIFLUX_IMAGE=%s\n' "$image" >> "$tmp.new"
cat "$tmp.new" > .env          # `cat >` keeps .env's own inode, owner and 600 mode
rm -f "$tmp" "$tmp.new"

# The reader is pulled; only the landing page is built here.
docker compose pull miniflux
docker compose build landing
docker compose up -d
docker image prune -f

docker compose ps
echo "==> running: $(docker compose exec -T miniflux miniflux -version 2>/dev/null || echo '(version unavailable)')"
