# A new signup should not be a coin flip — Sprint 1: Onboarding that reports itself

**Status:** ⬜ not started

> **Build contract (locked by the architect before the builder started)**
>
> - **Do not add a Go file.** `user_onboarding.go` already exists and is already ours — everything
>   here goes in it (`AGENTS.md` rule 1).
> - **Do not block the OAuth callback.** Whatever replaces the bare `go` call must still return the
>   user to the reader immediately. A signup that waits 13 feed fetches before rendering is a worse
>   bug than the one being fixed.
> - **The reporting channel does NOT currently fire on the Auth0 path.** `TELEGRAM_BOT_TOKEN` and
>   `RESEND_API_KEY` reach only the `landing` container, while `provisionUserOnboarding` runs inside
>   `miniflux` — so the code runs and silently does nothing. **Making it fire is step one**, and the
>   fix is a compose/env change in `deploy/docker-compose.yml`, not new Go. Confirm the current
>   behaviour before writing anything.
> - **Check which signup path you are fixing.** Onboarding runs from `oauth2_callback.go` (Auth0
>   only); password registration goes through the landing page's `/api/register`. They are different
>   code paths with different gaps.
> - **Test with a disposable account** and clean up after — this creates real users and real feeds.

## Stories

### Story 1.1 — Onboarding that reports itself
**As the** product owner, **I want** to know when a signup didn't fully provision, **so that** a
partial feed list is something I can fix rather than something nobody sees.

**Acceptance:**
- The provisioning goroutine runs under a `context` with a deadline (D1) — it cannot hang forever
- Per-feed results are collected rather than discarded
- **The Telegram notification fires at all on the Auth0 path** — verified, not assumed. This means
  `TELEGRAM_BOT_TOKEN` and `RESEND_API_KEY` reach the `miniflux` container, documented in
  `deploy/.env.example`
- It fires **after** provisioning and carries the outcome: e.g.
  `new signup: <user> — 11/13 feeds added, 2 failed: <url>, <url>`
- The hardcoded Telegram chat id and Resend from-address move to config while you are in this file
- A failure in the Telegram or Resend call does not affect the feed provisioning, and vice versa —
  three independent failures, not one chain
- The OAuth callback still returns immediately; signup latency is unchanged (measure it)
- D2's answer is implemented: either the partial state is silently accepted (documented), or the
  welcome email names what to re-add

**Risk:** low

### Story 1.2 — A dead starter feed found before a user meets it
**As the** product owner, **I want** the starter list checked, **so that** I stop discovering dead
feeds from new users' empty categories.

**Acceptance:**
- A check fetches every starter feed URL and reports which return non-200, a non-feed content type, or
  nothing parseable
- It reads the list from `feeds.json` — that shipped with resync S3 and is the single source for the
  Go onboarding, the subscribe page and the categoriser
- It runs at least once now, and the current dead feeds (if any) are listed in this file
- D3's answer is implemented: either it stays a manual script, or a scheduled Action reports to the
  same Telegram channel
- It is a script under `scripts/`, not Go — rule 1

**Risk:** low

## Sprint QA
- **api spec(s):** pure-logic `go test` on the result-collection and the message formatting — given a
  mix of successes and failures, the summary string is correct. That is the part that is wrong today
  and the part that would silently regress.
- **browser smoke owed:** yes, to the product owner — registering a disposable account and watching
  the Telegram message arrive with real counts.
- **deterministic gate:** `go build ./... && go vet ./... && go test ./...` + `node --test scripts/*.test.mjs` + `docker compose build miniflux`.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: production · `https://panfleto.win` and `https://app.panfleto.win`

1. Register a **disposable** test account at `https://panfleto.win`.
   → You are signed in and land in the reader within the usual time. No added delay.
2. Watch the Telegram channel.
   → A message arrives naming the user **and** a feed count, e.g. "13/13 feeds added".
3. In the new account, open the Feeds page.
   → The count matches what Telegram said.
4. Check the categories.
   → Tech, News, Business, Comics and Culture all have feeds in them. No empty category.
5. Run the starter-feed health check.
   → It reports every feed's status. Any dead ones are named.
6. Read the dead-feed list recorded in story 1.2 of this file.
   → It exists and matches what the check just printed.
7. Delete the disposable account.
   → Cleaned up.

If any step fails, note the step number + what you saw — that's the bug report.
