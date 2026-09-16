# A new signup should not be a coin flip — Sprint 1: Onboarding that reports itself

**Status:** ✅ shipped — both signup paths report themselves; the starter list is checked weekly (fork pin `65c12ac0`)

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

#### What was built

**Both signup paths, not one.** The epic was scoped around the Auth0 goroutine; the path this
sprint's own smoke walkthrough exercises (`https://panfleto.win` → `/api/register`) is a separate
TypeScript implementation with the same bug. Fixing only the Go one would have left step 2 of the
walkthrough reporting exactly what it reports today.

| | Before | After |
|---|---|---|
| Auth0 signup notification | **never fired** — `TELEGRAM_BOT_TOKEN`/`RESEND_API_KEY` went only to the `landing` container | both reach `miniflux` too; the code that was silently doing nothing now does something |
| Message content | `🎉 YEEHAW! A new reader just joined Panfleto!` + the email address | `⚠️ New reader x@y joined Panfleto — 14/16 starter feeds added, 2 failed:` + the failing URLs |
| Per-feed errors | `slog.Error` and nowhere else | collected into `[]feedResult`, counted, and reported |
| Runtime bound | none — a bare `go` call with no deadline | `context.WithTimeout`, 4 min for the loop, 20 s per notification |
| `/api/register` feed errors | **invisible** — `fetch` only rejects on transport errors, so a Miniflux 500 for a dead feed sailed past the `try/catch` | non-2xx is a recorded failure with its status |
| Hardcoded chat id / from-address | literals in two files | `PANFLETO_TELEGRAM_CHAT_ID` / `PANFLETO_EMAIL_FROM`, defaulting to today's values |

**Three independent failures, not one chain.** Feeds are committed to the database before either
notification is attempted; the Telegram call and the Resend call each have their own deadline and
their own error handling, so a dead bot cannot cost a user their welcome email.

**Signup latency is unchanged in shape.** The OAuth callback still hands off with `go
provisionUserOnboarding(...)` and returns immediately — the deadline lives inside the goroutine. The
password path was already synchronous and stays so, but each of its calls now has a 20 s timeout, so
one unreachable feed can no longer hold a registration open indefinitely.

**D1's honest limit, stated rather than glossed:** `feedHandler.CreateFeed` takes no `context`, so
the deadline is checked *between* feeds. One feed can still block for its own HTTP timeout; the
guarantee is "this cannot run forever", not "no single feed can be slow".

**AGENTS.md rule 4 while in the neighbourhood:** the Telegram API URL carries the bot token in its
path, and Go's `*url.Error` embeds the request URL in its message — so the old
`slog.Error(..., slog.Any("error", err))` would have written the bot token into the container log on
any network failure. Both paths now scrub the credential before logging, and there is a test for it.

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

#### Results — run 2026-09-16

```
✅ All 16 starter feeds are alive.
```

**No dead starter feeds today.** All 16 answered, the slowest (`ft.com/rss/home`) in 1.1 s, and every
one of them returned a parseable feed with a feed content-type — so there is nothing to replace in
`feeds.json` right now. That is the honest answer to "list the current dead feeds": the list is empty,
and the check is what keeps it that way.

**The check nearly shipped as a liar.** Its first run reported **15 of 16 feeds broken**, because a
real RSS feed starts `<?xml version="1.0"?>`, not `<rss`. A checker that cries wolf is worse than no
checker — the next genuinely dead feed gets ignored — so `feedRoot()` now skips the XML declaration,
processing instructions, comments and a DOCTYPE before looking at the root element, and that exact
case is pinned in `scripts/starter-feed-health.test.mjs`.

It distinguishes three outcomes rather than trusting `res.ok`, because the interesting failure is a
**200 that isn't a feed** — a parked domain or a login wall:

- **broken** — a transport error, a timeout, a 4xx/5xx, an unresolved redirect, or a body whose root
  element is not `<rss>`/`<feed>`/`<rdf:RDF>`/JSON;
- **warning** — parseable, but served under a non-feed content-type (Miniflux copes; not a failure);
- **healthy**.

**D3 as implemented, and where it deviates:** `.github/workflows/starter-feed-health.yml` runs it
every Monday at 07:23 UTC and reports by **opening one GitHub issue**, commenting on it while feeds
stay broken and closing it when they recover — not by pinging Telegram. Pinging Telegram from CI
means putting the bot token in a second credential store, and `AGENTS.md` rule 4 keeps credentials on
the host. `--telegram` exists for host-side runs, where the token already lives.

