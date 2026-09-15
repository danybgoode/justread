---
status: in-progress   # AUTHORITATIVE epic status (SSOT) — scaffolded | in-progress | shipped | archived. Set shipped at epic close.
slug: miniflux-upstream-resync
build_order: 4
---

# Epic: Put panfleto-core back on upstream's timeline

> **Area:** 09-platform-infra · **Risk:** high · **Class:** Chore · **Archetype:** Maintainer · **Scope seed:** [`00-ideas/seeds/miniflux-upstream-resync.md`](../../00-ideas/seeds/miniflux-upstream-resync.md)

## Why

panfleto's reader is a copy of Miniflux pasted into this repo, not a fork of it. Without an upstream
remote there is no merge base, so "pull the latest changes" isn't a thing that can be done — and
four months of upstream work has accumulated unnoticed, including fixes to the authentication paths
panfleto actually uses. This epic gives the reader a real relationship with the project it is built
on: current code today, and a sync that happens by itself from now on.

Nothing user-visible changes. The reader looks and behaves the same at the end of this epic as at
the start — that is the success condition, not a limitation.

## Platform-first note

Upstream Miniflux **is** the system of record for the reader. Every line in `panfleto-core/` that
isn't one of the 12 delta files is upstream's, and the epic's job is to make that relationship
explicit in git rather than implicit in a directory. No new primitive is introduced. No table, no
route, no migration — see `AGENTS.md` rule 3, which this epic exists partly to protect.

## What already exists (reuse, don't rebuild)

- **`miniflux/v2`** — 131 commits of reviewed, released, tested work
- **`deploy/docker-compose.yml`** `build.context: ../panfleto-core` — unchanged by the submodule move
- **`panfleto-core/packaging/docker/alpine/Dockerfile`** — the build, already correct
- **`deploy/update.sh`**, **`deploy/backup.sh`**, the `panfleto-backups` bucket, the nightly 04:30 UTC timer
- **Upstream's `nonce` template function** (`internal/template/functions.go:99`) — still there, waiting to be used again in S3
- **Three existing starter-feed lists** — `internal/ui/user_onboarding.go`, `add_subscription.html`, `scripts/enhance_miniflux.js` — consolidated, not rewritten, in S3

## Architecture decisions — to be LOCKED by the orchestrator before any builder starts

The orchestrating agent locks these against the live code and the live data, and writes the answers
back into this section as `D1…Dn` before Sprint 1 begins. **Builders cite these; they never
re-derive them.** Four are already decided by the product owner and are recorded here so they are
not reopened:

