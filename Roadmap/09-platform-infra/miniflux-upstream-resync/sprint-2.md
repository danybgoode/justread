# Put panfleto-core back on upstream's timeline — Sprint 2: Rebase forward to main

**Status:** 🚧 in progress — 2.1 ✅ · 2.2 deployed (#2, `6c53c96`), soaking per D11 · 2.3 built + rehearsed, PR pending the soak

> **Build contract (locked by the architect before the builder started)**
>
> - **D2 · track `upstream/main`.** Two hops, not one: `v2.3.3` first, live for a few days, then
>   `upstream/main`. If something breaks you then know whether it came from a release or from
>   unreleased main.
> - **Story 2.1 blocks 2.2 and 2.3.** No rebased code is deployed until a `pg_dump` from the backup
>   bucket has been restored into a throwaway Postgres and *verified*. One environment, no staging,
>   and the submodule pin cannot roll back a schema change.
> - **Do NOT add a migration during this epic** (`AGENTS.md` rule 3). Zero custom migrations is the
>   reason this rebase is safe: `schemaVersion = len(migrations)`, upstream appends to the same
>   slice, and because panfleto has never appended, upstream's two new migrations land at the
>   indices they expect.
> - **Do NOT "fix" the `cspNonce` patch here.** It disappears on its own in S3. Touching it now
>   creates a conflict in S3 for no gain.
> - **The conflict surface is known.** Exactly one upstream commit has touched each forked template
>   since the fork point: `add_subscription.html` ← `b3039d6c`, `entry.html` ← `6dcb815c`,
>   `layout.html` ← `aa509b88`. **A conflict anywhere else means the S1 replay was wrong — stop and
>   check rather than resolving.**
> - **The build happens on the production host.** Deploy while someone is watching.
> - **Never deploy across the nightly backup (04:43 UTC).** Migrations 131 and 134 `DROP INDEX` on
>   `enclosures`, which needs an ACCESS EXCLUSIVE lock, while a running `pg_dump` holds ACCESS SHARE on every
>   table. Boot would stall and Caddy would 502 until the dump finished (fresh-review finding, PR #2).

## Stories

### Story 2.1 — A restore that has actually been restored
**As the** product owner, **I want** proof that last night's backup restores before anything is
deployed, **so that** the one irreversible part of this epic has a way back.

**Acceptance:**
- A `pg_dump` is pulled from the `panfleto-backups` bucket and restored into a throwaway Postgres
- `SELECT count(*)` on `entries`, `feeds` and `users` in the restored copy matches production within
  the backup's age
- The restored database's `schema_version` is read and recorded in this sprint doc
- **Row counts are recorded here** — they are what decides whether the migrations are cheap (D6)
- The pre-rebase submodule SHA is written into the epic README's *Rollback* section (D7)

**Result (2026-09-14/15):** ✅ performed **on the VM**, in a throwaway `postgres:17-alpine` container with
`--network none`, so production data never left the host. Removed afterwards.

| | restored copy | live (at restore time) |
|---|---|---|
| object | `db/miniflux-2026-09-14T04-43-01Z.sql.gz` (39 MB, the nightly 04:43 UTC run) | — |
| `schema_version` | **130** | 130 |
| `entries` | **30,065** | 31,353 (+1,288 in the ~20 h since the dump — hourly polling) |
| `feeds` / `users` / `categories` | **52 / 3 / 17** | 52 / 3 / 17 |
| `enclosures` | **24,585** | 25,824 |
| public indexes | **42** | 42 |
| restore errors · orphaned entries · `status='removed'` entries | **0 · 0 · 0** | — |

D6 follows from this: at 25k enclosures, the index rebuilds in 131 and 134 finish in under a second.
Migration v127's orphan guard (`79d920bc`) matters for restored databases, and this one has no orphans.
D7: the pre-rebase SHA `bdf23f75` is recorded in the README's *Rollback* section and tagged `pre-resync`.

**Risk:** high

### Story 2.2 — Rebase to v2.3.3, deploy, verify
**As a** reader, **I want** panfleto running a current released Miniflux, **so that** I get four
months of upstream fixes — including the ones to the authentication paths panfleto uses.

```
git fetch upstream --tags
git rebase v2.3.3
```

**Acceptance:**
- The rebase completes with conflicts only in the three files named in the build contract
- `go build ./... && go vet ./... && go test ./...` clean
- `docker compose build miniflux` succeeds from a fresh clone
- Deployed via `update.sh`; first boot applies the new upstream migrations with no error in the log
- ~~`app.panfleto.win/about` reports 2.3.3~~ → README **D9**: `/about` reports `2.3.x-dev`; a hop is proven by `schema_version` and the submodule pin
- The product-owner smoke walkthrough below passes end to end
- **Then stop.** Live on 2.3.3 for a few days before 2.3. *(Re-shaped by README D11: bounded by evidence, not by the calendar.)*

**Result so far (2026-09-15):**
- **Rebase.** `panfleto` → `c1b100fe` (tag `resync-hop1-v2.3.3`). **Scope correction:** the build contract's
  "conflicts only in the three named files" was incomplete. `aa509b88` is the named `layout.html` commit, but it also
  **deleted five favicon PNGs** that the branding commit modifies (modify/delete conflicts) and switched the browser
  favicon to upstream's `icon.svg`. `layout.html` itself merged without conflict. This isn't a bad S1 replay: the
  audit only counted text files. Resolution: take the deletions, and make `icon.svg` an SVG that embeds
  panfleto's existing `icon-192.png`. Taking upstream's file as-is would have silently changed the favicon
  to Miniflux's logo. `git range-diff`: commits 2–4 identical, commit 1 differs only in those icons, commit 5
  only in upstream context lines. Delta at v2.3.3: **12 files + 17 icon files** (16 PNG/ICO + `icon.svg`). After review, `icon.svg`
  embeds the 23 KB `icon-120.png` rather than the 192 px one (72 KB → 31 KB); the tip is now `e219eb3d`.
- **Gate.** `go build` / `go vet` / `go test ./...` clean (exit 0). A fresh clone of the S2 branch with
  `--recurse-submodules` → `docker compose build miniflux` → 132 migrations on an empty DB.
- **Rehearsal against production data (added, not in the scaffold).** On the VM: build the hop-1 image, restore last
  night's dump into a throwaway Postgres, boot the image against it. Log: `Running database migrations
  current_version=130 latest_version=132` → `Starting HTTP server`. `schema_version` 132, the enclosures index now
  `encode(sha256(url::bytea),'hex')`, `/healthcheck` 200, sign-in page branded. Removed afterwards.
- **Spec.** `e2e/reader-health.spec.ts`, 6 tests, green locally at v2.3.3 and against production at S1.
  **Observed red:** (1) upstream `icon.svg` swapped back in → the favicon test fails; (2) reader stopped → 6/6 fail.
  **Scope correction:** the scaffolded spec said "`/about` returns a version string" anonymously. It
  doesn't: `/about` 302s to sign-in. The spec asserts that redirect, plus `/v1/version` → 401 JSON.
- **Local logged-in smoke at v2.3.3.** `/about` 2.3.x-dev, logo `panfleto`, MCP panel with a token URL, 17
  suggestions, the favicon renders the panfleto albatross, CSP counts identical to the D10 baseline (0/0/20/4/0).

**Deployed to production (2026-09-15 01:36 UTC, `update.sh`, merge `6c53c96`):**
- Build + restart **61 s**; the old container served throughout the build.
- Boot log: `Running database migrations current_version=130 latest_version=132` → `Starting HTTP server`, no error.
- `schema_version` **132**; `enclosures_user_entry_url_unique_idx` = `encode(sha256(url::bytea),'hex')`.
- `git -C /opt/panfleto submodule status` → `e219eb3d (resync-hop1-v2.3.3)`; `miniflux -version` → `2.3.x-dev`.
- `npx playwright test --project=api` against `https://app.panfleto.win` → **6/6**. `https://panfleto.win` → 200.
- Log in the first 10 minutes: only the spec's own deliberate anonymous `/v1/version` 401. Nothing else above INFO.
- **Soak (D11):** SOAK_RESULT_PENDING

**Risk:** high

### Story 2.3 — Rebase to upstream/main, deploy, verify
**As a** maintainer, **I want** the fork sitting directly on `upstream/main`, **so that** the weekly
sync in S3 has zero backlog to work through on its first run.

**Acceptance:**
- `git rebase upstream/main` completes; `git log --oneline upstream/main..panfleto` lists **only**
  the five panfleto topic commits — that single command is the whole proof of this epic
- Gate clean again; deployed; migrations applied; the smoke walkthrough passes again
- The submodule pin in this repo is updated and committed
- If anything here fights back, **stop and re-shape** rather than extending the appetite in flight

**Risk:** high

## Sprint QA
- **api spec(s):** `e2e/reader-health.spec.ts` — the first real spec in this repo. Anonymous,
  API-level, no login: asserts `/healthcheck` is 200, that `/` renders the sign-in page rather
  than 500ing, and that `/about` redirects to sign-in. Thin on purpose — it is the spec that
  would have caught a failed migration or a half-started container, and it runs against both
  `localhost:8080` and `app.panfleto.win`. *(Scope correction: `/about` is behind sign-in, so the spec asserts its 302 plus `/v1/version` → 401 — see 2.2's results.)*
- **browser smoke owed:** yes, to the product owner — **the Auth0 SSO login and the authenticated
  reader**. An anonymous `request` fixture cannot drive Miniflux session auth or the Auth0
  round-trip, and there is no disposable test account. Steps 2–7 below are owed by name.
- **deterministic gate:** `go build` + `go vet` + `go test` + `docker compose build` + the api spec
  against a local stack. Local, not CI — say so in the PR body.

## Sprint 2 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win` — **run this after each of the two deploys**

1. Go to `https://app.panfleto.win/healthcheck`.
   → Returns OK. (The only step an automated spec covers.)
2. **(auth path — owed to the product owner by name)** Go to `https://app.panfleto.win` and sign in with Auth0 SSO.
   → You land in the reader, signed in, on the Feeds page.
3. Open any article from the list.
   → The article renders, branded panfleto, with the paywall-bypass rail below it.
4. Press the Download (scraper) button on an article whose feed does not fetch original content.
   → The article body is replaced with the full scraped text within a few seconds.
5. Star the article, then open the Starred view.
   → The article is there.
6. Go to `https://app.panfleto.win/subscribe` and add `https://xkcd.com/rss.xml`.
   → The feed is added and its entries appear.
7. **(auth path — owed to the product owner by name)** Go to Settings → Integrations.
   → The "Panfleto AI Assistant (MCP)" panel shows an MCP URL containing a token.
8. Go to `https://app.panfleto.win/about`.
   → `2.3.x-dev` after either deploy (it read `2.2.x-dev` before this epic). The version string can't
   tell the two hops apart (README D9); step 9 can.
9. Check the container log for the first boot after each deploy.
   → `Running database migrations current_version=130 latest_version=132` after deploy 1, `132 → 134`
   after deploy 2; no error; and, after the next hourly refresh, no `unable to create enclosure` lines.

If any step fails, note the step number + what you saw — that's the bug report.
