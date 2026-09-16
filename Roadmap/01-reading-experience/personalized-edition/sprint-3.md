# Your own feeds, as a newspaper — Sprint 3: The edition renders behind auth

**Status:** ✅ shipped 2026-09-16, merged dark: `editorial-panfleto` `d20f914` (+ review fixes `b3bc8d0`), PR #12, merge `84225f4`, production deployment `o3j9jzobf`. Flag `EDITORIAL_PERSONALIZED_ENABLED` = `false` in all three environments

> **Ship v1's ranking exactly as the spike ran it.** D3's verdict was *worth reading with tuning*, and
> that tuning is wave 3 (`editorial-ranking-tuning`). Pulling it forward here is how this M becomes an
> L. If the page looks wrong while building, write it down for wave 3 — don't fix it in this sprint.

## Build contract (locked by the architect before the builder started)
- **D8** ranking port, **D9** surface, **D7** flag + resolver. The flag is `EDITORIAL_PERSONALIZED_ENABLED`,
  a Vercel env var, `false` in Production, Preview and Development.
- 3.2 is held by construction: `src/app/(frontend)/page.tsx` is not edited, and the proxy never runs for
  a request without the session cookie.
- Specs: publisher-not-feed corroboration on a two-BBC-feeds fixture; quotas; flag off ⇒ a valid session
  resolves to `null` and the edition loader makes no fetch and no store write.

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

## Live confirmation (2026-09-16)
**Production, flag off, after the deploy:**
- `/` was still a cache `HIT` and showed **the same 23 curated headlines as the snapshot taken just before the merge**, with no personal text.
- `/tu-edicion` answered `307 → /`, and `/tu-edicion/conectar` answered 404.
- A forged cookie and a real preview-sealed cookie both got the curated page.
- `/admin` login rendered.

**Flag-on preview:**
- **Edition renders (3.1):**
  - Reader A: 26 cards from 11 feeds. Reader B: 6 cards (the quotas at work on 3 feeds).
  - Every card says why it's there ("reciente", "N medios: …", "N comentarios en HN").
  - Reader B's two BBC feeds shared 4 stories that day. Each showed once, BBC never corroborated BBC, and an HN item linking a BBC article correctly read "2 medios: BBC, ycombinator.com".
  - Ranking parity with the spike: exact on its saved day (1,067 stories, 13 clusters, identical front and sections).
- **Flag-off preview (3.3):** a valid session got the curated `/`.

## Sprint 3 — Smoke walkthrough (do these in order)
Env: production · https://editorial-panfleto.vercel.app

1. With the flag **off** (as shipped), open https://editorial-panfleto.vercel.app, signed in or not.
   → The curated edition. https://editorial-panfleto.vercel.app/tu-edicion/conectar is a 404. This is what merging dark looks like.
2. In Vercel → editorial-panfleto → Settings → Environment Variables, set `EDITORIAL_PERSONALIZED_ENABLED` to `true` for **Production only**, then **redeploy** production (an env change reaches only a new deployment). **(config change — owed to the product owner)**
   → https://editorial-panfleto.vercel.app/tu-edicion/conectar now shows the connect form. Connect (Sprint 1, step 2); `/` is now built from your feeds.
3. Read the lead stories.
   → You recognise your own sources. Stories several of your publishers ran sit above ones that are merely recent. Each card says why it's there.
4. Find a story you know ran in more than one of your feeds.
   → It appears **once**, with its publishers listed. Two feeds from the same outlet don't count as two.
5. Open https://editorial-panfleto.vercel.app in a private window.
   → The curated edition, unchanged from step 1.
6. Set the flag back to `false` and redeploy.
   → Everyone gets the curated edition again, and connected readers' sessions go dormant. Turning it back on revives them until they expire (30 days).

If any step fails, note the step number + what you saw — that's the bug report.
