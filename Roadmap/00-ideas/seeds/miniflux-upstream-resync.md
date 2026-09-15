---
title: "Put panfleto-core back on upstream's timeline"
slug: miniflux-upstream-resync
status: scaffolded
area: "09"
type: chore
priority: wave-2026-09-panfleto
appetite: L
underwritten_by: null
risk: high
epic: "09-platform-infra/miniflux-upstream-resync"
build_order: 4
updated: 2026-09-15
---

# Pitch — Put panfleto-core back on upstream's timeline

> **Archetype: Maintainer.** Security, reliability and maintenance on a mature system we don't own.

## Problem

`panfleto-core/` is not a fork. It is a directory of Miniflux files pasted into this repo. There is
no `upstream` remote, no shared history with `miniflux/v2`, and therefore **no merge base** — which
means there is no such thing as "pull the latest changes." Every sync is a manual diff, so no sync
has happened.

The 2026-09 audit reconstructed the position by blob-matching the tree against upstream history:

| | |
|---|---|
| **Fork point** | `06e36c3e` — 17 May 2026, upstream's own revert of the cross-origin middleware |
| **Behind by** | **131 commits**, **3 releases** (`v2.3.1` 28 May · `v2.3.2` 3 Jun · `v2.3.3` 22 Jul) |
| **The delta** | **12 files** plus ~20 branding PNGs |
| **Custom migrations** | **zero** |

What's in those 131 commits includes a username-enumeration timing fix (`83ea3d19`), an OAuth
identity-field escalation fix on the API, and — at current HEAD — enforcement of
`DISABLE_LOCAL_AUTH` on the API and password-change paths. panfleto runs Auth0 SSO, so that last one
is not academic. No commit subject in the range is flagged breaking.

The problem is not the size of the delta. The delta is tiny. **The problem is that git doesn't know
the delta exists**, and until it does, the gap grows by about a commit a day, forever.

## Appetite

**L** — a multi-wave epic, **re-bet at each wave boundary**. Three sprints, and the boundaries are
real: S1 is reversible plumbing, S2 is the first production deploy of 131 upstream commits, S3 is
optional hardening that pays for itself but could be deferred if the appetite is spent.

If S2 exhausts the appetite — if the rebase fights back, or the deploy surfaces something the audit
missed — **stop and re-shape**. Do not extend in flight. S3's value doesn't decay.

## Outcome & signal

`panfleto-core` is a real fork with a real upstream remote, running current Miniflux, and staying
current without anyone remembering to do it.

**How the product owner tests it:**
1. `git -C panfleto-core log --oneline upstream/main..panfleto` lists **only panfleto's own
   commits** — five topic commits, nothing else. That single command is the whole proof.
2. `app.panfleto.win/about` shows a current Miniflux version.
3. A weekly PR appears on `panfleto-core` when upstream moves, or an issue appears when it conflicts.
4. Everything still works: log in with Auth0, read an article, star it, press Download, add a feed,
   open Settings and see the MCP URL.

## Stage-2.5 bucket

**genuinely-new** — but far less than it looks. Bucket 2 ("light enhancement") was seriously
considered: keep vendoring, maintain a patch series by hand. It was rejected because it leaves the
recurring cost exactly where it is today, which is what produced a four-month gap nobody noticed.
The whole point is to make the *recurring* act cheap, not to close the gap once.

## Bill of materials (What / Why)

| What | Why |
|---|---|
| A real repo `danybgoode/panfleto-core`, cloned from `miniflux/v2` | Shared history is the thing that's missing; nothing else fixes it |
| `upstream` remote + a `panfleto` branch rooted at `06e36c3e` | Gives every future sync a merge base and a one-command rebase |
| The 12-file delta replayed as **five topic commits**, not one | A conflict three months from now tells you *which feature* it belongs to |
| Submodule wiring in this repo | Keeps `docker-compose.yml`'s build context unchanged; the reader gets its own release cadence |
| Rebase in **two hops** — `v2.3.3`, then `upstream/main` | If something breaks you know whether it came from a release or from unreleased main |
| A weekly rebase-and-PR Action | The recurring act, automated. Without it this is a one-time cleanup that decays |
| `feeds.json` + `go:embed` | Removes **three** of the twelve delta files (see the chain below) and ends three-sources-of-truth |
| Verified restore before the first deploy | One environment, no staging. An untested backup is not a rollback |

## Scope

**In v1 (three sprints):**

**S1 · Re-root.** New repo from upstream, `upstream` remote, `panfleto` branch at `06e36c3e`, the
delta replayed as five topic commits, submodule wiring, `update.sh` gains
`git submodule update --init --recursive`. Proof of done: the image still builds and the reader still
runs, on the *old* Miniflux — no upstream code has moved yet. This sprint is fully reversible.

