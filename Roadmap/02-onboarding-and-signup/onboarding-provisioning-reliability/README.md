---
status: in-progress
slug: onboarding-provisioning-reliability
build_order: 9
---

# Epic: A new signup should not be a coin flip

> **Area:** 02-onboarding-and-signup · **Risk:** low · **Class:** Chore · **Scope seed:** [`00-ideas/seeds/onboarding-provisioning-reliability.md`](../../00-ideas/seeds/onboarding-provisioning-reliability.md)

## Why

`internal/ui/oauth2_callback.go` fires onboarding as a bare goroutine:

```go
go provisionUserOnboarding(h.store, user.ID, user.Username)
```

That goroutine then makes **13 sequential `CreateFeed` calls, a Telegram POST and a Resend POST** with
no context, no deadline, no retry and no error surfacing — failures go to `slog` and nowhere else
(`internal/ui/user_onboarding.go`). A process restart, a slow feed, or one dead URL mid-run leaves a
new user with a partial feed list, and nobody finds out.

panfleto's core onboarding promise is **no empty screen** — a brand-new account opens onto 13
categorised feeds with articles in them. Right now that promise is kept most of the time, and nobody
can say what "most" means.

The most recent commit on the repo before the roadmap landed was *"Replace three starter feeds that no
longer work."* That is what discovering this by hand looks like.

## Platform-first note

`user_onboarding.go` is already a fork delta file, so hardening it costs no new rebase tax
(`AGENTS.md` rule 1). Miniflux's `feedHandler.CreateFeed` already returns a usable error per feed —
the information needed is being thrown away, not missing. The Telegram sender already exists in the
same file, so the reporting channel needs no new integration.

## ⚠️ The bug is worse than the seed said — corrected 2026-09-15

`miniflux-upstream-resync`'s close-out surfaced two facts that change this epic's shape, and both came
from reading the shipped system rather than the seed:

1. **Auth0 signups never send the welcome email or the Telegram ping at all.** Not "sometimes" —
   never. `TELEGRAM_BOT_TOKEN` and `RESEND_API_KEY` are passed only to the `landing` container, while
   `provisionUserOnboarding` runs inside `miniflux`. So the notification code executes and silently
   does nothing on the SSO path. The seed's framing — "make the Telegram ping say something useful" —
   assumed a ping that fires. **Story 1.1 has to make it fire first.**
2. **Onboarding runs only on the Auth0 path.** A password-registration signup gets no starter-feed
   provisioning from `oauth2_callback.go` at all; the landing page's `/api/register` handles that path
   separately. Confirm which path does what before changing either.

**Good news:** `feeds.json` **has** shipped (resync S3). The starter list is one file, read by the Go
onboarding, the subscribe page and the categoriser — so story 1.2's health check is a single-file read,
as hoped. Also note the resync left **"a brand-new account's starter feeds in production"** owed to the
product owner; this epic's smoke walkthrough discharges that debt.

Also recorded there: **the Telegram chat id and the Resend from-address are hardcoded.** Worth fixing
while you are in this file, but say so in the PR rather than letting it ride silently.

## What already exists (reuse, don't rebuild)

- `internal/ui/user_onboarding.go` — the feed loop, the Telegram sender, the Resend sender
- `feedHandler.CreateFeed` — already returns a per-feed error
- The Telegram channel the product owner already receives signup pings on — the reporting surface
  exists, it just isn't being told anything useful
- `feeds.json` from the resync epic, if it has shipped

## Architecture decisions — LOCKED 2026-09-16 (against the live system, before the builder started)

### First, three scope corrections — read the system, not the doc

1. **It is 16 starter feeds, not 13.** `feeds.json` (shipped by resync S3) carries 23 feeds, 16 of
   them `starter: true`, across **six** categories — Tech, News, Business, Comics, Culture **and
   Podcasts**. Every "13 feeds" in this epic's scaffolding is stale, and so is the smoke walkthrough's
   list of five categories.
2. **Auth0 SSO really is live**, so the Go path really does run. Confirmed without touching the host:
   `https://app.panfleto.win/` renders a "Sign in with Auth0" button, and `/oauth2/oidc/redirect`
   302s to `dev-ykgm37vusizdqi41.us.auth0.com`. The seed's premise holds.
