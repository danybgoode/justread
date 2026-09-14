---
title: "A new signup should not be a coin flip"
slug: onboarding-provisioning-reliability
status: raw
area: "02"
type: chore
priority: null
appetite: S
underwritten_by: null
risk: low
epic: null
build_order: 9
updated: 2026-09-14
---

# Seed — A new signup should not be a coin flip

> **Portfolio pass only — not Definition of Ready.**

## Problem
`internal/ui/oauth2_callback.go` fires onboarding as a bare goroutine:

```go
go provisionUserOnboarding(h.store, user.ID, user.Username)
```

That goroutine then does **13 sequential `CreateFeed` calls, a Telegram POST and a Resend POST** with
no context, no deadline, no retry and no error surfacing — failures go to `slog` and nowhere else
(`internal/ui/user_onboarding.go`). A process restart, a slow feed, or one dead URL mid-run leaves a
new user with a partial feed list, and nobody finds out. Every signup is a coin flip that isn't
observed.

The most recent commit on the repo is literally *"Replace three starter feeds that no longer work"* —
which is what discovering this by hand looks like.

## Appetite
**S** — one builder session.

## Lane
**Fixed scope.**

## Rough shape
Cheapest honest fix: give it a `context.WithTimeout`, collect per-feed results, and send the
Telegram notification **after** provisioning with a count (`11/13 feeds added, 2 failed: <urls>`) so
a failure is visible in the channel that already exists. Better: make it a retryable job.

Adjacent, cheap, and worth folding in: a health check over the starter-feed list so a dead feed is
caught before a user meets it, rather than three commits later.

## Reuse, don't rebuild
- The Telegram and Resend senders already exist in `user_onboarding.go`
- Miniflux's own `feedHandler.CreateFeed` already returns a usable error per feed
- `feeds.json` — if `miniflux-upstream-resync` S3 lands first, the starter list is already
  consolidated into one embedded file, which makes the health check trivial. **Sequence this after
  that sprint.**
