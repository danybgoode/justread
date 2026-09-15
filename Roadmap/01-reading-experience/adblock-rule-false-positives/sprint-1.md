# The ad-block rule is silently dropping real articles — Sprint 1: Anchor the rule and measure the loss

**Status:** ⬜ not started

> **Build contract (locked by the architect before the builder started)**
>
> - **No Go, no fork delta.** Script plus API only (`AGENTS.md` rule 1).
> - **Applying the rule writes to every feed's configuration** with an admin API key. Run against one
>   feed and diff the result before looping — D3.
> - **`enhance_miniflux.js` has no tests today**, and a pattern like this one is precisely what a
>   table test catches. Adding tests is part of the story, not a nice-to-have.
> - **Block rules are not retroactive.** Fixing the pattern does not resurrect anything already
>   filtered — those entries were never stored. D2 decides how the loss gets measured.
> - **Leave the categorisation half of the script alone.** Different concern, different day.

## Stories

### Story 1.1 — A pattern that means what it says
**As a** reader, **I want** the ad filter to block ads and not news, **so that** I stop losing
articles I never knew existed.

**Acceptance:**
- The pattern is D1's: word-boundaried, ambiguous stems gone, Spanish terms in
- A `node --test` file asserts **both directions**:
  - blocked: "Sponsored: the best laptops of 2026", "Contenido patrocinado por…", "Advertisement"
  - **not** blocked: "Party leadership contest narrows to two", "The 2027 roadmap", "Broadcast rights sold", "Ahead of the vote", "The dealer said no", "Wholesale prices fall"
- A comment in `scripts/enhance_miniflux.js` explains **why** the stems are gone, so nobody
  "helpfully" shortens them again
- `node --test scripts/*.test.mjs` passes and runs in `guards.yml` (the `scripts/**` path already triggers it)

**Risk:** low

### Story 1.2 — Applied everywhere, measured honestly
**As the** product owner, **I want** to know how much was being lost, **so that** I can judge whether
the filter is worth having at all.

**Acceptance:**
- D3 answered: no hand-tuned feed rule was clobbered, or the ones that were are listed here
- The script runs against **one** feed first; the diff is inspected before the loop
- Every feed carries the new rule; a count of feeds updated is reported
- D2's measurement is performed and **a number is written into this file** — how many entries the old
  rule would have blocked that the new one doesn't
- The script is idempotent: running it twice changes nothing the second time

**Risk:** low

## Sprint QA
- **api spec(s):** none against the deployed reader — the behaviour lives in Miniflux's filter
  engine, which isn't changing. The real gate is the `node --test` table in 1.1.
- **browser smoke owed:** yes, to the product owner — confirming a previously-blocked headline shape
  now appears in Unread.
- **deterministic gate:** `node --test scripts/*.test.mjs scripts/lib/*.test.mjs`. No Go, no Docker
  build needed for this sprint.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

1. **(auth path — owed to the product owner by name)** Sign in and open a feed's settings page (e.g. BBC News).
   → The "Block rule" field shows the new word-boundaried pattern, not the old stem list.
2. Check a second feed.
   → Same pattern. It was applied everywhere, not just to one.
3. Wait for a poll cycle, then scan Unread for headlines containing "leader", "roadmap", "ahead" or "deal".
   → They are there. Before this sprint they would have been silently dropped.
4. Scan Unread for anything titled "Sponsored" or "Contenido patrocinado".
   → Still blocked.
5. Read the measurement note in story 1.2 of this file.
   → A real number is recorded, and the product owner has seen it.
6. Re-run `node scripts/enhance_miniflux.js`.
   → It reports zero feeds changed. Idempotent.

If any step fails, note the step number + what you saw — that's the bug report.
