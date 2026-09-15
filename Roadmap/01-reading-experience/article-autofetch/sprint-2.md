# Click an article and the content is already there — Sprint 2: The fallback chain

**Status:** ⬜ not started

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

### Story 2.3 — archive.ph as step three, rate-limit aware
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

## Sprint 2 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

1. **(auth path — owed to the product owner by name)** Sign in and open a **New York Times** article from the starter feeds.
   → Readable article text, without pressing Download.
2. Open an **FT** article.
   → Same.
3. Open an article from a feed that already delivered full content before this sprint (e.g. Daring Fireball).
   → Unchanged. No regression, and no fallback was called — confirm in the log.
4. Find an article whose link is dead or 404s.
   → The entry still shows its original feed teaser. Nothing errored, nothing blank.
5. On the VM, `docker compose logs miniflux | grep -i fallback | tail -50`.
   → You can see which step produced content for each fetch.
6. Check the recorded A4 number in this sprint file.
   → It exists, and someone has decided whether the chain stays wide or narrows.

If any step fails, note the step number + what you saw — that's the bug report.
