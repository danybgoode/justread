---
title: "Click an article and the content is already there"
slug: article-autofetch
status: raw
area: "01"
type: feature
priority: wave-2026-09-panfleto
appetite: M
underwritten_by: null
risk: high
epic: null
build_order: 6
updated: 2026-09-14
---

# Seed — Click an article and the content is already there

> **Portfolio pass only — not Definition of Ready.** Sequenced, sized and lane-assigned so it is
> bettable; deep-groom it when it reaches the front of the queue. It is blocked on
> `miniflux-upstream-resync` (it patches the fork) and on `spike-unwall-app` (step 2 of its chain).

## Problem
Some feeds arrive with full content; most arrive with a teaser and a link. For those, the reader has
to notice the Download button, press it, and wait. The north star for the reading experience is
**click an article and it's already there** — no second action, no second tab.

The gate is one line, `internal/reader/processor/processor.go:97`:

```go
if feed.Crawler && (entryIsNew || forceRefresh) {
```

Content is scraped at poll time *only* if that feed has "fetch original content" enabled. The manual
button takes the same path from the other end — `POST /entry/download/{id}` → `entry_scraper.go` →
`processor.ProcessEntryWebPage`. Same scraper, different trigger. The repo README has claimed since
May that original-content fetching is "enabled everywhere"; it is not.

## Appetite
**M** — one wave: an architect session, builder fan-out across three sprints, review rounds. If the
third layer doesn't fit, it ships with two — see the no-gos.

## Lane
**Shaped bet.** New capability, real architecture forks, and it changes panfleto's outbound traffic
profile — the betting table should see it.

## Rough shape — three layers, skateboard first

| Layer | What | Ships alone? |
|---|---|---|
| **1a · crawler on by default** | `Crawler: true` on feed creation + a `FORCE_CRAWLER` option + a one-time backfill over existing feeds | **Yes** — this is the skateboard, and it delivers most of the visible win |
| **1b · fallback chain** | Direct scrape → `unwall.app` → `archive.ph`; first non-empty result wins; per-feed opt-out | Yes, on top of 1a |
| **1c · prefetch worker** | Poller enqueues thin entries; a bounded pool drains with per-host concurrency 1; `fetch_status` surfaced in the UI | Yes, on top of 1b |

## The two things that make this harder than it looks

**1. It changes panfleto's traffic profile.** `POLLING_FREQUENCY: 60` × `BATCH_SIZE: 100` × a
three-step chain, on 2 OCPU that are also running Postgres with 3 GB of `shared_buffers`, is a burst
the VM will feel — and a fast way to get rate-limited by archive.ph. That is why 1c exists: scraping
must come *off* the poll path, not be added to it. Retune `POLLING_FREQUENCY` and `BATCH_SIZE`
together with it, or the prefetcher and the poller fight for the same two cores.

**2. There is no flag provider.** Stage 6b asks for a kill-switch on a `risk: high` epic. panfleto
has **no flag rail at all** — no `lib/flags.ts`, no provider, nothing. The nearest seam is a Miniflux
config env var in `deploy/docker-compose.yml`, which means "flipping the switch" is an SSH plus a
container restart. That is a real decision for the deep groom, not a checkbox: either accept the
env-var seam and say so, or build a minimal flag rail first as its own slice.

## Likely no-gos
- Rendering unwall.app in an iframe (see `spike-unwall-app`)
- Per-user fetch preferences — this is a per-feed setting, not a per-account one
- Re-fetching historical entries beyond a bounded backfill
- A third fallback beyond unwall + archive.ph; each one multiplies outbound volume

## What already exists (reuse, don't rebuild)
- `internal/reader/processor/processor.go` — the crawler gate and the scrape/rewrite pipeline
- `internal/reader/scraper/` + `internal/reader/readability/` — extraction, already good
- `internal/reader/fetcher/` — request building, encoding, response handling
- `internal/ui/entry_scraper.go` — the manual path, which is the behaviour being automated
- Miniflux's per-feed `Crawler`, `ScraperRules` and `RewriteRules` — three existing knobs before any
  new one is invented (`AGENTS.md` rule 1)

## Open questions for the deep groom
1. What counts as "thin"? A character threshold, a paywall-marker match, or both?
2. Does `fetch_status` need a new column (→ `AGENTS.md` rule 3, a migration, HIGH tier and escalate)
   or can it be derived at read time?
3. Everything-for-everyone vs. escalate-only-for-marked-paywalled-feeds. The product owner has said
   **everything-for-everyone**; the deep groom should confirm that survives contact with
   archive.ph's rate limits.
4. Env-var seam or build a flag rail?
