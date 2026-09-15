# Put panfleto-core back on upstream's timeline — Sprint 1: Re-root panfleto-core on upstream

**Status:** ⬜ not started

> **Build contract (locked by the architect before the builder started)**
>
> - **D1 · submodule**, not subtree, not continued vendoring. `deploy/docker-compose.yml`'s
>   `build.context: ../panfleto-core` does **not** change.
> - **D3 · five topic commits**, one per concern. Never squash the delta.
> - **Root the branch AT `06e36c3e`** and commit the delta on top. Do *not* cut a branch from `main`
>   and cherry-pick into it — that is the mistake that makes the whole rebase fight back.
> - **Nothing upstream moves in this sprint.** At the end of S1 the reader is still running the same
>   Miniflux code it runs today; only its relationship to git has changed. If the reader looks
>   different, something is wrong.
> - **The delta is 12 files plus ~20 branding PNGs.** That number is the acceptance check. Two things
>   that *look* like fork patches are upstream's and must NOT be replayed: the disabled cross-origin
>   middleware in `internal/ui/ui.go` (upstream's own revert, and the fork point itself) and the
>   index-dropping migration at the end of `internal/database/migrations.go` (upstream's `bdd7f4f3`).

## Stories

### Story 1.1 — A real fork with real history
**As a** maintainer, **I want** `panfleto-core` to be a git fork of `miniflux/v2` with an `upstream`
remote, **so that** syncing becomes a rebase instead of an archaeology project.

```
gh repo create danybgoode/panfleto-core --private
git clone https://github.com/miniflux/v2 panfleto-core
cd panfleto-core
git remote rename origin upstream
git remote add origin git@github.com:danybgoode/panfleto-core.git
git checkout -b panfleto 06e36c3e
```

**Acceptance:**
- `git -C panfleto-core remote -v` shows `upstream` → `miniflux/v2` and `origin` → `danybgoode/panfleto-core`
- `git -C panfleto-core merge-base panfleto upstream/main` returns a real commit (today there is none)
- The `panfleto` branch's tip is `06e36c3e` with no commits on top yet

**Risk:** high

### Story 1.2 — The delta replayed as five topic commits
**As a** maintainer, **I want** panfleto's 12 changed files committed one concern at a time on top of
the real fork point, **so that** a conflict six months from now names the feature it belongs to
instead of landing in an unreadable blob.

The five commits, and what belongs in each:

| Commit | Files |
|---|---|
| `panfleto: branding and PWA identity` | `layout.html`, `about.html`, `offline.html`, `static_manifest.go`, the ~20 PNGs under `internal/ui/static/bin/` |
| `panfleto: starter-feed onboarding` | `internal/ui/user_onboarding.go` (new), `oauth2_callback.go`, `internal/storage/user.go` |
| `panfleto: MCP connector panel` | `internal/ui/integration_show.go`, `views/integrations.html` |
| `panfleto: reader link rail` | `views/entry.html` |
| `panfleto: CSP nonce in view context` | `internal/ui/view/view.go`, the nonce lines in `layout.html`, `views/add_subscription.html` |

The last one is deliberately last and deliberately separate: S3 deletes it entirely.

**Acceptance:**
- `git -C panfleto-core log --oneline 06e36c3e..panfleto` lists exactly five commits with those subjects
- `git -C panfleto-core diff 06e36c3e..panfleto --stat` touches 12 files plus icons — **no more**
- `internal/ui/ui.go` and `internal/database/migrations.go` appear in **none** of the five commits
- A diff of the working tree against today's vendored `panfleto-core/` is empty

**Risk:** high

### Story 1.3 — Wired back in as a submodule
**As a** maintainer, **I want** this repo to reference `panfleto-core` as a submodule pinned at a SHA,
**so that** rolling the reader back is moving one pointer rather than reverting a merge.

**Acceptance:**
- `git submodule status` shows `panfleto-core` pinned at the S1 tip
- `deploy/update.sh` runs `git submodule update --init --recursive` before rebuilding
- A **fresh clone** (`git clone … && git submodule update --init --recursive`) produces a tree from
  which `docker compose -f deploy/docker-compose.yml build miniflux` succeeds
- `docker compose up` brings the reader up and it is **visually identical** to production today
- `.gitmodules` is committed and points at `origin`, not a local path

**Risk:** high

## Sprint QA
- **api spec(s):** none new — this sprint changes no behaviour, so a spec asserting behaviour would
  assert nothing. The gate here is the **build from a fresh submodule clone**, which is the thing
  that actually breaks.
- **browser smoke owed:** yes, to the product owner — "does the reader look and behave exactly as it
  did before". Not automatable against a rail with no preview, and it is the whole point of S1.
- **deterministic gate:** `go build ./... && go vet ./... && go test ./...` inside `panfleto-core`,
  plus `docker compose build miniflux` from a fresh clone. **Nothing in CI covers this** — the gate
  is local, and the PR body says so.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: local · `http://localhost:8080` (S1 does not deploy to production)

1. In a **fresh empty directory**, run `git clone <this repo> && cd <repo> && git submodule update --init --recursive`.
   → `panfleto-core/` is populated, not empty.
2. Run `docker compose -f deploy/docker-compose.yml up --build`.
   → The stack comes up; the miniflux container reaches a healthy state with no migration errors in the log.
3. Go to `http://localhost:8080` and log in with the admin credentials from `deploy/.env`.
   → The reader loads, branded "panfleto", with the panfleto logo in the top-left.
4. Open any article.
   → The paywall-bypass rail renders below the article with archive.ph, archive.is, Txtify.it and Wayback — i.e. **unchanged**. S1 changes nothing user-visible.
5. Go to Settings → Integrations.
   → The "Panfleto AI Assistant (MCP)" panel is present with an MCP URL.
6. Go to `http://localhost:8080/about`.
   → The version is the **same** as production reports today. If it is newer, upstream code moved in S1 and it shouldn't have.

If any step fails, note the step number + what you saw — that's the bug report.
