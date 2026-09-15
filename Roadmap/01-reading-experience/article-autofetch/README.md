---
status: in-progress
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

## Scaffolded on assumptions — resolved 2026-09-15 (see the locked table below)

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

## Architecture decisions — LOCKED 2026-09-15 against the live code and production data

Every open assumption was checked on `panfleto-prod` before code (read-only `psql` and `curl` from the VM's
IP). Builders cite these, they don't re-derive them.

| # | Decision | Evidence |
|---|---|---|
| **A1** | **unwall.app is usable, as a server-side fetch** of `api.unwall.app/fetch?url=…` → readability. Every failure is a miss | `spike-unwall-app/sprint-1.md` Decision. Adds the NYT (direct 403s from the VM), doesn't help FT, and isn't needed for El País or The New Yorker |
| **A2** | **Thin = under 2,000 characters of text** (tags stripped), `FETCH_THIN_CONTENT_THRESHOLD`. It separates **feeds**, not entries, so it's applied twice: the backfill picks feeds by their p90, and the chain picks entries by their own length | 14 days, 52 feeds: every teaser feed's p90 is ≤ 1,632 chars (The Verge 870, The Guardian 1,296, Ars 1,632), and every full-content feed's is ≥ 2,521 (Daring Fireball 2,521, Slashdot 3,510, The Atlantic 24,120). Entry medians overlap (Daring Fireball 855, Slashdot 1,955), so an entry-level threshold alone would scrape Daring Fireball |
| **A3** | **`fetch_status` is derived, with no column.** "Fetching" means the entry is in the prefetcher's in-memory queue. "Found nothing" means an in-memory, bounded set of entries whose automatic chain came back thin. A restart forgets both, and recent thin entries are re-queued on boot. **No migration** | `AGENTS.md` rule 3. Nothing in 3.3 needs to outlive a restart |
| **A4** | **Everything-for-everyone survives: 47.6 fallback-eligible entries/hour.** The chain stays wide for every crawler feed | 16,001 thin entries in 14 days across the 27 backfilled feeds = 47.6/h, over 867 distinct article hosts. unwall.app allows 120/min (7,200/h), about 150× headroom, before its edge cache and the 1-hour dedupe cache |
| **D1** | **The chain is direct → unwall.app. archive.ph is cut (story 2.3).** The first non-thin result wins; if both are thin, the longer non-empty one is used | archive.ph can't be reached from the VM: the VCN resolver refuses it and TCP to all three A records times out (spike finding 7). The order is still the product owner's 2026-09-14 decision, minus a step that can't run |
| **D2** | **Scraping comes off the poll path when `PREFETCH_WORKERS` > 0.** The processor stops scraping inline for every caller (poll, subscribe, manual refresh); `handler.RefreshFeed` and both `CreateFeed*` enqueue the new entries' IDs | Unchanged from 2026-09-14. Subscribing to a 25-entry feed with inline scraping and a two-step chain would hold the subscribe request for a minute |
| **D3** | **One seam: `autofetch.Fetch`.** The processor's crawler block and `ProcessEntryWebPage` (the Download button) both call it; the prefetch worker reaches it through `ProcessEntryWebPage` | S2 build contract. The manual and automatic paths can't drift, because there is one path |
| **D4** | **Kill switch = env vars read at startup, flipped in `deploy/.env` on the VM, then `docker compose up -d miniflux`** (a restart, not a rebuild). Every option's upstream default is today's behaviour, and compose turns each one on with a `${VAR:-on}` default, so the kill is one line in `.env` | panfleto has no flag provider, and building one was out of appetite. Tested live by turning each switch off and on (DoD) |
| **D5** | **Backfill = 27 feeds, by SQL on the VM**, with the exact IDs recorded in `sprint-1.md` and a one-line reversal. It covers feeds whose 14-day p90 is under 2,000 chars, **excluding** Reddit (the VM IP is already throttled: 3 of 4 Reddit feeds are failing to poll), xkcd (the content *is* the image), and podcasts (simplecast: the page is show notes). Feeds with no entries in 14 days are left alone | Production has 0 API keys, and the feeds belong to two non-admin users (memory: feed-config rollouts go through SQL). No feed has ever had `crawler` on, so a "deliberately off" feed can't be told apart from a default one. The data-driven feed set is the answer to 1.2's clobbering question |
| **D6** | **`FORCE_CRAWLER` ORs into feed creation.** A reader turns a feed off in its settings after subscribing, and the subscribe form's checkbox is pre-ticked so it tells the truth | `FeedCreationRequest.Crawler` is a plain `bool`, so the API and onboarding can't tell "absent" from "false" |
| **D7** | **Automatic fetches only replace content that gets longer.** The Download button keeps today's rule (any non-empty result replaces) | The guard against "some feeds scrape worse than their RSS" that costs no column. The per-feed opt-out is the existing `crawler` checkbox (2.1) |
| **D8** | **The fetch-state note is hardcoded English**, like the rail beside it. "Fetching…" reuses the translated `entry.state.loading` | Miniflux's printer has no fallback: a missing key renders as the key itself, and `TestMissingTranslations` requires a new key in all 23 locale files. That would be rebase tax on 23 upstream files for one sentence |

**Review-driven deviations, decided 2026-09-15.** The fresh reviewer's findings on PR #10:
- **Fixed.** A forced refresh re-queues every rewritten entry, not only new ones. Block and keep rules re-run on
  prefetched content, and a match is marked read (upstream drops the entry, but this one is already stored).
  The unwall step paces calls 500 ms apart instead of holding a lock across the request, so the Download
  button never waits behind a worker. A feed with credentials or a cookie never reaches the fallback, so
  article-link tokens stay private. Recovery is capped at the queue size and logs one line. The chain logs
  at Debug when no fallback is configured.
- **Accepted, with the reason.** (a) **Integrations get the feed's content.** Webhooks, Wallabag and the rest
  fire when an entry is stored, before the worker fetches it. panfleto has 0 integrations configured in
  production, and moving the push would mean patching `integration/`. (b) **`FORCE_CRAWLER` applies to
  full-content feeds too**, so a short post on a full-text feed costs one direct scrape and, if still thin, one
  unwall call. D7 means the content never gets worse. The volume is inside A4's measured 47.6/h, because the
  backfill (D5) left full-content feeds off, and only feeds added after deploy take the default. (c) **A burst
  from one host can occupy both workers**, because they wait in the host gate. The delay is 2 s, and the next
  sprint's measurements decide whether it needs a per-host queue.

**Fork delta (rule 1).** New files: `internal/reader/autofetch/` and `internal/reader/prefetch/` (code +
tests). Upstream files touched for the first time: `config/options.go`, `reader/handler/handler.go`,
`reader/processor/processor.go` and `cli/daemon.go`. `entry.html`, `add_subscription.html` and `view/view.go`
are already panfleto's. All of it lands as **one new topic commit, `panfleto: article autofetch`**. This is
a genuinely new capability that belongs in none of the existing six.

**Named risk the product owner owns:** the chain stores paywalled articles fetched through a third-party
bypass service into a hosted multi-user reader. D1's direction was decided on 2026-09-14. This line
exists so the exposure is written down, not rediscovered.

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
| 2 | ~~2.3 — archive.ph as step three, rate-limit aware~~ **cut: unreachable from the VM (D1)** | — |
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