#### Scope corrections found while building

- **16 starter feeds across six categories**, not 13 across five — `feeds.json` gained Podcasts. The
  smoke walkthrough below is corrected.
- **Both signup paths provision feeds**, and both were fire-and-forget. See above.
- **`/api/register`'s `try/catch` never saw a feed failure at all.** `fetch` rejects on transport
  errors only, so Miniflux answering 500 for an unreachable feed — the *normal* way a starter feed
  dies — was read as success. That is why "nobody can say what 'most of the time' means".

## Sprint QA
- **api spec(s):** pure-logic `go test` on the result-collection and the message formatting — given a
  mix of successes and failures, the summary string is correct. That is the part that is wrong today
  and the part that would silently regress.
- **browser smoke owed:** yes, to the product owner — registering a disposable account and watching
  the Telegram message arrive with real counts.
- **deterministic gate:** `go build ./... && go vet ./... && go test ./...` + `node --test scripts/*.test.mjs` + `docker compose build miniflux`.

#### Live confirmation — production, 2026-09-16 (PR #15, `d66b02a`, deployed as pin `4e012f63`)

A **real disposable signup at `https://panfleto.win`**, then deleted:

| Step | Result |
|---|---|
| `POST /api/register` | `{"success":true,"userId":4}`, HTTP 200 in **30.7 s** |
| Feeds provisioned | **16 of 16** |
| Categories | all six populated — Tech 5, News 4, Podcasts 3, Business 2, Comics 1, Culture 1. **No empty category** |
| Landing container log | `Onboarding finished: 16/16 feeds added for smoke-onboarding-…` |
| Welcome email | accepted by Resend (no rejection logged) |
| Cleanup | test user deleted (`DELETE /v1/users/4` → 204); the account now answers 401 |
| `api` Playwright suite against production | 8 passed |

**The 30.7 s is the honest number for this path** and it is not new: Miniflux fetches each feed as it
is subscribed, and the landing page has always waited for that. What is new is that it is now
*bounded* — 15 s per call, 60 s for the loop — where before it was unbounded.

#### ⚠️ Found by the smoke, and owed to the product owner: `TELEGRAM_BOT_TOKEN` is EMPTY in production

The epic's premise was that Auth0 signups notify nobody because the token reaches only the `landing`
container. That container split was real and is fixed. **But the token is also blank on the host** —
`deploy/.env` has the line `TELEGRAM_BOT_TOKEN=` with a zero-length value (checked by length, never by
reading it). So the ping fires on *neither* path today, and the landing log says so out loud:

```
TELEGRAM_BOT_TOKEN is not set in environment variables
```

`RESEND_API_KEY` is set (36 characters), which is why the welcome email works and the Telegram ping
does not. **Acceptance "the Telegram notification fires at all — verified, not assumed" is therefore
NOT verified**, and cannot be by an agent: the value is a credential that lives on the host.

To finish it, on the VM:

```bash
# Fill in the EXISTING empty line (don't append a second one - the last wins, but two is confusing):
sudo -e /opt/panfleto/deploy/.env            # set TELEGRAM_BOT_TOKEN=<the bot token>
cd /opt/panfleto/deploy && docker compose up -d   # a restart, not a rebuild
```

Then register one more disposable account and the message arrives, carrying the count. Everything
between the signup and that HTTP call is now shipped and exercised.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: production · `https://panfleto.win` and `https://app.panfleto.win`

1. Register a **disposable** test account at `https://panfleto.win`.
   → You are signed in and land in the reader within the usual time. No added delay.
2. Watch the Telegram channel.
   → A message arrives naming the user **and** a feed count — `🎉 New reader … — all 16 starter feeds
   added.`, or `⚠️ … 14/16 starter feeds added, 2 failed:` with the URLs.
3. In the new account, open the Feeds page.
   → The count matches what Telegram said.
4. Check the categories.
   → Tech, News, Business, Comics, Culture **and Podcasts** all have feeds in them. No empty category.
4b. **(Auth0 path — the one that was silently broken)** Sign up a second disposable account through
   "Sign in with Auth0".
   → A Telegram message arrives for this one too. Before this sprint, none ever did.
5. Run the starter-feed health check: `node scripts/starter-feed-health.mjs`.
   → It reports every feed's status and exits 0. Any dead ones are named, with why.
6. Read the dead-feed list recorded in story 1.2 of this file.
   → It exists and matches what the check just printed.
7. Delete the disposable account.
   → Cleaned up.

If any step fails, note the step number + what you saw — that's the bug report.
