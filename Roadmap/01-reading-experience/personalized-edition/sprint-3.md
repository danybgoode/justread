# Your own feeds, as a newspaper — Sprint 3: The edition renders behind auth

**Status:** ⬜ not started

> **Ship v1's ranking exactly as the spike ran it.** D3's verdict was *worth reading with tuning*, and
> that tuning is wave 3 (`editorial-ranking-tuning`). Pulling it forward here is how this M becomes an
> L. If the page looks wrong while building, write it down for wave 3 — don't fix it in this sprint.

## Stories

### Story 3.1 — The ranked edition renders in the newspaper layout
**As a** signed-in reader, **I want** my feeds laid out as a front page, **so that** I can see what
matters in my sources without scrolling a river.
**Acceptance:**
- The page renders through the existing Editorial components — it looks like the newspaper, not a list.
- Ranking is v1 as the spike ran it: 6-hour recency half-life × corroboration (1 + 0.5 per extra
  **publisher**) × HN comments (1 + log10(1+n)/2), at most 1 story per feed and 3 per category on the
  front, 2 per feed in each section.
- Corroboration counts **publishers, not feeds** — an account with two BBC feeds must not show BBC
  corroborating BBC (the bug the spike found and fixed).
- Each story can show which signal placed it, as in the spike's rendered edition.
**Risk:** high

### Story 3.2 — The anonymous edition is untouched
**As an** anonymous visitor, **I want** the curated front page I get today, **so that** nothing regresses
for people who haven't signed up.
**Acceptance:** signed out, the current Payload-backed edition renders exactly as before — same
content, same caching behaviour, no new latency.
**Risk:** high (shared route)

### Story 3.3 — The enablement flag, created disabled in every environment
**As the** product owner, **I want** this surface merged dark and flipped on deliberately, **so that**
a new surface handling a live credential can't go live by accident.
**Acceptance:**
- `editorial.personalized_enabled` exists in **Production, Preview and Development**, created
  **disabled** (enablement polarity — see the epic README's Stage 6b block).
- With it disabled, every visitor — signed in or not — gets the anonymous edition, and no per-user
  fetch or cache write happens at all.
- Flipping it on in one environment changes only that environment.
- It gates one server-side resolver, not three scattered checks.
**Risk:** high

## Sprint QA
- **api spec(s):** one spec asserting flag-off ⇒ anonymous edition for a signed-in session (3.3), and
  one asserting the publisher-not-feed corroboration rule on a fixture with two feeds from one
  publisher (3.1).
- **browser smoke owed:** **yes, to the product owner by name** — the rendered page is the deliverable
  and its quality is a judgement call, exactly as it was in the spike.
- **deterministic gate:** `pnpm typecheck` + `pnpm build` + Playwright `api` green before merge.
- **Merge:** HIGH tier ⇒ the product owner merges; fresh reviewer subagent mandatory.

## Sprint 3 — Smoke walkthrough (do these in order)
Env: production · https://editorial.panfleto.win

1. With the flag **disabled**, signed in, open https://editorial.panfleto.win.
   → The anonymous curated edition. Nothing personalized. This is what merging dark looks like.
2. Flip `editorial.personalized_enabled` on in Production. **(config change — owed to the product owner)**
   → Reload: the front page is now built from your feeds.
3. Read the lead stories.
   → You recognise your own sources. Stories carried by several of your publishers sit above stories
   that are merely recent.
4. Find a story you know appeared in more than one of your feeds.
   → It appears **once**, with its other publishers listed — and if you subscribe to two feeds from the
   same outlet, that outlet does not corroborate itself.
5. Open the same URL signed out, private window.
   → The curated edition, unchanged from step 1.
6. Flip the flag back off, reload.
   → Everyone is back to the anonymous edition immediately.

If any step fails, note the step number + what you saw — that's the bug report.