**S2 · Rebase forward.** `git rebase v2.3.3` → build → deploy → verify → live for a few days →
`git rebase upstream/main` → build → deploy → verify. Migrations apply on first boot
(`RUN_MIGRATIONS=1`). This is the sprint that ships 131 commits.

**S3 · Shrink the delta, then automate.** `feeds.json` consolidation, re-evaluate the nonce patch,
weekly sync Action.

**Out of v1 (no-gos):**
- **Building a CI/CD pipeline.** Tempting here, genuinely valuable, and a separate bet —
  `ci-build-pipeline.md`. Folding it in would double the appetite.
- **Any new reader feature.** `article-autofetch` and `inline-comments` both wait for this. Adding
  either mid-rebase means replaying a moving delta.
- **Upstreaming anything to `miniflux/v2`.** Worth doing eventually for the parts that aren't
  panfleto-specific; not this bet.
- **Renaming the repo.** `fluxonline` (folder) / `justread` (remote) / `panfleto` (product) are three
  names for one thing. Confusing, not urgent, and a rename during a submodule migration is asking
  for it.
- **Changing what any of the 12 delta files do.** They get moved onto real history, not redesigned.

## Rabbit holes

- **The `cspNonce` patch is not what it looks like — and it's free to remove.** Verified: the *only*
  reason `view.go` injects `cspNonce` and `layout.html` reads it instead of calling upstream's
  `nonce` function is the inline `<script>` at `add_subscription.html:351`, which needs the same
  nonce the CSP header used. That inline script exists only to drive the hand-written suggested-feeds
  table. **So S3's `feeds.json` story removes three delta files at once** — `add_subscription.html`,
  `view.go`, and the nonce half of `layout.html` — taking the delta from 12 to 9. Do not "fix" the
  nonce patch in S1 or S2; it disappears on its own if S3 is done in the right order.
- **Two things that look like fork patches are upstream's.** The disabled cross-origin middleware in
  `internal/ui/ui.go` is upstream's own revert (`06e36c3e` — the fork point itself), and the
  index-dropping migration at the end of `migrations.go` came from `bdd7f4f3`. Replaying either as a
  panfleto commit would create a conflict against upstream's identical code.
- **Zero custom migrations is the reason this is safe — protect it.** `schemaVersion =
  len(migrations)`; upstream appends to the same slice. Because panfleto has never appended, the two
  new upstream migrations land at the indices they expect and `RUN_MIGRATIONS=1` just works. **Do not
  add one during this epic** under any circumstance (`AGENTS.md` rule 3).
- **The conflict surface is known and tiny.** Each of the three forked templates has had exactly one
  upstream commit touch it since the fork point: `add_subscription.html` ← `b3039d6c`,
  `entry.html` ← `6dcb815c`, `layout.html` ← `aa509b88`. If the rebase produces conflicts anywhere
  else, something is wrong with the replay — stop and check rather than resolving.
- **`git rebase` on a branch whose base is a fresh clone will want to re-apply everything.** Root the
  branch *at* `06e36c3e` and commit the delta on top; don't cherry-pick into a branch cut from main.
- **Submodules break the naive clone.** Anyone (or any agent) doing a fresh `git clone` of this repo
  gets an empty `panfleto-core/` and a build that fails confusingly. `update.sh` gets the
  `--init --recursive`; so does every kickoff prompt and the session-resume note in
  `SESSION-KICKOFFS.md`.
- **The deploy compiles on the production VM.** Two cores, shared with a Postgres holding 3 GB of
  `shared_buffers`. The first post-rebase build is the slowest one this project has ever done, and a
  failure takes the reader down. Deploy it when someone is watching, not at midnight.

## What already exists (reuse, don't rebuild)

- `miniflux/v2` itself — 131 commits of work that is already reviewed, released and tested
- `deploy/docker-compose.yml`'s `build.context: ../panfleto-core` — unchanged by the submodule move
- `panfleto-core/packaging/docker/alpine/Dockerfile` — the build, already correct
- `deploy/update.sh`, `deploy/backup.sh`, the `panfleto-backups` bucket and the nightly timer
- `internal/ui/user_onboarding.go`'s feed list, `add_subscription.html`'s table, and
  `scripts/enhance_miniflux.js`'s keyword map — the three lists `feeds.json` consolidates
- Upstream's `nonce` template function at `internal/template/functions.go:99` — still there, still
  works, waiting to be used again

## UX heuristics & rails check

