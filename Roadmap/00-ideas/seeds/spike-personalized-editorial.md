---
title: "Can the newspaper read one reader's feeds?"
slug: spike-personalized-editorial
status: scaffolded
area: "01"
type: spike
priority: null
appetite: S
underwritten_by: null
risk: low
epic: "01-reading-experience/spike-personalized-editorial"
build_order: 11
updated: 2026-09-15
---

# Pitch — Can the newspaper read one reader's feeds?

## Problem
panfleto has two front doors and they don't know about each other. The reader at
`app.panfleto.win` is a Miniflux fork: a reader's own feeds, newest first, no algorithm. The
newspaper at `editorial-panfleto.vercel.app` is a Payload CMS site that looks like a broadsheet and
is fed — through mappings an editor configures by hand — from **one** Miniflux account (the admin's).

So a signed-in reader cannot see their own sources in newspaper form, and there is no obvious path
to giving them one. The tempting path (extend the existing importer to run per user) turns a
single-tenant newsroom CMS into a multi-tenant one and makes Payload a second system of record for
article content — which `AGENTS.md` rule 2 forbids and rule 3 makes expensive.

The product owner has picked the other path: **render the personalized edition live from Miniflux,
store nothing.** This spike exists because that path has two unpriced unknowns (page latency
without static caching; how the editorial app acts as the reader) and one unanswerable-from-a-desk
question (is a paper ranked this way actually worth reading?). Getting those wrong turns an M bet
into an L one.

## Appetite
**S** — one investigation session. It buys a written decision, not code. If the session cannot
settle all three decisions, it records what it settled and what it didn't, and the follow-on bet is
sized on that — the appetite does not grow in flight.

## Outcome & signal
After this spike, `D1`–`D3` below are written down in the epic README with evidence attached, and
the product owner can bet the build epic at a wave boundary knowing whether it is M or L.

The product owner tests it by reading the decision block: each decision names what it decided, what
evidence backed it, and what it explicitly did not decide.

## Stage-2.5 bucket
**Split — and the split is the finding.**

- The **anonymous edition is already possible today** (bucket 1). It is live, and it is fed from the
  admin account through `miniflux-mappings` that already ship. It needs a domain decision and the
  mappings kept warm — not a build.
- The **personalized edition is genuinely new** (bucket 3). Nothing in either repo reads a
  particular reader's entries under that reader's identity into the newspaper layout.

## Bill of materials (What / Why)

| What | Why |
|---|---|
| D1 — read path shape, decided | The one architecture fork. Live-render keeps Miniflux the only owner of article content (rule 2) and keeps Payload single-tenant. |
| D1b — caching strategy for a per-user page | The front page is `force-static` + `revalidate: 600`. A per-user edition can't be. Unpriced today. |
| D2 — credential boundary, decided | Decides whether this epic merges with, sequences behind, or is independent of `mcp-token-handling` (#10, HIGH). |
| D3 — ranking floor, judged on real entries | Decides M vs L for the build bet. Cheapest possible way to learn it: rank one real account and read the output. |
| A written "what we are not deciding" list | The ask arrived bundled with a domain move and an auth consolidation. Naming the exclusions is what keeps the appetite at S. |

## Scope
**In v1 (this spike):** D1, D1b, D2, D3 — each landed as a numbered decision in the epic README with
its evidence.

**Out of v1 (no-gos):**
- **The `.com.mx` domain move.** `panfleto.com.mx` currently serves a different live product (a
  Spanish-language print shop / marketplace, nav `Muro · Tienda · Colecciones`). That is a tenancy
  decision the product owner owns, not an architecture question — separate chore epic.
- **The LLM categorize-and-rank pass.** Shape it as its own bet once someone has read a few real
  editions and can say what is specifically wrong with them.
- **Auth consolidation itself.** This spike decides the *credential boundary*; it does not build
  SSO, move Auth0, or touch `oauth.env`.
- **Any change to Miniflux sorting, rules or the reader UI.** Explicitly unchanged, per the ask.
- **Payload's role beyond the anonymous edition.** No new collections, no multi-tenant access
  rewrite, no migration.
- **Writing code.** A spike ends in a decision (WAYS-OF-WORKING → the groom skill's Stage 2). Any
  throwaway probe script stays out of `main`.

## Rabbit holes
- **"Just add a `tenant` field to Articles."** This is the whole trap. It is a Payload migration
  (rule 3 territory on the Miniflux side has a direct analogue here: Payload migrations are
  append-only too), an access-rule rewrite across nine collections, and unbounded storage growth as
  users × feeds × entries. D1 exists to close this door with a reason, not a preference.
- **Measuring latency from the wrong place.** `LEARNINGS.md` already carries this rule from
  `spike-unwall-app`: probe from the production IP. Here that means a **Vercel function**, not a
  laptop and not a Claude sandbox — Vercel→Oracle-VM is the hop that matters, and it is the one
  nobody has timed. See *Open risks* below: this session could not reach the API at all.
- **Assuming the per-user key needs inventing.** It does not (see reuse list). The risk is the
  opposite: quietly shipping a *second* consumer of a credential already written down as a problem.
- **Letting D3 become a ranking-algorithm project.** The question is "is the output worth reading",
  answered by looking at one real account's front page. Not a tuning exercise.
- **The reader's entry point.** A link in the reader header is a template file inside the fork's
  27-file delta budget. Cheap, but it is fork tax (rule 1) — check it against
  `git diff --stat FETCH_HEAD...HEAD` before accepting, and keep it out of this spike.

## What already exists (reuse, don't rebuild)
The platform-first reframe found more shipped than the ask assumed:

**`editorial-panfleto`:**
- `src/lib/miniflux/client.ts` — typed Miniflux client (entries, categories, feeds), already targets
  `https://app.panfleto.win/v1`, already caps limits, already auths with `X-Auth-Token`.
- `src/lib/miniflux/html.ts` — sanitize + HTML→Lexical conversion.
- `src/lib/miniflux/importer.ts` — the ingest path. **Reference, not reuse** — D1 rules it out for
  the personalized edition; it stays the anonymous edition's pipeline.
- `src/collections/MinifluxMappings/` + `MinifluxSourceSelect` / `MinifluxSyncButton` /
  `MinifluxAdHocImport` + `/api/miniflux/cron-trigger` → `/api/miniflux/sync-feed` (QStash fan-out)
  + migration `20260711_061353_miniflux_ingestion` — the whole anonymous-edition machine, shipped.
- `src/components/Editorial/{ArticleCard,SectionHeading}.tsx`, the front-page grid in
  `src/app/(frontend)/page.tsx`, `sections/[slug]`, `articles/` — the layout the personalized
  edition renders into.
- `src/lib/trending/ranking.ts` + `redis.ts` — `views / (age+2)^1.5 × multiplier` over Upstash ZSETs.
  **Reference, not reuse:** it cold-starts permanently for a single reader.
- `src/access/roles.ts` — `admin | editor | writer`, all three staff. Confirms Payload auth is
  newsroom-only and should stay that way.

**`fluxonline`:**
- `panfleto-core/internal/ui/integration_show.go:150-173` — mints a **per-user Miniflux API key**
  named `"Panfleto MCP"` via `h.store.CreateAPIKey(user.ID, "Panfleto MCP")`, idempotent on the
  description. The credential D2 needs already exists; D2 is about how it is minted and carried.
- `landing-page/src/app/api/register/route.ts` — signup already creates the Miniflux user and its
  starter feeds from `feeds.json`.
- `deploy/oauth.env.example` — Auth0 OIDC, `OAUTH2_USER_CREATION=1`, password login as fallback.
- `deploy/Caddyfile` — two vhosts (`panfleto.win`, `app.panfleto.win`); a third is a two-line block.

## UX heuristics & rails check
- **CI guards covering this surface:** `scripts/content-write-guard.mjs` (fails on anything under
  `scripts/` writing `entries.content`) — D1's live-render answer keeps this trivially satisfied.
  `node scripts/build-order.mjs --check` for board freshness. `guards.yml`. No guard exists on the
  `editorial-panfleto` side; that repo has no `Roadmap/` and no guards workflow at all.
- **Audits-lens findings that apply:** none — `00-ideas/audits/` has no entry touching the editorial
  surface.
- **Design-language debt (if any):** two design systems that have never been reconciled — the
  reader's Miniflux templates and `editorial-panfleto`'s tokens in
  `src/app/(frontend)/globals.css`. Not this spike's problem, but the build epic inherits it the
  moment a reader crosses between them.

## Acceptance criteria
1. The epic README carries `D1`, `D1b`, `D2`, `D3`, each with a decision, the evidence behind it,
   and what it did not decide.
2. Every decision that could not be evidenced says so in one line, and names where the evidence has
   to come from — no decision is recorded as settled on reasoning alone.
3. The follow-on build bet is sized **M or L** with a one-line reason.
4. `mcp-token-handling` (#10) is marked merge / sequence-before / independent, with a reason.
5. No code merged to `main` in either repo; no production writes.

## Open risks / research
- **This session could not reach the Miniflux API.** `https://app.panfleto.win/v1` is blocked from
  both available shells — the desktop VM's egress refused the connection (HTTP 000), and the cloud
  container's proxy returned `connect_rejected` (organization policy). So D1b and D3 carry **no
  live evidence yet**, and this is exactly the `spike-unwall-app` lesson repeating: the probe has to
  run from the machine that will make the call in production. Sprint 1 names where.
- **`panfleto.com.mx` is not the newspaper** (checked 2026-09-15). The ask assumed it was. The live
  newspaper is `editorial-panfleto.vercel.app`; `panfleto.com.mx` serves an unrelated product. Every
  URL-consolidation statement in the original brief rests on this, so the domain work is deliberately
  a no-go here.
- **Two repos, one product, one roadmap.** `editorial-panfleto` is a separate GitHub repo
  (`danybgoode/editorial-panfleto`, `main`) with no `Roadmap/`, no `AGENTS.md`, no guards. The build
  epic will span both. Whether the ways-of-working scaffolding gets extended to it is a real question
  the spike should flag, not answer.
- **Fork delta is at budget, not over it** (checked 2026-09-15): `git diff --stat FETCH_HEAD...HEAD`
  reports 46 files / +2679, which reconciles exactly with `AGENTS.md` rule 1's stated 27 code and
  template files + `feeds.json` + the sync workflow + 17 branding icons. The rule's number is
  accurate. Good news for the build epic: the live-render path adds **zero** Go.
