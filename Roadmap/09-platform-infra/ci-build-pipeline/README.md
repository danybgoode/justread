---
status: scaffolded
slug: ci-build-pipeline
build_order: 8
---

# Epic: Stop compiling Go on the production VM

> **Area:** 09-platform-infra · **Risk:** high · **Class:** Chore · **Archetype:** Maintainer · **Scope seed:** [`00-ideas/seeds/ci-build-pipeline.md`](../../00-ideas/seeds/ci-build-pipeline.md)

## Why

`deploy/update.sh` pulls `main` and rebuilds the images **on the single production VM**. Three
consequences, all of which get worse as the project gets busier:

1. **A compile error takes the reader down**, because the failure happens on the host serving users.
2. **The build competes with Postgres** for 2 OCPU, against a database deliberately holding 3 GB of
   `shared_buffers` to dodge Oracle's idle-reclaim heuristic.
3. **There is no previous artifact to roll back to.** Rollback is `git revert` on `main` plus another
   slow rebuild on the same box.

It is also what makes every upstream rebase scarier than it needs to be: the first build of 131
upstream commits gets validated *in production*.

## ⚠️ Check this before betting — it may be nearly free, or it may be expensive

**GitHub Actions minutes are metered only for private repos**, from one pool shared across the whole
account. An arm64 build on a hosted x86 runner goes through QEMU and is slow, which on a private repo
is real money.

```bash
gh repo view danybgoode/justread --json isPrivate
```

- **Public** → unlimited free minutes, and this epic is much cheaper than it looks. Bet it early.
- **Private** → measure the build time in S1 before committing to a schedule, and consider an arm64
  runner. If the number is bad, **narrowing to build-on-tag rather than build-on-merge is a valid
  reshape**, not a failure.

## Platform-first note

No application code changes at all. This is a deploy-rail change: where the image is built and how it
reaches the VM. `panfleto-core/packaging/docker/alpine/Dockerfile` is already correct and is reused
as-is (`AGENTS.md` rule 1 — nothing added to the fork).

## What already exists (reuse, don't rebuild)

- `panfleto-core/packaging/docker/alpine/Dockerfile` — the build, unchanged
- `deploy/docker-compose.yml` — one `build:` block becomes an `image:` block
- `deploy/update.sh` — the entry point, kept; its body changes
- `.github/workflows/guards.yml` — the consolidated-job pattern to copy for minute efficiency

## Architecture decisions — to be LOCKED before any builder starts

| # | Decision | State |
|---|---|---|
| **D1** | Registry: GHCR | **To lock** — GHCR is the obvious default (same auth as the repo, free for public), but confirm the VM can pull from it with the credentials it has |
| **D2** | Tagging: commit SHA **and** a moving `main` tag | **To lock** — the SHA tag is what makes rollback possible; the moving tag is what makes `update.sh` simple. Both, not one |
| **D3** | Build trigger: on merge to `main`, or on tag | **To lock** — depends on the private/public answer above |
| **D4** | Native arm64 runner vs QEMU | **To lock** — measure in S1 |
| **D5** | Which repo owns the image build | **Decided 2026-09-15** — the resync shipped, `panfleto-core` **is** a submodule (`.gitmodules`, branch `panfleto`). The image build therefore belongs on **`danybgoode/panfleto-core`**, alongside its existing `panfleto upstream sync` workflow, not in this repo. This repo only moves the pin |
| **D6** | Living with the fork repo's inherited workflows | **To lock** — the fork inherits upstream's `dependabot` (weekly bump PRs that should be closed; bumps arrive through the rebase) and upstream's `stale.yml` (no owner guard). Adding a build workflow means sharing Actions with those. The resync retro flagged both as unresolved |
| **D7** | Version reporting | **To lock** — the resync found `/about` **cannot** report a version from a git-less Docker build (its D9). If the deploy check wants a version string, this epic is where the build can inject one via ldflags |

## Rollback

This epic's own rollback: keep the `build:` block in `docker-compose.yml` commented out for one
release cycle. If the registry path fails, uncomment and `update.sh` builds locally again. Remove the
comment once a pull-based deploy has succeeded twice.

## Scope — stories

| Sprint | Story | Risk |
|---|---|---|
| 1 | 1.1 — An image built in CI and pushed | low |
| 1 | 1.2 — The build time measured and judged | low |
| 2 | 2.1 — The VM pulls instead of building | high |
| 2 | 2.2 — Rollback by tag, proven | high |

## Definition of Done (epic)
- [ ] Both sprints merged to `main` + deployed + smoke-tested (gaps stated)
- [ ] Each `sprint-N.md` has its smoke walkthrough (real URLs)
- [ ] This README marked ✅; every sprint status ticked with commit refs
- [ ] `RETROSPECTIVE.md` written
- [ ] Product poster updated — 09's "No CI build" ❌ line is **removed**
- [ ] `AGENTS.md`'s deploy note and rule 5 updated to describe a pull, not a build
- [ ] `Roadmap/WAYS-OF-WORKING.md` § *Deploy rail* updated — the "compiles on the production host"
      consequence no longer applies, and that paragraph currently says it does
- [ ] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [ ] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
