#!/usr/bin/env bash
# Pull the latest commit and rebuild the stack in place.
# Run on the host: /opt/panfleto/deploy/update.sh
set -euo pipefail

cd /opt/panfleto
git fetch origin
git reset --hard origin/main

# panfleto-core is a submodule pinned at a SHA (Roadmap/09-platform-infra/miniflux-upstream-resync).
# A checkout that predates the submodule still has a plain directory there holding untracked build
# leftovers, which `submodule update` refuses to clone over - move it aside once.
if [ -d panfleto-core ] && [ ! -e panfleto-core/.git ]; then
  mv panfleto-core "panfleto-core.vendored-$(date +%Y%m%d%H%M%S)"
fi
git submodule sync --recursive
git submodule update --init --recursive --force

cd deploy
docker compose build
docker compose up -d
docker image prune -f

docker compose ps
