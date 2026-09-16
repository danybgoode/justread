---
status: shipped
slug: ci-build-pipeline
build_order: 8
---

# Epic: Stop compiling Go on the production VM ✅

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

## Architecture decisions — LOCKED 2026-09-15 (against the live repos, before the builder started)

**The cost question is answered: both repos are PUBLIC** (`gh repo view danybgoode/justread --json isPrivate`
→ `false`; same for `danybgoode/panfleto-core`). GitHub Actions minutes are metered only for private
repos, so this epic is the cheap version of itself: unlimited free minutes, build-on-merge is
affordable, and no narrowing to build-on-tag is needed.

| # | Decision | Locked answer |
|---|---|---|
| **D1** | Registry | **GHCR — `ghcr.io/danybgoode/panfleto-core`.** Same auth as the repo; `GITHUB_TOKEN` with `packages: write` pushes it. Because the repo is public the **package is made public**, so the VM pulls anonymously and **no registry credential lands on the host at all** (`AGENTS.md` rule 4 stays trivially satisfied). Package visibility is not automatic — it is set once, by hand, after the first push |
| **D2** | Tagging | **Both, as the story says.** `:<full-commit-sha>` is the immutable rollback handle; `:panfleto` is the moving tag that tracks the fork's default branch (the fork's `main` is called `panfleto`). `update.sh` resolves the **SHA**, not the moving tag — see D8 |
| **D3** | Build trigger | **On push to `panfleto`** (the fork's default branch) plus `workflow_dispatch`. Public repo ⇒ free. Path-filtered so a docs-only commit doesn't build |
| **D4** | Runner | **Native arm64 — `ubuntu-24.04-arm`**, free for public repos, no QEMU. Measured in story 1.2 |
| **D5** | Which repo owns the build | **`danybgoode/panfleto-core`** (decided 2026-09-15, unchanged). This repo only moves the pin |
| **D6** | Inherited workflows | **Leave upstream's `dependabot.yml` and `stale.yml` untouched — do not delete them.** Both are upstream-owned files; deleting one is a permanent modify/delete rebase conflict, i.e. exactly the tax `AGENTS.md` rule 1 exists to avoid. Confirmed live: Dependabot **has** already opened PR danybgoode/panfleto-core#14 (`bump the gomod group with 7 updates`, 2026-09-15). The standing answer is **close such PRs unreviewed** — the bumps arrive through the weekly rebase — and, if it gets noisy, disable Dependabot in the fork's repo settings, which is a GitHub-side toggle with **zero repo delta**. `docker.yml` and `codeberg_mirror.yml` are already inert on the fork (`if: github.repository_owner == 'miniflux'` / skipped), so the new workflow shares Actions only with `stale.yml`, `tests.yml` and `linters.yml` |
| **D7** | Version reporting | **Inject it without touching the Dockerfile.** `Makefile` line 3 is `VERSION := $(shell git describe --tags --exact-match)`, the build context has no `.dockerignore` so `.git` is copied in, and the alpine build stage already installs `git`. So the *workflow* creates a lightweight local tag on the checked-out commit before `docker build`, and the existing Makefile turns it into `-X internal/version.Version=…` with **no change to `packaging/docker/alpine/Dockerfile` and no new fork delta** — which is what the resync's D9 ("`/about` can't report a version from a git-less Docker build") was actually missing. `/about` shows `panfleto-<short-sha>` |
| **D8** | *(new)* How the VM knows **which** image to run | **The submodule pin is the version.** `update.sh` resolves `ghcr.io/danybgoode/panfleto-core:$(git -C panfleto-core rev-parse HEAD)` after `git submodule update`, so the image can never drift from the pin `main` says to run — and `git revert` of a pin bump is automatically a rollback to the matching image. A `MINIFLUX_IMAGE` line in `deploy/.env` overrides it for a deliberate out-of-band rollback (story 2.2). The moving `:panfleto` tag exists for humans and for `docker pull` by hand; the deploy never uses it |
| **D9** | *(new)* Where the new workflow lives in the fork's history | **Amended into the existing topic commit `panfleto: weekly upstream sync workflow`**, not stacked on top — `AGENTS.md` rule 1. The fork's delta stays at **eight topic commits**; the file count goes 27 → 28 (`.github/workflows/panfleto-image.yml`), which is the honest cost of this epic and is paid in a directory upstream rarely touches for this fork |

### Deviations from the scaffolded scope, decided here

- **The `landing` service keeps building on the VM.** This epic's Why is entirely about *Go* compiling
  next to Postgres; the Next.js image is a fraction of the cost and lives in this repo, not the fork,
  so moving it is a different build with a different trigger. Out of scope, named here rather than
  discovered later.
- **Story 1.2's private-repo arithmetic does not apply** (public repo). It is answered with the
  measured wall-clock numbers and the D4 verdict, and the minutes-per-month sum is recorded as N/A.

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

## Definition of Done (epic) — ✅ complete 2026-09-16
- [x] Both sprints merged to `main` (PR #13, `84911dc`) + deployed + smoke-tested (one gap stated: the
      sign-in check is owed to the product owner)
- [x] Each `sprint-N.md` has its smoke walkthrough, with the executed steps recorded against real URLs
- [x] This README marked ✅; both sprint statuses ticked with refs
- [x] `RETROSPECTIVE.md` written
- [x] Product poster updated — 09's "No CI build" ❌ line is replaced by what is now true
- [x] `AGENTS.md`'s deploy note, rule 1's delta count (27 → 28) and rule 5 updated to describe a pull
- [x] `Roadmap/WAYS-OF-WORKING.md` § *Deploy rail* updated
- [x] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [x] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
