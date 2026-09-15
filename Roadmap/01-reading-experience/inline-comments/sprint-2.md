# Read the comments without leaving the reader — Sprint 2: Reddit, and a cache that survives

**Status:** ⬜ not started

> **Build contract (locked by the architect before the builder started)**
>
> - **D1 must be decided before this sprint starts.** Migration, in-process cache, or side schema.
>   If the answer is "a migration", this sprint is **escalated to the product owner and does not
>   start** until they have approved it — `AGENTS.md` rule 3.
> - **Reddit needs a real User-Agent** and will throttle a single VM IP hard. The cache is the
>   feature working, not a nice-to-have.
> - **Two adapters, then stop** (D4). Do not add Lobsters "while we're here" — it is three lines of
>   scope that turns into a review round.
> - **Everything from S1's contract still holds**, especially the sanitizer.

## Stories

### Story 2.1 — A cache that survives the decision
**As the** product owner, **I want** comment threads cached, **so that** re-opening an article doesn't
re-hit a rate-limited API and the feature doesn't take itself down.

**Acceptance:**
- The D1 mechanism is implemented as decided, and the epic README records which and why
- A second open of the same article within the TTL makes **no** outbound request — verify in the log
- A stale entry refetches
- If D1 was "in-process", a container restart is a cache miss and that is documented, not a surprise
- If D1 was "migration", the migration was approved by the product owner first and the approval is
  recorded in the epic README

**Risk:** high

### Story 2.2 — Reddit threads, rate-limit aware
**As a** reader of the Reddit feeds, **I want** those threads inline too, **so that** the four
Reddit-adjacent categories in the starter set stop sending me out to a browser tab.

**Acceptance:**
- A Reddit permalink is recognised and fetched as `{permalink}.json`
- A descriptive User-Agent identifying panfleto is sent — not a default Go one
- A 429 backs off and serves whatever is cached rather than erroring
- Comments render to the D2 depth with the same sanitizer pass as HN
- Verified against at least two different subreddits from the starter feeds
- The per-hour outbound request count under real traffic is measured and recorded here

**Risk:** high

## Sprint QA
- **api spec(s):** pure-logic `go test` on permalink recognition, the back-off state machine, and
  cache hit/miss/expiry. These are the parts that break in production and never in a manual test.
- **browser smoke owed:** yes, to the product owner — expanding a Reddit thread, and confirming a
  second open is instant (a cache hit is visible as speed).
- **deterministic gate:** `go build` + `go vet` + `go test` + `docker compose build`.

## Sprint 2 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

1. **(auth path — owed to the product owner by name)** Sign in and open an article from a **Reddit** feed.
   → The comments section is there and expands into the thread.
2. Reload the page and expand again.
   → It appears noticeably faster, and the VM log shows **no** outbound Reddit request. That's the cache.
3. Open a **Hacker News** article and expand.
   → Still works exactly as it did after Sprint 1. No regression.
4. On the VM: `docker compose logs miniflux | grep -ic reddit` over an hour of normal use.
   → The count matches the number recorded in story 2.2, not a multiple of it.
5. If D1 was a migration: check `app.panfleto.win` came back up after the deploy and the migration line is in the log with no error.
   → Clean start. **If this step exists at all, the product owner approved it beforehand.**
6. Open an article from a feed with no comments.
   → Still nothing. Unchanged.

If any step fails, note the step number + what you saw — that's the bug report.
