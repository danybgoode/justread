---
status: scaffolded
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

## Architecture decisions — to be LOCKED before the builder starts

| # | Decision | State |
|---|---|---|
| **D1** | Context deadline, or a real retryable job | **To lock** — a deadline plus reporting is the S-appetite answer; a job queue is a bigger build. Pick the smaller one unless there's a reason |
| **D2** | What a partial provision does for the user | **To lock** — silently partial (today), or the welcome email says which feeds to re-add. The second is more honest and slightly more work |
| **D3** | Whether the feed health check runs on a schedule | **To lock** — a one-off check now, or a weekly Action that catches a dead starter feed before a user does |

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
