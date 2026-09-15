# Your own feeds, as a newspaper — Sprint 2: The per-user edition cache

**Status:** ⬜ not started

> **Why this sprint exists, in one number:** this reader's last 24 hours is **1,156 entries, ~9.5 MB,
> two requests, 759 ms p50** from Vercel — and `limit=100` covers only **2 h 7 min** of it. A render
> cannot fetch a day inline. See the spike's D1b.

## Stories

### Story 2.1 — A reader's day is built once and reused
**As a** reader, **I want** my edition to load quickly, **so that** the newspaper feels like a page and
not a fetch.
**Acceptance:**
- The first build for a reader collects their last 24 h across the required requests and stores the
  ranked result under a key scoped to that reader.
- Subsequent views inside the freshness window serve from that store and make **no** blocking
  `limit≥500` call to Miniflux.
- The stored value is derived only — deleting it entirely costs nothing but a rebuild.
**Risk:** high (new shared infra)

### Story 2.2 — The edition refreshes incrementally
**As a** reader, **I want** new stories to appear without the page being rebuilt from scratch,
**so that** the edition stays current cheaply.
**Acceptance:**
- A refresh fetches only entries published since the last build (`published_after`), not the whole day.
- A stale edition is served immediately while the refresh runs behind it.
- A feed that backfills **older** entries — which does not move the newest-entry-ID key — is still
  picked up within the max-age fallback the architect pass set.
**Risk:** high

### Story 2.3 — One reader's edition can never be served to another
**As a** reader, **I want** certainty that my edition is mine, **so that** a cache bug can't leak my
reading.
**Acceptance:**
- The cache key includes the reader identity; a spec proves two readers never collide.
- Signing out and back in as a different reader serves the second reader's edition, not a warm copy of
  the first.
- Anonymous visitors are never served any per-user edition.
**Risk:** high (data boundary)

## Sprint QA
- **api spec(s):** one spec for key isolation between two readers (2.3), one for the incremental
  refresh fetching only the delta (2.2).
- **browser smoke owed:** no — this sprint is observable at the API level.
- **deterministic gate:** `pnpm typecheck` + `pnpm build` + Playwright `api` green before merge.
- **Merge:** HIGH tier ⇒ the product owner merges; fresh reviewer subagent mandatory.

## Sprint 2 — Smoke walkthrough (do these in order)
Env: production · https://editorial.panfleto.win

1. Signed in, open https://editorial.panfleto.win and note how long the page takes.
   → It loads as a page, not a spinner.
2. Reload it.
   → The second load is visibly faster than the first — it came from the cache.
3. Wait for the freshness window to pass, then reload.
   → The page still appears immediately, and newer stories have appeared (served stale, refreshed behind).
4. Sign out, sign in as the second test reader, open the same URL. **(data boundary — owed to the
   product owner)**
   → You see **that** reader's edition. Not a warm copy of the first reader's.
5. Open the same URL signed out, in a private window.
   → The anonymous curated edition. No personalized content at all.

If any step fails, note the step number + what you saw — that's the bug report.