- **CI guards covering this surface:** `guards.yml` covers `Roadmap/**` and `scripts/**` only —
  **nothing guards `panfleto-core/`**, deliberately (there is no per-branch preview to build
  against, and an arm64 Go build on a hosted runner costs Actions minutes on a private repo). The
  gate for this epic is therefore **local**: `go build ./... && go vet ./... && go test ./...` plus a
  `docker compose up` smoke. Say that in every PR body rather than letting a green CI badge imply
  more than it checked.
- **Audits-lens findings that apply:** none — `00-ideas/audits/` is empty
- **Design-language debt:** none introduced; S3 *removes* some by deleting the inline-styled
  suggested-feeds table

## Kill-switch / runtime gate (risk:high — Stage 6b)

**Carve-out, with a real reversibility mechanism that isn't a flag.**

There is no runtime seam here — a rebase is not something an `isEnabled()` check can gate, and
panfleto has no flag provider at all. But this epic has something better than a flag, and it is the
main argument *for* the submodule:

> **The superproject pins `panfleto-core` at a SHA.** Rolling back 131 upstream commits is moving
> that pin back one commit and re-running `update.sh`. No revert of a merge, no untangling, no
> rebuild of a branch — one pointer.

That mechanism is only true if two conditions hold, and both are S2 acceptance criteria:
1. The **database restore is verified before the first rebased deploy** — schema changes are the one
   thing the pin cannot roll back. Restore last night's `pg_dump` into a throwaway Postgres and
   confirm it actually restores, *before* S2 deploys anything.
2. The pre-rebase SHA is **written into the epic README**, not just left in reflog.

## Acceptance criteria

**S1 · Re-root**
1. `git -C panfleto-core remote -v` shows `upstream` → `miniflux/v2` and `origin` → `danybgoode/panfleto-core`.
2. `git -C panfleto-core log --oneline upstream/main..panfleto` lists exactly the five panfleto topic commits.
3. `git -C panfleto-core diff 06e36c3e..panfleto --stat` touches 12 files plus icons — no more.
4. `docker compose -f deploy/docker-compose.yml build miniflux` succeeds from a fresh clone that ran `--init --recursive`.
5. The reader still runs and looks identical. Nothing user-visible changed in this sprint.

**S2 · Rebase forward**
6. A `pg_dump` from the backup bucket has been restored into a throwaway Postgres and verified — **before** anything deploys.
7. The pre-rebase submodule SHA is recorded in the epic README.
8. `go build ./... && go vet ./... && go test ./...` clean at `v2.3.3`, and again at `upstream/main`.
9. First boot applies both new upstream migrations; `app.panfleto.win` comes back up.
10. Product-owner smoke on production: Auth0 login → open an article → star it → press Download and see content replaced → add a feed → Settings shows the MCP URL → the paywall rail renders.
11. `/about` reports a version newer than 2.3.0.

**S3 · Shrink and automate**
12. One `feeds.json` is the only place a starter/suggested feed is listed.
13. `add_subscription.html`, `internal/ui/view/view.go` and `layout.html`'s nonce line are **gone from the delta** — `git diff upstream/main..panfleto --stat` shows 9 files plus icons.
14. A weekly Action rebases onto `upstream/main`, opens a PR when clean and an issue when not; the first run has been observed doing one or the other.

## Open risks / research

- **Unverified: nothing.** Every number in this pitch was read from the tree or from upstream
  history — the fork point by blob-matching `go.mod` and then minimising tree diff across candidates
  at 126–136 commits behind main; the delta from a worktree at `06e36c3e`; the nonce chain from
  `add_subscription.html:351`; the per-file conflict surface from `git log 06e36c3e..main -- <file>`.
- **The one thing that can't be checked in advance** is how the two new upstream migrations behave
  against *this* database rather than an empty one. Hence acceptance criterion 6, and hence
  deploying S2 while someone is watching.
- **Track `main`, not a tag** — the product owner's call, recorded here so the weekly Action isn't
  quietly retargeted later. It keeps the delta from ever growing again, at the cost of running
  upstream's unreleased commits in production. Acceptable because the delta is small enough that
  reverting the pin is genuinely one command.

## Cross-agent planning panel

This pitch contains a data-ownership fork (submodule vs. subtree vs. continued vendoring) and an
expensive-to-reverse choice (tracking `main`). Per groom Stage 4 the panel is **offered**:

```
node scripts/cross-panel.mjs Roadmap/00-ideas/seeds/miniflux-upstream-resync.md --lens both --agent codex
node scripts/cross-panel.mjs Roadmap/00-ideas/seeds/miniflux-upstream-resync.md --lens both --agent antigravity
```

Advisory, single-pass, print-only. The product owner's approval of this doc remains the only gate.