3. **…but the path the smoke walkthrough actually exercises is the *other* one.** Signing up at
   `https://panfleto.win` posts to the landing page's `/api/register`, which provisions feeds in
   TypeScript and sends its own Telegram ping — a completely separate implementation from
   `provisionUserOnboarding`. **Both paths are fire-and-forget, and both are in scope.** Fixing only
   the Go one would leave the epic's own step 2 ("watch the Telegram channel") reporting nothing new.

The seed's claim that the notification cannot fire on the Auth0 path is **confirmed from the compose
file**: `TELEGRAM_BOT_TOKEN` and `RESEND_API_KEY` are listed under the `landing` service only, while
`provisionUserOnboarding` runs inside `miniflux`. The code runs and silently does nothing.

| # | Decision | Locked answer |
|---|---|---|
| **D1** | Context deadline, or a real retryable job | **A deadline plus reporting.** `context.WithTimeout` around the feed loop, checked between feeds; the notifications get their own short deadlines. A job queue is a bigger build than this bet bought, and the failure it would fix (a feed that is dead *right now*) is fixed better by story 1.2 than by retrying. **Honest limit, stated rather than glossed:** `feedHandler.CreateFeed` takes no `context`, so the deadline bounds the loop *between* feeds, not a single hung fetch. Miniflux's own HTTP client has its own timeouts; the guarantee is "this cannot run forever", not "this cannot block for one feed's timeout" |
| **D2** | What a partial provision does for the user | **Accepted silently for the user; reported loudly to the operator.** A failed starter feed is almost always a *dead feed in `feeds.json`* — an operator-level fact that affects every future signup, not something one user can usefully fix by pasting a URL back. So the welcome email stays a welcome, and the Telegram ping carries `14/16 feeds added — failed: <url>, <url>`. Story 1.2's health check is what closes the loop, and it is the reason this is the honest answer rather than the lazy one |
| **D3** | Whether the feed health check runs on a schedule | **Weekly scheduled Action, reporting by opening/updating a GitHub issue.** Deviation from the story's "reports to the same Telegram channel", and here is why: pinging Telegram from CI means putting the bot token in a *second* credential store, and this run cannot provision that secret. A GitHub issue needs `GITHUB_TOKEN`, which already exists, costs nothing on a public repo, and is visible where the work happens. The script keeps a `--telegram` mode for running it on the host, where the token already lives |
| **D4** | *(new)* Where the two hardcoded values go | **`os.Getenv` in `user_onboarding.go` / `process.env` in the route, with today's values as defaults** — `PANFLETO_TELEGRAM_CHAT_ID` and `PANFLETO_EMAIL_FROM`. Not `internal/config/options.go`: that is an upstream-owned file, and two strings used by one panfleto-owned file do not justify growing that patch (`AGENTS.md` rule 1) |
| **D5** | *(new)* The fork's delta grows by one | **28 → 29 files**, for `internal/ui/user_onboarding_test.go`. The sprint's QA asks for a pure-logic Go test on exactly the formatting that is wrong today, and a `_test.go` beside a file panfleto already owns is the cheapest delta there is — upstream has no file of that name, so it can never conflict. The epic's DoD said this epic "should not change" the count; it does, by one, deliberately |

## Scope — stories

| Sprint | Story | Risk |
|---|---|---|
| 1 | 1.1 — Onboarding that reports itself | low |
| 1 | 1.2 — A dead starter feed found before a user meets it | low |

## Definition of Done (epic)
- [ ] Sprint merged to `main` + deployed + smoke-tested (gaps stated)
- [ ] `sprint-1.md` has its smoke walkthrough
- [ ] This README marked ✅; sprint status ticked with commit refs
- [ ] `RETROSPECTIVE.md` written
- [ ] Product poster updated — 02's "fire-and-forget" 🚧 line is corrected
- [ ] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [ ] `AGENTS.md` rule 1's delta count re-checked (this epic should not change it — it edits an
      existing delta file)
- [ ] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
