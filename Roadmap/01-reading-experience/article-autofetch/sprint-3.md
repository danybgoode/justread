# Click an article and the content is already there — Sprint 3: Prefetch off the poll path

**Status:** ✅ shipped 2026-09-15 · stories 3.1–3.3 in fork `fa8e46a2`, PR #10 · prefetch on 20:58 UTC · restart + kill-switch tested 21:05–21:08 UTC

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
> - **Locked 2026-09-15, A3: derived, no column.** "Fetching" is membership in the in-memory
>   queue, and "found nothing" is a bounded in-memory set. Recent thin entries in crawler feeds are
>   re-queued on boot (`PREFETCH_RECOVERY_WINDOW`), so a restart re-derives the queue instead of losing it.
> - **Polling retune, measured rather than assumed:** `POLLING_FREQUENCY: 60` × `BATCH_SIZE: 100`
>   stays, unless the S3 drain shows contention. The queue decouples the two, and 47.6 fetches/hour is
>   small next to the 1,679 entries/day the poller already ingests.
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

## Results — recorded in production, 2026-09-15

- **3.1, the poll stays fast.** The poll path no longer scrapes when `PREFETCH_WORKERS` > 0. Locally, subscribing to NYT
  Technology returned in **0.39 s**, where inline scraping would have taken about a minute. In production the inline S1
  poll had finished within one sample anyway, at 135 crawled entries. `POLLING_FREQUENCY` 60 and `BATCH_SIZE` 100 are
  **left as they are**: the drain never raised load above 0.10.
- **3.2, the bounded worker.** 2 workers, 1 request per host 2 s apart, a queue of 1,000. During the drain, Miniflux CPU
  peaked at **8.6%**, Postgres at **2.7%** and load at **0.10**. `https://app.panfleto.win/healthcheck` answered in
  **37–88 ms** throughout.
- **Restart mid-drain (21:05 UTC).** Before the restart the database held **215** thin unread entries in the window.
  Recovery re-queued **215**, with 0 skipped, and the drain resumed: 63 stored and 52 "not longer" in the next 4 minutes.
- **Kill switch (21:08 UTC).** With `FETCH_FALLBACK_CHAIN=` and `PREFETCH_WORKERS=0` set, the container read them, and
  there was no prefetcher and no unwall.app call. With the lines removed, the prefetcher restarted and re-queued 213.
- **3.3, fetch state.** It's derived from memory with no migration. Locally, a failed entry rendered "Automatic fetching
  found nothing. Try the paywall links below." next to Download, and a fetched entry showed only Download.
- **Known cost:** each restart re-queues the thin unread entries of the last 6 hours, including ones already tried (BBC),
  because the fetch state lives only in memory (A3). About 200 calls per restart, well inside unwall.app's limit.

## Sprint 3 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win` and the VM

1. On the VM: `docker compose logs miniflux | grep -E "Prefetch (started|recovered)"`.
   → `workers=2 queue_size=1000 host_delay=2s`, and a recovered count.
2. **(auth path — owed to the product owner by name)** Sign in and open Unread within a minute of a poll.
   → Some articles show **Loading…** in place of the Download button.
3. Wait a minute and reload one of them.
   → Full text, and the Download button is back.
4. Open a **BBC** article that was tried and came back empty.
   → Download, plus the note "Automatic fetching found nothing. Try the paywall links below."
5. During a drain, run `docker stats --no-stream`.
   → Miniflux in single-digit CPU, and the reader answers normally.
6. Run `docker compose restart miniflux`, then check `grep "Prefetch recovered"` in the log.
   → The recovered count matches the thin unread entries. Nothing is stuck.

If any step fails, note the step number + what you saw — that's the bug report.
