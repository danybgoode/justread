# Click an article and the content is already there — Sprint 2: The fallback chain

**Status:** ✅ shipped 2026-09-15 · stories 2.1 + 2.2 in fork `fa8e46a2`, PR #10 · fallback on 20:58 UTC · story 2.3 cut (archive.ph unreachable)

> **Build contract (locked by the architect before the builder started)**
>
> - **A1 must be resolved before 2.2.** Run the `spike-unwall-app` epic first. If unwall.app turns
>   out not to return fetchable article HTML, 2.2 is cut and the chain is two steps, not three —
>   that is a legitimate outcome, not a failure.
> - **One seam, not three call sites.** The chain is a single function the poll path and the manual
>   Download path both call. Today `processor.ProcessEntryWebPage` and
>   `processor.processEntry`'s crawler block both reach the scraper; they must end up reaching it
>   through the same chain, or the manual button and the automatic fetch will drift.
> - **A failed fallback must never fail the fetch.** If every step returns nothing, the entry keeps
>   its original feed content. A chain that hard-errors is worse than no chain.
> - **Never write the fallback's output anywhere but the entry's content, through Miniflux.**
>   `AGENTS.md` rule 2 — this is the same rule the archive appender broke.
> - **Locked 2026-09-15:** A1 is answered by `spike-unwall-app` (usable, server-side, a miss on
>   every failure). A2 is 2,000 text chars (`FETCH_THIN_CONTENT_THRESHOLD`). **Story 2.3 is cut:**
>   archive.ph can't be reached from the VM (DNS refused, TCP timeout on every A record), so the chain is
>   two steps. The per-feed opt-out is the existing `crawler` checkbox, and D7 means an automatic fetch
>   never replaces content with something shorter.
> - **Measure before you widen.** A4 is resolved here, with real numbers, not at the end.

## Stories

### Story 2.1 — A fallback chain behind one seam
**As a** reader, **I want** panfleto to try harder when a direct scrape comes back empty, **so that**
a teaser-only article still arrives readable.

**Acceptance:**
- One function decides the chain; both the poll path and `entry_scraper.go` call it
- Direct scrape is step one and is unchanged — no regression for feeds that already work
- "Thin" is defined by the **A2** answer (a threshold read from real data, not a guessed number), and
  the threshold is a config value, not a literal
- Every step logs which one produced the content, so a later question of "where did this come from"
  is answerable from the log
- If all steps return empty, the entry keeps its feed content and is marked as fetch-failed (see 3.3)
- A per-feed opt-out exists — some feeds scrape worse than their own RSS

**Risk:** high

### Story 2.2 — unwall.app as step two
**As a** reader, **I want** paywalled articles to come through unwall.app automatically, **so that**
the link rail becomes a fallback I rarely have to click rather than the main way I read.

**Depends on:** `spike-unwall-app` — build nothing here until its decision is written.

**Acceptance:**
- URL construction follows the exact rule the spike wrote down, including the query-string and
  non-`www` cases
- Output goes through `internal/reader/readability` unless the spike found it already clean
- A throttled or 403 response from unwall.app moves to step three; it never errors the fetch
- Results are cached per the spike's TTL recommendation, so re-opening an article doesn't re-call it
- Verified against four publishers from the real starter feeds — nytimes, ft, elpais, newyorker

**Risk:** high

### ~~Story 2.3 — archive.ph as step three, rate-limit aware~~ — CUT 2026-09-15

> **Cut, with evidence rather than appetite.** From `panfleto-prod`, the VCN resolver refuses
> `archive.ph/.is/.today/.md`, and TCP to all three public A records times out
> (`spike-unwall-app/sprint-1.md` finding 7). A step that can't connect would only add a timeout
> to every thin entry. The rate-limit-aware back-off it asked for lives on the unwall.app step
> instead, and **A4 is answered in the epic README: 47.6 eligible entries/hour against unwall's 7,200/hour.**
**As the** product owner, **I want** the last resort to back off politely, **so that** panfleto's
single VM IP doesn't get blocked and take the fallback down for everyone.

**Acceptance:**
- `archive.ph/newest/{url}` is step three, tried only when both earlier steps returned nothing
- A 429 or a block page backs off exponentially and stops trying for a cooldown window
- **A4 is answered here with a number**: how many fallback calls an hour real traffic produces, and
  what archive.ph did about it. Record it in this file
- If the number says everything-for-everyone doesn't survive, say so and narrow the chain to
  marked-paywalled feeds — that is the circuit breaker working, not a failure

**Risk:** high

## Sprint QA
- **api spec(s):** `e2e/fallback-chain.spec.ts` is the wrong shape — it would depend on third-party
  services. Instead: **pure-logic specs on the extracted seam** (`go test`) covering chain ordering,
  the thin-content threshold, the all-steps-empty case, and URL construction for each fallback. Free
  coverage on an extracted seam, and it's the part that actually breaks.
- **browser smoke owed:** yes, to the product owner — opening a known-paywalled article (NYT, FT) and
  confirming readable text arrives without pressing anything.
- **deterministic gate:** `go build` + `go vet` + `go test` (including the new chain tests) + `docker compose build`.

## Results — recorded in production, 2026-09-15

**A4, answered with production numbers.** The estimate was **47.6 fallback-eligible entries/hour** (14 days, 27 feeds)
against unwall.app's 120/minute. The restart at 20:58 UTC queued a 6-hour backlog of **327** teasers. In the first
7 minutes the drain produced **94 articles by direct scrape and 111 through unwall.app**. It had **2 misses**,
**29 "not longer"** results (D7 kept the feed's content), and **0** 429s or cooldowns. A backlog at roughly 4× steady
state never touched the limit, so **the chain stays wide**.

**Per publisher, median text after the fallback:** NYT 3,530 (direct 403s; unwall.app gets it), El País 5,833,
The Guardian 5,663, Ars 4,293, 9to5Mac 2,377, TechCrunch 2,229. **BBC stays at 132:** it refuses the VM directly
and unwall.app returns no more, so BBC readers still use the rail. FT gets only a teaser even through unwall.app
(spike finding 4).

## Sprint 2 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win` and the VM

1. **(auth path — owed to the product owner by name)** Sign in and open a **New York Times** article from the last day.
   → Readable article text, without pressing Download.
2. Open a **Guardian** or **El País** article.
   → Same.
3. Open a **Daring Fireball** article. It's a full-content feed, left out of the backfill.
   → Unchanged.
4. Open a **BBC** article.
   → Still a teaser, with the paywall rail below. Known: BBC refuses both the direct fetch and unwall.app.
5. On the VM, `docker compose logs miniflux | grep "Fetch fallback chain" | tail -20`.
   → Each line names `source=direct`, `source=unwall` or `source=none`.
6. Press **Download** on any article.
   → It completes quickly. It never waits behind the background workers: calls are paced, with no lock held across a request.

If any step fails, note the step number + what you saw — that's the bug report.