| # | Decision | State |
|---|---|---|
| **D1** | `panfleto-core` becomes its own repo, wired here as a **git submodule** (not subtree, not continued vendoring) | **Decided** by the product owner, 2026-09-14 |
| **D2** | The fork branch tracks **`upstream/main`**, not a release tag | **Decided** by the product owner, 2026-09-14 |
| **D3** | The delta is replayed as **five topic commits**, one per concern, not one squashed commit | **Decided** — a conflict months from now must name the feature it belongs to |
| **D4** | The suggested-feeds table is **rebuilt from `feeds.json`**, not preserved as markup | **Decided** by the product owner, 2026-09-14 |
| **D5** | Cleanup/verification order for the `cspNonce` chain | **Locked 2026-09-14.** `grep -rn cspNonce internal` at the S1 tip: `view.go:50` (producer), `layout.html:28–37` (the header + its own tags), and `add_subscription.html:351` — the **only** consumer outside `layout.html`. S3 order stands: 3.1 deletes that script, then 3.2 is a pure deletion. Re-check after the S2 rebase (S3 build contract) |
| **D6** | Whether the new upstream migrations are safe against *this* database | **Locked 2026-09-14, and the scope was wrong.** Upstream adds **four** migrations, not two: v2.3.3 brings 131 (enclosures unique index md5→sha256 hex) and 132 (`language text not null default ''` on `feeds` and `entries`); `upstream/main` adds 133 (drop redundant `entries_user_status_changed_idx`) and 134 (enclosures index → raw `sha256` bytea). Live DB, read with `psql` on the VM: `schema_version` **130**, `entries` **31,248**, `feeds` **52**, `users` **3**, database **177 MB**. At this size a constant-default `ADD COLUMN` is a metadata-only change in Postgres 17 and every index rebuild is sub-second — **all four are safe to run on boot**. (Enclosure count recorded in S2.1 from the restored copy.) |
| **D7** | Submodule pin recorded where, and by whom | **Locked.** The orchestrator records it in *Rollback* below at the start of S2. It is the S1 tip `bdf23f75` — the same Miniflux code production ran before the epic |
| **D8** | `danybgoode/panfleto-core` visibility | **Decided by the product owner, 2026-09-14: public** (the scaffold said `--private`). The same code was already public inside `justread`; public means the VM clones the submodule over HTTPS with **no new credential on the host**, and the S3 weekly Action runs on free minutes. `.gitmodules` points at the HTTPS URL for the same reason |
| **D9** | How a deploy proves *which* Miniflux is live | **Locked — S2.2's "`/about` reports 2.3.3" is fiction.** The Makefile derives the version from `git describe`, and the Docker build context has no `.git` (a submodule's `.git` is a pointer file outside the context), so upstream's fallback applies: `2.2.x-dev` today, **`2.3.x-dev` at both v2.3.3 and `upstream/main`**. Fixing that means patching the Dockerfile — delta growth for a cosmetic string, rejected under rule 1. **Proof of a hop is instead:** `/about` moves `2.2.x-dev` → `2.3.x-dev`, `schema_version` reads **132** after hop 1 and **134** after hop 2, and `git -C /opt/panfleto submodule status` shows the expected pin |
| **D10** | Baseline CSP violations (so S3 is measured, not asserted) | **Recorded 2026-09-14 on a local stack at the S1 tip** (Chromium console, logged in): `/unread` 0 · `/feeds` 0 · `/about` 0 · **`/subscribe` 20** (the inline `style=` attributes in the suggested-feeds table) · **`/integrations` 4** (the MCP panel's inline styles and `onclick`). These already exist in production — not a regression. S3.1 should take `/subscribe` to 0; `/integrations` is outside this epic's scope and is logged as a follow-up |
| **D11** | The "live on v2.3.3 for a few days" soak | **Re-shaped by the product owner's instruction, 2026-09-14** — this is a named epic-mode run, with merges and production deploys pre-authorized, to be driven to *deployed*. The two hops stay (they are what attributes a breakage to a release or to unreleased main), but the soak is **bounded by evidence, not by the calendar**: hop 2 starts only after hop 1 has (a) applied 131–132 cleanly, (b) passed the full anonymous smoke + `reader-health` spec against production, and (c) completed at least one full scheduler refresh cycle with no new error class in the miniflux log versus the pre-deploy baseline. Anything unexplained in that window stops the run |
| **D12** | Merge + deploy authority for this epic | **Pre-authorized by the product owner, 2026-09-14** for all three PRs, including the HIGH ones, and including running `update.sh`. The review layers are unchanged: two cross-family passes plus the fresh reviewer subagent on every PR. That authorization supersedes the *Review & merge* line below that says the product owner merges |

**Disprove scope during the lock.** The acceptance criteria below were written from an audit of the
tree, not from the running system. If any of them describes a guard, a file or a state the live
system doesn't have, correct the doc with the reasoning and say so out loud.

## Scope — stories

| Sprint | Story | Risk |
|---|---|---|
| 1 | 1.1 — A real fork with real history | high |
| 1 | 1.2 — The delta replayed as five topic commits | high |
| 1 | 1.3 — Wired back in as a submodule | high |
| 2 | 2.1 — A restore that has actually been restored | high |
| 2 | 2.2 — Rebase to v2.3.3, deploy, verify | high |
| 2 | 2.3 — Rebase to upstream/main, deploy, verify | high |
| 3 | 3.1 — One feeds.json, three lists gone | low |
| 3 | 3.2 — The nonce patch returned to upstream | low |
| 3 | 3.3 — The weekly sync that makes this stick | low |

## Deploy order

**Backend-only epic; no frontend to degrade.** But the deploy rail is manual and compiles on the
production host, so ordering matters inside S2:

1. S1 deploys nothing new — it must prove the image still builds from a submodule checkout, on the
   *old* Miniflux. Fully reversible.
2. S2 deploys twice, deliberately: `v2.3.3` first, live for a few days, then `upstream/main`. Two
   hops so that if something breaks you know whether it came from a release or from unreleased main.
3. **Deploy while someone is watching.** The first post-rebase build is the slowest this project has
   ever done — two cores shared with a Postgres holding 3 GB of `shared_buffers` — and a build
   failure takes the reader down, because the build happens on the host serving users.
4. S3 deploys once, and is low-risk: it removes code rather than adding it.

## Rollback

The submodule pin **is** the kill-switch (see the scope seed's Stage 6b carve-out). Rolling back 131
upstream commits is moving the pin back one commit and re-running `update.sh` — one pointer, not a
merge revert.

**Pre-rebase submodule SHA:** `bdf23f75b4179f5b74aa26f28f4c72d37260baf6` — `danybgoode/panfleto-core@panfleto`
at the end of S1, which is `06e36c3e` plus the five topic commits: byte-identical to the vendored
reader production ran before this epic. To roll back:
`git -C panfleto-core checkout bdf23f75 && git add panfleto-core && git commit`, merge, `update.sh`.
The S2 rebases rewrite the `panfleto` branch, so this SHA is kept reachable by the tag
**`pre-resync`** on `panfleto-core` — a pin to an unreachable commit would not survive a fresh clone.

That mechanism only holds if the database can come back too, which is why S2.1 exists and blocks
everything after it.

## Model routing (state it so the choice is auditable)

- **S1 and S2 → the stronger model.** S1 defines the contract every later sprint imports (what the
  delta *is*, how it's structured, where the pin lives). S2 is the production deploy of 131 commits
  against a database with no staging.
- **S3 → the faster model.** Mechanical work over a locked contract: move three lists into one
  file, delete a template block, add a workflow.
- **Review is inverted** — the fresh reviewer subagent on the highest-risk PR (S2) runs on the
  strongest model.

## Review & merge

Per `Roadmap/WAYS-OF-WORKING.md`. Specific to this epic:

- **Stack the branches:** `feat/miniflux-upstream-resync` → `-s2` → `-s3`, each cut from the
  previous, one PR per sprint, merged in order. These sprints share hot files by construction.
- **Route the reviewers, never hand-pick:** `node scripts/review-route.mjs --builder claude --tier high <PR#>`.
  Claude building routes to **codex + agy**.
- **Tell the reviewers it's Go inside a fork.** `AGENTS.md` rule 1 is a standing constraint; without
  it you get idiomatic-refactor findings that would grow the delta.
- **Every PR here is HIGH tier** — migrations, auth paths and shared infra. The fresh reviewer
  subagent is mandatory on all three, and the **product owner merges** unless this epic is named in a
  pre-authorized epic-mode run.
- **The gate is local.** Nothing in CI builds `panfleto-core/` (deliberately — see `guards.yml`). Say
  that in every PR body rather than letting a green badge imply more than it checked.

## Definition of Done (epic)
- [ ] All sprints merged to `main` + smoke-tested (gaps stated)
- [ ] Each `sprint-N.md` has its smoke walkthrough (real URLs)
- [ ] This README marked ✅; every sprint status ticked with commit refs
- [ ] `RETROSPECTIVE.md` written
- [ ] Product poster (`Roadmap/README.md`) updated — the 09 section's "Miniflux fork sync" line goes 🚧 → ✅, and the 131-commits-behind claim is removed
- [ ] Durable learnings promoted to `Roadmap/LEARNINGS.md` (dedupe — sharpen, don't append)
- [ ] **Kill-switch:** carve-out, not a flag. Verify instead that the pre-rebase SHA is recorded above and that the S2.1 restore was actually performed
- [ ] `AGENTS.md` rule 1's delta count updated from 12 to whatever S3 actually left
- [ ] Feature branch deleted; **this README's frontmatter `status: shipped`** (run `node scripts/build-order.mjs`)
