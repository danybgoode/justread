# Click an article and the content is already there — Sprint 1: Crawler on by default

**Status:** ⬜ not started

> **Build contract (locked by the architect before the builder started)**
>
> - **This sprint is the skateboard and it ships alone.** It delivers most of the visible win with
>   none of the fallback-chain complexity. If the epic stops here it is still a real improvement.
> - **No new Go files.** This is a default change plus a config option — `AGENTS.md` rule 1.
> - **D4's kill-switch mechanism must be decided before 1.1**, because the config option added here
>   is probably it.
> - **Locked 2026-09-15:** D4 is the env-var seam (`FORCE_CRAWLER`, read at startup, killed in
>   `deploy/.env`). D6: it ORs into creation, and per-feed off happens in feed settings. **1.2's
>   clobber question is answered by D5:** no feed has ever had `crawler` on, so "deliberately off" can't
>   be told apart from the default. The backfill therefore picks the 27 teaser feeds by data (14-day
>   p90 under 2,000 chars, minus Reddit, xkcd and podcasts), runs as SQL on the VM because production
>   has no API keys, and records every ID for a one-line reversal. Story 1.2's "a script under
>   `scripts/`" becomes that recorded SQL, for the same reason.
> - **Watch the VM after 1.2.** Turning the crawler on for every existing feed makes the next poll
>   cycle scrape everything new across all of them at once. That is the first real load test.

## Stories

### Story 1.1 — New feeds crawl by default
**As a** reader, **I want** every feed I add to fetch full article content automatically, **so that**
I don't have to know what "fetch original content" means or remember to tick it.

**Acceptance:**
- A feed added through the subscribe page has original-content fetching on without the reader doing anything
- A feed created by onboarding (`internal/ui/user_onboarding.go`) has it on
- A feed added through the API has it on
- A `FORCE_CRAWLER` config option controls this, documented in `deploy/.env.example`
- Setting it off and restarting restores today's behaviour exactly — this is the kill-switch test
- A reader can still turn it **off** per-feed; the default is a default, not a lock

**Risk:** low

### Story 1.2 — Existing feeds backfilled
**As a** reader with feeds I added months ago, **I want** those to start fetching too, **so that** the
improvement isn't only for feeds I add from now on.

**Acceptance:**
- A one-time script (`scripts/`, not Go — rule 1) sets `crawler: true` across existing feeds via the API
- It is idempotent, and it does **not** clobber a feed where the reader deliberately turned it off —
  decide how that is distinguished before running, and write the answer here
- It runs against one feed first, with the diff inspected, before it loops
- Post-run: the next poll cycle is watched (`docker stats`, container log) and the observed CPU and
  duration recorded in this file
- A count of feeds changed is reported to the product owner

**Risk:** high — it writes to every feed's configuration with an admin key, and it changes load on the
production VM

## Sprint QA
- **api spec(s):** `e2e/autofetch-defaults.spec.ts` — assert a newly created feed comes back from the
  API with `crawler: true`. Cheap, and it's the regression that would silently undo this whole epic.
- **browser smoke owed:** yes, to the product owner — adding a feed through the UI and confirming an
  article arrives with full text rather than a teaser.
- **deterministic gate:** `go build ./... && go vet ./... && go test ./...` + `docker compose build miniflux` + the api spec. Local — CI does not cover `panfleto-core/`.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

1. **(auth path — owed to the product owner by name)** Sign in and go to `https://app.panfleto.win/subscribe`. Add `https://www.theverge.com/rss/index.xml`.
   → The feed is added.
2. Open the feed's settings page.
   → "Fetch original content" is already **on**, without you having ticked it.
3. Wait for one poll cycle (up to 60 min), then open a new article from that feed.
   → The full article text is there. No Download button press needed.
4. Open an article from a feed you added **before** this sprint.
   → Same: full text, already there.
5. Pick a feed, turn "fetch original content" **off** manually, and confirm it stays off after the next poll.
   → The per-feed override still wins over the default.
6. On the VM, run `docker stats` during a poll cycle.
   → CPU is elevated but the reader stays responsive; no container restart in the log.

If any step fails, note the step number + what you saw — that's the bug report.
