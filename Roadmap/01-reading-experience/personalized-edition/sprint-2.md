# Your own feeds, as a newspaper — Sprint 2: The per-user edition cache

**Status:** ✅ shipped 2026-09-16, merged dark: `editorial-panfleto` `8bc0cd0` (+ review fixes `b3bc8d0`), PR #12, merge `84225f4`

> **Why this sprint exists, in one number:** this reader's last 24 hours is **1,156 entries, ~9.5 MB,
> two requests, 759 ms p50** from Vercel — and `limit=100` covers only **2 h 7 min** of it. A render
> cannot fetch a day inline. See the spike's D1b.

## Build contract (locked by the architect before the builder started)
- **D5** (Upstash, `pe:v1:<env>:edition:<userId>`, gzip JSON, 48 h TTL) and **D6** (10 min fresh, SWR in
  `after()` behind an NX lock, incremental on `after_entry_id`, full rebuild past 6 h).
- **Deviation from 2.2's wording, decided:** the delta is "entries *stored* since the last build"
  (`after_entry_id`), not "*published* since" (`published_after`). Live data had 90 late arrivals in one
  day, and `published_after` would miss every one of them. The max-age fallback covers edits and
  removals, not late arrivals.
- Seam: `src/lib/personalized/edition.ts` takes its store, fetcher and clock as arguments, so the specs
  run it without network.
- Specs: two readers never share a key or an edition; a fresh view makes no fetch; a stale view returns
  immediately and its refresh requests only `after_entry_id=<newest>`.

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

## Live confirmation (2026-09-16, flag-on preview, disposable readers)
- **Built once (2.1):**
  - First connect built and rendered in 1.4–1.7 s (217 and 71 entries).
  - The stored value (`pe:v1:preview:edition:7`) was 56 KB gzipped. It holds no key and has a 48 h TTL.
- **Refresh (2.2):**
  - An edition aged to 15 minutes was served over plain HTTP in **518 ms**, showing "Actualizada hace 15 min".
  - The store then showed an incremental rebuild about 1 s later: `fullBuiltAt` stayed unchanged and `builtAt` moved to the request time.
- **Isolation (2.3):**
  - Each reader's cards came only from their own feeds.
  - An anonymous `/` fetched after both readers' views was still curated.
  - A signed-in `/` answers `private, no-cache, no-store`.
- **A trap for whoever verifies SWR next:** in a real browser the page reported "hace 0 min" even when the server
  had just sent the stale copy. Every page on this site loads its document **twice**; production's
  anonymous `/` does it too, before this epic. By the second load the refresh had already landed. Verify
  freshness over plain HTTP, not in a browser.

## Sprint 2 — Smoke walkthrough (do these in order)
Env: production · https://editorial-panfleto.vercel.app (flag on, connected)

1. Open https://editorial-panfleto.vercel.app.
   → Your edition appears as a page within a couple of seconds, saying "Actualizada hace 0 min".
2. Reload.
   → Faster, and still "hace 0 min"/"hace 1 min": it came from the stored edition.
3. Come back after more than 10 minutes and reload.
   → The page still appears at once. Reload again a few seconds later: the "Actualizada" time has reset and any new stories are in.
4. Press **Salir**, then connect with the second account's token. **(data boundary — owed to the product owner)**
   → That account's edition, not a warm copy of the first.
5. Open the same URL in a private window.
   → The curated edition. Nothing personal.

If any step fails, note the step number + what you saw — that's the bug report.
