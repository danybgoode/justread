---
title: "Your own feeds, as a newspaper"
slug: personalized-edition
status: scaffolded
area: "01"
type: feature
priority: null
appetite: M
underwritten_by: null
risk: high
epic: "01-reading-experience/personalized-edition"
build_order: 12
updated: 2026-09-15
---

# Pitch — Your own feeds, as a newspaper

## Problem
A reader signs up, gets 16 starter feeds, and reads them newest-first in the Miniflux reader. That is
the product's promise and it works. What it isn't is a *publication* — there is no view that says
"here is what matters in your sources today," and readers who want that have to go build their own
sense of it by scrolling.

The newspaper layout already exists and is live, but it shows one curated edition assembled from the
admin's account. Every reader sees the same page, and none of them see their own feeds.

`spike-personalized-editorial` settled how to close that gap. This epic is wave 2 of the three it
sized: the reader is recognised at the editorial app, their day is cached, and their edition renders.

## Appetite
**M** — one wave: an architect session to lock the session and cache contracts, builder fan-out
across three sprints, review rounds. If the cross-subdomain session eats the wave, that is the
circuit breaker: stop and go back to shaping rather than extending in flight.

## Outcome & signal
A signed-in reader opens `editorial.panfleto.win` and sees a front page built from **their** feeds —
recognisably theirs, not a generic river — and the same page anonymous visitors get is unchanged.

The product owner tests it by: signing in, opening the editorial URL, and recognising their own
sources in the lead stories; then opening it signed-out and getting the generic edition.

## Stage-2.5 bucket
**Genuinely new.** The spike checked the alternatives: the existing ingestion pipeline is
single-tenant and editor-curated (D1), and the view-based ranker cold-starts per reader (D3). There
is no configuration or copy change that produces this.

## Bill of materials (What / Why)

| What | Why |
|---|---|
| A reader session at `editorial.panfleto.win` | Miniflux's cookie is host-scoped to `app.panfleto.win`. Without this there is no "their" in "their feeds". HIGH risk — it's auth. |
| Server-side lookup of the reader's Miniflux API key | D2: the credential exists already (`CreateAPIKey(user.ID, "Panfleto MCP")`). It must never reach the browser. |
| A per-user derived cache of the last 24 h, keyed on reader + newest entry ID | D1b: a day is 1,156 entries / 9.5 MB / two requests / 759 ms p50. A render cannot do that inline. |
| Incremental refresh via `published_after` + stale-while-revalidate | Keeps the steady-state cost to the delta, not the day. |
| The v1 ranker (recency half-life × corroboration × HN comments, with per-feed and per-category quotas) | Already written and run against real data in the spike. Port it, don't redesign it. |
| `/editorial` rendering through the existing Editorial components | The layout is shipped. This is a new data source for it, not a new design. |
| An enablement flag, created disabled | New surface, live credential, cross-subdomain auth. Dark-launch it and flip it deliberately. |

## Scope
**In v1:**
- Reader session at the editorial app, resolved against the same Auth0 tenant.
- The edition for the signed-in reader: last 24 h, ranked v1, per-feed and per-category quotas.
- Anonymous visitors keep the current curated edition, untouched.
- The flag, created disabled in every environment.

**Out of v1 (no-gos):**
- **Ranking tuning.** D3's verdict is *worth reading with tuning*, and that tuning is wave 3
  (`editorial-ranking-tuning`). This wave ships v1's ranking **as the spike ran it**. Pulling tuning
  forward is how an M becomes an L.
- **The LLM ranking pass.** Unbet, in the funnel.
- **The `.com.mx` domain move.** Still a separate chore; `panfleto.com.mx` still serves another product.
- **A link in the Miniflux reader UI.** That is fork delta (rule 1) and belongs to its own small story
  once this surface exists and is worth linking to.
- **Sections, search, archive, or permalinks on the personalized side.** Front page only.
- **Any Payload write, collection, or migration.** D1.

## Rabbit holes
- **The cross-subdomain session is the wave's real risk.** It is the one thing here that can eat the
  whole appetite. Lock the contract in the architect pass — before any builder starts — and if it
  isn't locked in that session, stop and re-shape rather than letting a builder invent it.
