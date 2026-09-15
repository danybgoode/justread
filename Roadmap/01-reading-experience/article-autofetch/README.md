---
status: scaffolded
slug: article-autofetch
build_order: 6
---

# Epic: Click an article and the content is already there

> **Area:** 01-reading-experience · **Risk:** high · **Class:** Feature · **Archetype:** Grower · **Scope seed:** [`00-ideas/seeds/article-autofetch.md`](../../00-ideas/seeds/article-autofetch.md)

## Why

Some feeds arrive with full content; most arrive with a teaser and a link. For those, a reader has to
notice the Download button, press it, and wait — which is the moment a distraction-free reading
session stops being one. The north star for this domain is **click an article and it's already
there**: no second action, no second tab, no bouncing to a paywall.

## ⚠️ Scaffolded on assumptions — the architect must resolve these first

This epic was sliced **before** its open questions were answered, at the product owner's request. Four
things are assumed rather than decided. **Resolve each one during the architecture lock and write the
answer into the D-table below before any builder starts.** A builder that hits one of these mid-sprint
should escalate, not guess.

| # | Assumption baked into the slicing | How to resolve it |
|---|---|---|
| **A1** | unwall.app returns fetchable article HTML suitable for readability extraction | **Run `spike-unwall-app` first.** It is a separate scaffolded epic and it is cheap. S2 is built on its decision |
| **A2** | "Thin content" can be detected well enough by a character threshold | Sample real `entries.content` lengths with `psql` across full-text and teaser feeds; find where the distributions separate. If they don't, the trigger has to change |
| **A3** | `fetch_status` can be **derived**, not stored | If it must be a column, that is a **migration** → `AGENTS.md` rule 3, HIGH tier, **escalate — do not write it**. The resync retro records reviewers repeatedly mis-flagging upstream's own columns as missing migrations — read `migrations.go` yourself, don't trust a review finding here |
| **A4** | Everything-for-everyone survives archive.ph's rate limits | Measure during S2 against real volume. If it doesn't, the fallback narrows to marked-paywalled feeds and S3's appetite shrinks |

> **Post-resync note (2026-09-15).** `miniflux-upstream-resync` has **shipped** — `panfleto-core` is
> a submodule pinned on `upstream/main`, and the delta is now **six topic commits** plus `feeds.json`,
> the sync workflow and 17 branding icons. This epic is therefore **unblocked**, and rule 1's budget is
> measured against that new baseline, not the old 12-file one. Read `AGENTS.md` rule 1 for the current
> number before adding any file.

## Platform-first note

No new primitive. Miniflux already owns all of this: `feed.Crawler` decides whether to scrape,
`internal/reader/scraper/` does the extraction, `internal/reader/fetcher/` does the HTTP. The epic
turns an existing per-feed opt-in into a default, then makes it try harder and try later. The only
place a new primitive threatens to appear is A3, and that is exactly why A3 is called out.

## What already exists (reuse, don't rebuild)

- **`internal/reader/processor/processor.go:97`** — `if feed.Crawler && (entryIsNew || forceRefresh)`, the single gate this whole epic is about
- **`internal/ui/entry_scraper.go`** — the manual Download path (`POST /entry/download/{id}`); this is the behaviour being automated, already working
- **`internal/reader/scraper/` + `internal/reader/readability/`** — extraction, already good
- **`internal/reader/fetcher/`** — request building, encoding, response handling
- **Per-feed `Crawler`, `ScraperRules`, `RewriteRules`** — three existing knobs to exhaust before inventing a fourth

## Architecture decisions — to be LOCKED before any builder starts

| # | Decision | State |
|---|---|---|
| **D1** | Fallback order is direct → unwall.app → archive.ph, first non-empty wins | **Decided** — everything-for-everyone, product owner 2026-09-14 |
| **D2** | Scraping comes **off** the poll path, not added to it | **Decided** — see *Why S3 is not optional* below |
| **D3** | A1–A4 above | **To lock** |
| **D4** | Kill-switch mechanism | **To lock** — see below |

### Kill-switch (risk:high — the seed's Stage 6b problem, unresolved)

panfleto has **no flag provider**. No `lib/flags.ts`, no provider, nothing. The nearest runtime seam
is a Miniflux config env var in `deploy/docker-compose.yml`, which means "flipping the switch" is an
SSH plus a container restart. Two honest options, and the architect picks one and records it:

- **Accept the env-var seam.** `FORCE_CRAWLER` and a `FETCH_FALLBACK_CHAIN` var, both read at
  startup. Killing the feature is an SSH and a restart — slow, but real, and it costs nothing to build.
- **Build a minimal flag rail first**, as its own slice ahead of S1. More honest for a project that
  will keep shipping HIGH-risk reader features, and a genuine scope increase.

**Do not default to "no kill switch."** This epic changes what every reader sees on every article and
multiplies panfleto's outbound traffic.

### Why S3 is not optional

`POLLING_FREQUENCY: 60` × `BATCH_SIZE: 100` × a three-step fallback chain, on 2 OCPU that also run a
Postgres holding 3 GB of `shared_buffers`, is a burst the VM will feel — and the fastest way to get
rate-limited by archive.ph. If the appetite runs out after S2, **the correct move is to narrow the
fallback to marked feeds**, not to ship S2 unbounded and leave the poller doing the scraping.

## Scope — stories

| Sprint | Story | Risk |
|---|---|---|
| 1 | 1.1 — New feeds crawl by default | low |
| 1 | 1.2 — Existing feeds backfilled | high |
| 2 | 2.1 — A fallback chain behind one seam | high |
| 2 | 2.2 — unwall.app as step two | high |
| 2 | 2.3 — archive.ph as step three, rate-limit aware | high |
| 3 | 3.1 — The poller enqueues instead of scraping | high |
| 3 | 3.2 — A bounded worker with per-host politeness | high |
| 3 | 3.3 — The reader can see fetch state | low |

## Deploy order

Backend-only; nothing to degrade gracefully. But each sprint changes outbound traffic volume, so
**deploy one sprint at a time and watch the VM** between them — `docker stats` and the miniflux
container log. S2 is the sprint most likely to surface a rate limit; S3 is the one that fixes it.

## Definition of Done (epic)
- [ ] All sprints merged to `main` + deployed via `update.sh` + smoke-tested (gaps stated)
- [ ] Each `sprint-N.md` has its smoke walkthrough (real URLs)
- [ ] This README marked ✅; every sprint status ticked with commit refs
- [ ] `RETROSPECTIVE.md` written
- [ ] Product poster updated — 01's "Original-content fetching" line goes 🚧 → ✅, and the repo `README.md`'s long-standing "enabled everywhere" claim becomes true rather than aspirational
- [ ] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [ ] **Kill-switch:** the D4 mechanism exists and has been tested by actually turning the feature off and back on
- [ ] `AGENTS.md` rule 1's delta count updated for any files this epic added to the fork
- [ ] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
