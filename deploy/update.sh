#!/usr/bin/env bash
# Pull the latest commit and rebuild the stack in place.
# Run on the host: /opt/panfleto/deploy/update.sh
set -euo pipefail

cd /opt/panfleto
git fetch origin
git reset --hard origin/main

cd deploy
docker compose build
docker compose up -d
docker image prune -f

docker compose ps
