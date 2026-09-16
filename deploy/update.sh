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
# Tolerate the shapes a human actually types into a .env at 3am: surrounding quotes, trailing spaces,
# a trailing \r from an editor that saved CRLF.
pinned_sha=$(git -C ../panfleto-core rev-parse HEAD)
override=$(sed -n 's/^[[:space:]]*MINIFLUX_IMAGE_PIN=//p' .env | tail -n1 \
  | tr -d '\r' | sed -e 's/[[:space:]]*$//' -e 's/^["'"'"']//' -e 's/["'"'"']$//' -e 's/[[:space:]]*$//')
image=${override:-$REGISTRY_IMAGE:$pinned_sha}
if [ -n "$override" ]; then
  echo "==> MINIFLUX_IMAGE_PIN is set in .env - deploying $image instead of the submodule pin ($pinned_sha)"
else
  echo "==> submodule pin $pinned_sha -> $image"
fi

# Fetch BEFORE touching .env. If CI has not finished building this commit (or GHCR is down), the pull
# fails here, .env still names the image that is actually running, and the live container is left
# alone - a deploy that does not happen, rather than a stack that cannot start.
if ! docker pull "$image"; then
  echo "" >&2
  echo "==> Could not pull $image. Nothing has changed; the reader is still serving." >&2
  echo "    Check https://github.com/danybgoode/panfleto-core/actions - the image is built on push," >&2
  echo "    so a commit whose workflow is still running (or failed) has no image yet. A docs-only" >&2
  echo "    commit is skipped by the workflow's path filter and never gets one at all; build it with" >&2
  echo "        gh workflow run 'panfleto image' --repo danybgoode/panfleto-core --ref $pinned_sha" >&2
  exit 1
fi

# Rewrite the managed MINIFLUX_IMAGE line. This file is the host's ONLY copy of the production
# secrets - it is git-ignored by AGENTS.md rule 4 and backup.sh does not back it up - so: build the
# new contents in a 600 temp file, refuse to proceed unless they still look like the real .env, keep
# a .env.bak of what was there, and only then truncate.
tmp=$(mktemp)   # mktemp is 600; the redirections below do not change an existing file's mode
trap 'rm -f "$tmp"' EXIT
grep -v '^[[:space:]]*MINIFLUX_IMAGE=' .env > "$tmp" || true   # 1 = every line matched; not an error
printf 'MINIFLUX_IMAGE=%s\n' "$image" >> "$tmp"
if ! grep -q '^[[:space:]]*POSTGRES_PASSWORD=' "$tmp"; then
  echo "==> Refusing to write deploy/.env: the rewritten copy has no POSTGRES_PASSWORD line." >&2
  echo "    .env is untouched. Check /tmp for space and re-run." >&2
  exit 1
fi
cp -p .env .env.bak        # `cp -p` keeps 600; .env.bak is git-ignored by the same `.env*` rule
cat "$tmp" > .env          # `cat >` keeps .env's own inode, owner and 600 mode

# The reader is already pulled; only the landing page is built here.
docker compose build landing
docker compose up -d
docker image prune -f          # dangling layers only - every SHA tag stays, which is what makes
                               # a rollback a restart instead of a rebuild

docker compose ps
for _ in 1 2 3 4 5; do
  running=$(docker compose exec -T miniflux miniflux -version 2>/dev/null) && break
  sleep 2
done
echo "==> running: ${running:-(version unavailable - check docker compose logs miniflux)}"

# Did we get what we asked for? The version stamp is `panfleto-<short sha>`, so this catches both a
# restart that silently kept the old container and a forgotten rollback pin still in force.
expected="panfleto-$(printf '%s' "${image##*:}" | cut -c1-8)"
if [ -n "${running:-}" ] && [ "$running" != "$expected" ] && [ -z "$override" ]; then
  echo "==> WARNING: expected $expected but the reader reports $running." >&2
fi
if [ -n "$override" ]; then
  echo ""
  echo "==> ***  deploy/.env still pins MINIFLUX_IMAGE_PIN=$override  ***"
  echo "==>      Until that line is removed, EVERY future update.sh deploys this image and ignores"
  echo "==>      what main says to run (submodule pin: $pinned_sha). To roll forward:"
  echo "==>          sed -i '/^MINIFLUX_IMAGE_PIN=/d' /opt/panfleto/deploy/.env && /opt/panfleto/deploy/update.sh"
fi
