---
title: "Stop compiling Go on the production VM"
slug: ci-build-pipeline
status: raw
area: "09"
type: chore
priority: null
appetite: M
underwritten_by: null
risk: high
epic: null
build_order: 8
updated: 2026-09-14
---

# Seed — Stop compiling Go on the production VM

> **Portfolio pass only — not Definition of Ready.** Sequenced, sized and lane-assigned so it is
> bettable; deep-groom it when it reaches the front of the queue.

## Problem
`deploy/update.sh` pulls `main` and rebuilds the images **on the single production VM**. Three
consequences, all of which get worse as the project gets busier:

1. A compile error takes the reader down, because the failure happens on the host serving users.
2. A full Miniflux build competes for 2 OCPU with a Postgres deliberately holding 3 GB of
   `shared_buffers` (sized that way to dodge Oracle's idle-reclaim heuristic — see
   `deploy/docker-compose.yml`).
3. There is **no previous artifact to roll back to**. Rollback is `git revert` on `main` plus
   another slow rebuild on the same box.

This is also what makes the upstream resync scarier than it needs to be: the first rebase onto 131
upstream commits will be validated by building it in production.

## Appetite
**M** — one wave. Build a multi-arch image in Actions, push to GHCR, turn `update.sh` into a pull.

## Lane
**Shaped bet.** It changes the deploy rail, which is the kind of expensive-to-reverse decision the
betting table exists for.

## Rough shape
- GitHub Actions builds `linux/arm64` from `panfleto-core/packaging/docker/alpine/Dockerfile`
- Push to GHCR, tagged by commit SHA and by `main`
- `deploy/docker-compose.yml` switches `build:` to `image:` for the miniflux service
- `update.sh` becomes `docker compose pull && docker compose up -d`
- Rollback becomes: pin the previous SHA tag and re-run

## Why it isn't obviously free
GitHub Actions minutes are **metered for private repos** from one account-wide pool, and an arm64
build is slow on a hosted runner (QEMU) unless an arm runner is used. Check
`gh repo view --json isPrivate` before betting — if this repo is public, the minutes are free and
this is a much cheaper bet than it looks.

## Depends on / unblocks
Not blocking anything, but it **de-risks** `miniflux-upstream-resync` and every future rebase, so
there is a real argument for pulling it earlier than position 8.