- **The key must never reach the browser.** It is a long-lived Miniflux credential with full account
  access. Server components and route handlers only; never a `NEXT_PUBLIC_` anything, never a client
  fetch, never in a URL (that is literally #10's complaint).
- **Deploying a preview against the production database.** `editorial-panfleto`'s build command is
  `pnpm payload migrate && pnpm build` and its Preview environment shares production's `DATABASE_URL`.
  A normal preview deploy runs CMS migrations against the live newsroom DB. The spike documented the
  safe shape; read its D1b "how it was measured" note before deploying anything.
- **Cache invalidation on a moving feed.** Keying on the newest entry ID seen is what the spike
  decided; the trap is a feed backfilling older entries, which doesn't move that key. Decide the
  fallback (a max age) in the architect pass.
- **Two repos, two deploy rails.** `fluxonline` deploys by a human running `update.sh` on the VM;
  `editorial-panfleto` deploys on push to Vercel. If a story spans both, the VM side merges first and
  the Vercel side degrades gracefully until it catches up (`LEARNINGS.md` → parallel agents + async
  deploys).

## What already exists (reuse, don't rebuild)
- `editorial-panfleto/src/lib/miniflux/client.ts` — typed client; needs a per-call key instead of the
  module-level env read, which is a small, contained change.
- `editorial-panfleto/src/lib/miniflux/html.ts` — sanitize + Lexical.
- `editorial-panfleto/src/components/Editorial/{ArticleCard,SectionHeading}.tsx` + the front-page grid
  in `src/app/(frontend)/page.tsx` — the layout.
- `editorial-panfleto/src/lib/trending/redis.ts` — an **Upstash client already wired**, which is the
  obvious home for the per-user cache (D1b left the location open; this is the candidate to evaluate
  first).
- `fluxonline/panfleto-core/internal/ui/integration_show.go:150-173` — the per-user key, minted and
  idempotent.
- `fluxonline/deploy/oauth.env.example` — the Auth0 tenant both surfaces would share.
- `fluxonline/deploy/Caddyfile` — a third vhost is a two-line block (only needed if editorial moves
  behind Caddy rather than staying on Vercel; decide in the architect pass).
- The spike's ranking implementation and its rendered edition —
  `Roadmap/01-reading-experience/spike-personalized-editorial/README.md` → D3.

## UX heuristics & rails check
- **CI guards covering this surface:** `scripts/content-write-guard.mjs` (satisfied trivially — no
  write path), `node scripts/build-order.mjs --check`, `guards.yml`. **`editorial-panfleto` has no
  guards workflow, no `AGENTS.md` and no `Roadmap/`** — this epic is the first real cross-repo work,
  so whether that repo adopts the ways-of-working scaffolding is a live question for the architect pass.
- **Audits-lens findings that apply:** none in `00-ideas/audits/`.
- **Design-language debt:** the reader's Miniflux templates and `editorial-panfleto`'s tokens in
  `globals.css` have never been reconciled. A reader crossing between the two surfaces will see it.
  Not this epic's job to fix, but it is this epic that first makes a reader cross.

## Kill-switch / runtime gate (risk:high — Stage 6b)
**Decision: yes, and it is an *enablement* flag, not a kill-switch.**

- **Flag:** `editorial.personalized_enabled`
- **Polarity:** **enablement** — default **`false`**, created **DISABLED in every environment**, flipped
  on deliberately once the surface is verified with a real account. This is a new surface handling a
  live credential; merging it dark is the right shape, and nothing regresses if it never flips.
- **Seam:** one server-side resolver in front of the `/editorial` route. Off ⇒ every visitor, signed in
  or not, gets the current anonymous edition. That single seam covers the page, the cache warm path and
  the session lookup.
- **Mechanism — and this is a real gap:** `editorial-panfleto` has **no flag provider configured**. The
  honest v1 mechanism is a server-side environment variable on Vercel, read in the resolver (never
  `NEXT_PUBLIC_`). It must be *created disabled in Production, Preview and Development* as part of the
  flag story — a flag that exists only in code is not a flag. If the architect pass decides a real
  provider is warranted, that is a scope change to raise, not to absorb.

## Acceptance criteria
1. Signed in, `editorial.panfleto.win` shows a front page whose lead stories come from the reader's own
   feeds; the reader recognises their sources.
2. Signed out, the same URL shows the current curated edition, unchanged.
3. The reader's Miniflux key never appears in any client bundle, URL, log line or browser-visible
   payload.
4. A second reader with different feeds gets a visibly different front page.
5. With the flag disabled, everyone gets the anonymous edition and nothing else changes.
6. No Payload collection, migration or write is added.
7. Steady-state page render does not make a blocking `limit≥500` call to Miniflux.

## Open risks / research
- **Sequencing: this epic must not start before `mcp-token-handling` (#10) lands** — D2. #10 is
  scaffolded, appetite S, HIGH, and fixes the implicit minting and query-string transport of the exact
  credential this epic consumes.
- **`ci-build-pipeline` should still go first regardless.** An L programme that adds Vercel↔VM coupling
  should not ride on a deploy path that compiles Go on the production host.
- **What this displaces:** `onboarding-provisioning-reliability` (LOW, S) in the next wave — not
  `ci-build-pipeline`.
- **Cache location and refresh trigger are open** (D1b left both). Upstash is the first candidate to
  evaluate because it is already a dependency.
- **`/v1/entries` has no field selection**, so 73% of every fetch is article text the ranker never
  reads. An upstream ask to `miniflux/v2` is the rule-1-preferred path; a fork patch is not.
