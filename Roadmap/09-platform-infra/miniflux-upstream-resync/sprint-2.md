# Put panfleto-core back on upstream's timeline — Sprint 2: Rebase forward to main

**Status:** ⬜ not started

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
- `app.panfleto.win/about` reports 2.3.3
- The product-owner smoke walkthrough below passes end to end
- **Then stop.** Live on 2.3.3 for a few days before 2.3.

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
  API-level, no login: asserts `/healthcheck` is 200, that `/` redirects to the login page rather
  than 500ing, and that `/about` returns a version string. Thin on purpose — it is the spec that
  would have caught a failed migration or a half-started container, and it runs against both
  `localhost:8080` and `app.panfleto.win`.
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
   → After deploy 1: version 2.3.3. After deploy 2: a version newer than 2.3.3.
9. Check the container log for the first boot after each deploy.
   → Migration lines present, no error, and the reader answered step 1 afterwards.

If any step fails, note the step number + what you saw — that's the bug report.
