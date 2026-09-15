# Click an article and the content is already there — Sprint 3: Prefetch off the poll path

**Status:** ⬜ not started

> **Build contract (locked by the architect before the builder started)**
>
> - **This sprint exists because of the VM, not because of elegance.** Scraping inside the poll cycle
>   means `POLLING_FREQUENCY: 60` × `BATCH_SIZE: 100` × a three-step chain, on 2 OCPU shared with a
>   Postgres holding 3 GB of `shared_buffers`. S3 moves that work off the poll path.
> - **A3 is the decision that gates 3.3.** If `fetch_status` can be derived at read time, derive it.
>   If it needs a column, that is a **migration** — `AGENTS.md` rule 3, HIGH tier, **escalate and stop**.
>   Do not write a migration to make a UI state nicer.
> - **Retune `POLLING_FREQUENCY` and `BATCH_SIZE` with this sprint, not after.** The prefetcher and
>   the poller compete for the same two cores; tuning one without the other just moves the contention.
> - **Per-host concurrency is 1.** Not a performance choice — it is what keeps panfleto from looking
>   like a scraper to the sites it depends on.

## Stories

### Story 3.1 — The poller enqueues instead of scraping
**As the** product owner, **I want** the feed poll to stay fast, **so that** turning on autofetch
everywhere doesn't make the reader sluggish or trip a rate limit in one burst.

**Acceptance:**
- The poll path identifies thin entries and enqueues them; it no longer calls the chain inline
- A poll cycle's wall-clock duration returns to roughly its pre-S1 value — measure both, record here
- The queue is bounded; when full, entries are skipped rather than the poll blocking
- Nothing is lost silently: a skipped entry is still fetchable by pressing Download

**Risk:** high

### Story 3.2 — A bounded worker with per-host politeness
**As a** site panfleto scrapes, **I want** requests spaced out, **so that** panfleto doesn't get
blocked and the feature doesn't destroy itself.

**Acceptance:**
- A bounded worker pool drains the queue, with **per-host concurrency of 1** and a configurable delay
- Pool size and delay are config, not literals
- The worker survives a restart without losing the queue, or re-derives it on boot from thin entries
- `docker stats` during a full drain shows the reader staying responsive
- Per-host request rate is verifiable from the log

**Risk:** high

### Story 3.3 — The reader can see fetch state
**As a** reader, **I want** to know whether content is on its way or won't be coming, **so that** I'm
not staring at a teaser wondering if it's broken.

**Blocked on A3.** Derive the state if at all possible.

**Acceptance:**
- An entry being fetched shows "fetching…" in place of the Download button
- An entry whose chain came back empty shows the Download button plus a quiet note that automatic
  fetching didn't find anything — so the reader knows to use the paywall rail
- An entry with content shows neither
- **No migration was added.** If one was unavoidable, this story was escalated and approved first,
  and the epic README records why

**Risk:** low (the UI) — **high** if A3 forced a migration, in which case stop and escalate

## Sprint QA
- **api spec(s):** pure-logic `go test` on the queue and the worker — bounded-queue behaviour,
  per-host serialisation, restart recovery. These are the parts that fail in production and never in
  a manual test.
- **browser smoke owed:** yes, to the product owner — seeing "fetching…" appear and then resolve on a
  freshly polled article, which an API call can't observe.
- **deterministic gate:** `go build` + `go vet` + `go test` + `docker compose build`.

## Sprint 3 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

1. On the VM, time a full poll cycle from the container log.
   → It is back to roughly its pre-autofetch duration.
2. **(auth path — owed to the product owner by name)** Sign in and open Unread immediately after a poll.
   → Some articles show "fetching…" rather than a Download button.
3. Wait a minute and reload.
   → Those articles now have full text.
4. Find an article whose fetch failed (check the log for an all-steps-empty entry) and open it.
   → It shows the Download button and a note that automatic fetching found nothing, plus the paywall rail.
5. Run `docker stats` on the VM during a drain.
   → The reader answers requests normally throughout; Postgres is not being starved.
6. Restart the miniflux container mid-drain, then check the log.
   → The queue recovers; no entries are permanently stuck.

If any step fails, note the step number + what you saw — that's the bug report.
