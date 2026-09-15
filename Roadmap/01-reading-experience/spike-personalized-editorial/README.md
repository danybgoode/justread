---
status: shipped   # AUTHORITATIVE epic status (SSOT) — scaffolded | in-progress | shipped | archived. Set shipped at epic close.
slug: spike-personalized-editorial
build_order: 11
---

# Epic: Can the newspaper read one reader's feeds? ✅

> **Area:** 01-reading-experience · **Risk:** low · **Class:** Spike · **Scope seed:** [`00-ideas/seeds/spike-personalized-editorial.md`](../../00-ideas/seeds/spike-personalized-editorial.md)

## Why
A reader who signs up gets their feeds in the Miniflux reader and nothing else. The newspaper — the
thing that makes panfleto look like a publication rather than a feed list — is fed from one admin
account and is the same for everybody. This spike settles whether a **personalized edition**, built
live from each reader's own sources and rendered in the newspaper layout, is an M bet or an L one,
so the product owner can bet it at a wave boundary instead of discovering its size mid-build.

It is an investigation. It ends in decisions, not code.

## Platform-first note
Miniflux is the system of record for feeds, entries and article content, and `AGENTS.md` rule 2 says
nothing outside it writes `entries.content`. Payload is the system of record for *edited* articles —
the anonymous edition's curated newsroom output. The personalized edition belongs to neither: it is
a **view** over Miniflux, owned by the reader, never edited. D1 below is the decision that keeps it
that way.

## What already exists (reuse, don't rebuild)
- `editorial-panfleto/src/lib/miniflux/client.ts` — typed Miniflux client, already pointed at
  `app.panfleto.win/v1`, already `X-Auth-Token`-based.
- `editorial-panfleto/src/lib/miniflux/html.ts` — sanitize + HTML→Lexical.
- `editorial-panfleto/src/components/Editorial/*`, `src/app/(frontend)/page.tsx`,
  `sections/[slug]`, `articles/` — the layout to render into.
- `editorial-panfleto/src/collections/MinifluxMappings/` + `/api/miniflux/{cron-trigger,sync-feed}`
  + `MinifluxSourceSelect|SyncButton|AdHocImport` — the **anonymous** edition's pipeline, shipped.
  Reference only for the personalized path.
- `editorial-panfleto/src/lib/trending/{ranking,redis}.ts` — view-based trending. Reference only:
  it cold-starts permanently for one reader.
- `fluxonline/panfleto-core/internal/ui/integration_show.go:150-173` — per-user Miniflux API key
  (`CreateAPIKey(user.ID, "Panfleto MCP")`), idempotent by description.
- `fluxonline/landing-page/src/app/api/register/route.ts` — signup already provisions the Miniflux
  user + starter feeds.
- `fluxonline/deploy/Caddyfile` — a third vhost is a two-line block.

## Decisions (the spike's output)

> **Convention:** a decision is only `LOCKED` when evidence backs it. `PENDING` means the reasoning
> is written but the evidence is owed, and the line names where it comes from. Nothing here is
> settled on reasoning alone — that is the rule this block exists to enforce.

### D1 — The personalized edition renders live from Miniflux and stores nothing. **LOCKED**
**Decided:** `/editorial` (authenticated) fetches the signed-in reader's entries from the Miniflux
REST API at request time and renders them through the existing Editorial components. It performs
**zero Payload writes**. Payload remains the system of record for the anonymous edition only, and
stays single-tenant.

**Evidence (read, not assumed):**
- `src/lib/miniflux/importer.ts` writes Articles keyed on `meta.minifluxId` with a single global
  `MINIFLUX_API_KEY`. Making it per-user means a tenant discriminator on `articles` plus an access
  rewrite across the nine collections in `src/collections/` — `src/access/roles.ts` grants on
  `admin | editor | writer` alone, with no reader concept anywhere.
- Storage under ingest grows as users × feeds × entries, and every imported Article lands
  `_status: 'draft'` / `editorialStatus: 'draft'` — nobody publishes them, so the personalized
  edition would render nothing without *also* changing the access rules that protect the newsroom.
- Live-render adds **zero** Go: it is TypeScript against a REST API, so `AGENTS.md` rule 1's
  27-file fork-delta budget is untouched. Confirmed at 46 files / +2679 vs upstream on 2026-09-15,
  which reconciles exactly with the budget as stated.
- Rule 2 is satisfied by construction — there is no write path to reach `entries.content` with.

**Not decided here:** how the page is cached (D1b — which sharpens "stores nothing" to "stores
nothing durable": the measured cost of a day of entries requires a disposable per-user cache), and whether the anonymous edition eventually
moves to the same renderer. The anonymous edition stays on Payload for now — it is curated, and
curation is what Payload is for.

### D2 — The editorial app acts as the reader with the per-user Miniflux API key, and this epic sequences **behind** `mcp-token-handling`. **LOCKED**
**Decided:** no new auth primitive. The credential is the per-user Miniflux API key that
`integration_show.go` already mints. Payload auth stays staff-only (`admin | editor | writer`) and
grows no reader role. Miniflux remains the account system; Auth0 remains the IdP.

**Evidence:**
- `integration_show.go:150-173` mints `CreateAPIKey(user.ID, "Panfleto MCP")` and reuses it by
  description — a per-user, long-lived Miniflux credential exists today.
- `src/access/roles.ts` + `src/collections/Users/index.ts`: every Payload role is newsroom staff,
  `canAccessAdmin` gates all three, first-user-becomes-admin, invite emails are editorial. A reader
  role here would put reader identity inside a CMS whose access rules assume staff.
- `deploy/oauth.env.example`: Auth0 OIDC with `OAUTH2_USER_CREATION=1` — the IdP is already the
  thing that can span surfaces.

**The sequencing call:** that same key is minted **implicitly on Settings page view** and travels in
a **query string** — which is precisely what seed `mcp-token-handling` (#10, HIGH, scaffolded)
exists to fix. Building the personalized edition on it first ships a second consumer of a credential
already written down as a defect, and doubles the migration when it is fixed. **So: #10 lands
first, or the two are bet as one wave.** The build epic must not start before that is decided.

**Not decided here:** the session mechanics (how a reader signed in at `app.panfleto.win` is
recognized at `editorial.panfleto.win`) — that is the build epic's first architecture task, and it
is cross-subdomain, so it is HIGH tier.

### D1b — The edition is a per-user derived cache, built from a day of entries, never rendered from a live `limit=100` call. **LOCKED**
**Decided:** a render must not call Miniflux inline for the page's content. The edition is built
from the reader's **last 24 hours** of entries, ranked, and held in a **disposable per-user cache**
keyed on the reader and the newest entry ID it has seen. It is refreshed incrementally
(`published_after` = last build time) and served stale-while-revalidate. The cache is derived and
throwaway: Miniflux stays the system of record, and D1's "zero Payload writes" still holds. D1's
"stores nothing" is sharpened to mean **nothing durable**. A cache you can lose without losing
anything is allowed, and the numbers below require one.

**Evidence — measured 2026-09-15 from a Vercel function in `iad1`**, the region
editorial-panfleto's production functions run in, against `app.panfleto.win/v1/entries` with one
real reader's key (user 2: 39 feeds, 23,201 entries). 40 samples per cell (4 invocations × 10
sequential requests), all 200:

| Entries | p50 | p95 | max | time to headers, p50 | payload |
|---|---|---|---|---|---|
| 25 | 191 ms | 296 ms | 408 ms | 185 ms | 0.20 MB |
| 50 | 208 ms | 309 ms | 358 ms | 191 ms | 0.47 MB |
| 100 | 252 ms | 381 ms | 390 ms | 208 ms | 1.05 MB |
| 500 | 569 ms | — | 827 ms | 335 ms | 5.4 MB (15 samples) |
| 1000 | 759 ms | — | 806 ms | 403 ms | 8.2 MB (15 samples) |

(`status=unread` and all statuses matched within 10 ms at every size, so the table shows `unread`,
the probe as written.)

What the outliers say, which the medians don't:
- **Every p95 is a first request.** The first call in each invocation took 294–408 ms and warm calls
  took 190–275 ms. The tail comes from a new TCP+TLS handshake from Virginia to Querétaro (+100–190 ms),
  not from payload size. A cold function instance pays that on every page view.
- **The Vercel hop is not the main cost; Miniflux is.** The same call from a laptop in Mexico, over a
  fresh connection (12 ms TCP, about 30 ms TCP+TLS), still waited 167–213 ms for the first byte. So
  about 135–180 ms is Miniflux's own query, and `iad1` adds about 50 ms on a warm connection. Moving
  the function region won't fix the latency.
- **`limit=100` covers 2 hours 7 minutes of this reader's day.** The newest 100 entries ran from 13:54
  to 16:01. The last 24 h held **1,156 entries** and 48 h held 2,399. A daily front page built on
  `limit=100` shows only the last two hours of news.
- **A day doesn't fit in one request.** The API rejects `limit > 1000` ("limit value should be <= 1000"),
  so this reader's day needs two requests and about 9.5 MB. At 1,000 entries that is 759 ms p50 from
  Vercel before any ranking work.
- **73% of the bytes are `content`**, which ranking doesn't need. The biggest entries were Guardian
  live blogs at 52–68K characters. `/v1/entries` has no field selection, so every render downloads full
  article text just to read titles.

**How it was measured, and what was deliberately not done:** the probe was **not** added to the
editorial app. That project's build command is `pnpm payload migrate && pnpm build`, and its
Preview environment shares the production `DATABASE_URL`/`POSTGRES_*` variables, so a normal
preview deploy would have run Payload migrations against the live newsroom database. Instead, a
one-function deployment with no build step went to the same Vercel project as a **preview**, with
the key passed as a deployment-scoped env var under its own name. The project's env settings were
not changed. The deployment was removed the same day (its URL now returns 404), and the route never
existed in either repo.

**Not decided here:** where the cache lives (Upstash, already a dependency for trending, is the
obvious candidate but wasn't evaluated). Also not decided: whether to ask upstream for field selection
on `/v1/entries`, and the refresh trigger (on view vs. on Miniflux's 60-minute poll).

### D3 — v1 carries the top of the page but not the whole page. The gap is tuning, not an LLM. **LOCKED**
**Reasoning so far:** view-based trending cannot work per reader (one person generates almost no
views, so `views / (age+2)^1.5` is a permanent cold start). The signals that do fit are already in
the entry payload `client.ts` fetches: recency, source feed and category (readers declare importance
by how they organize), per-section quotas so one noisy feed cannot take the front page, HN comment
counts (`CommentsURL` is persisted and the comments pipeline shipped), and cross-source dedupe so
one story from four feeds becomes one lead with four sources. No new dependency, no cold start.

**Evidence produced (2026-09-15):** v1 ran over one real account's last 24 hours (user 2: 1,156
entries from 26 active feeds, 1,067 stories after dedupe). The ranking: 6-hour recency half-life ×
corroboration (1 + 0.5 per extra publisher) × HN comments (1 + log10(1+n)/2), with at most 1 story
per feed and 3 per category on the front and 2 per feed in each section. No tuning beyond the one bug
fix noted below. The rendered front page, private to the product owner:
**https://claude.ai/artifact/EQuWxi3buUNnpb5MSR7fMU**. Every story on it shows which signal put it
there.

What the run showed about the signals as scoped — two of the five turned out different from what
the doc assumed:
- **Feed/category weight doesn't exist.** Miniflux stores no priority for a feed or a category, and
  this reader's categories are topic buckets (News 12 feeds, Tech 11, Business 7…), not a ranking. So
  v1 could only use category for **sections**. Every feed weighed the same.
- **Comment volume covers 4% of the day, and it isn't in the payload.** 90 entries had a
  `comments_url`, but only the 49 Hacker News ones point anywhere with a count, and getting each count
  took one call to the HN API. That's a new per-render external dependency the doc didn't have.
- **Dedupe is precise but misses rewordings.** 13 stories were covered by more than one publisher,
  and every member checked was genuinely the same story. But it merged only 7 of the 10 "US weapons in
  space" headlines (TechCrunch, NYT and FT were left separate), and it can't match Spanish and English
  coverage of the same event. **One bug fixed:** sources must count *publishers*, not feeds. This
  account has two overlapping BBC feeds and two NYT feeds, which made BBC stories look corroborated by
  BBC.
- **Volume is skewed hard.** El Economista posted 200 entries that day, The Guardian 170 and BBC 146.
  Without the per-feed quotas those three would fill the page.

**What the front page reads like:** the top is genuinely good. The lead is the US confirming weapons
in orbit (5 publishers, 285 HN comments), followed by the Netherlands rail sabotage (BBC, 375 HN
comments) and the Morena Zacatecas candidacy (El País + Reforma). But only 13 of 1,067 stories carry
any signal besides recency. By slot 7 the signals are used up, and the front page goes to a
**Guardian theatre review because it's 24 minutes old**. **20 of the 29 stories on the page are
there on recency alone**, so below the first five it reads as "the last half hour, one per feed",
which is a river with quotas, not an edition.

**Verdict — the product owner, 2026-09-15:** *worth reading with tuning.* The edition was read and
approved; the top of the page holds up as an edition. The tail does not, and the fix is to make the
page shorter and the signals sharper — not to put a model in the render path.

This **overrides the builder's read**, which pointed at the LLM pass. The builder was reasoning from
sprint-2's own rule ("if v1 needs tuning to be readable… the bet is L"); the rule is about *size*, and
it still holds — the bet stays **L**. What changes is wave 3's content: **tuning, not an LLM.** The LLM
pass returns to the funnel as an unbet idea, to be priced only if tuning fails.

**What "tuning" means concretely** — the spike's own findings name the work, and it is not guesswork:
- **Stop padding the page.** 20 of 29 stories are there on recency alone. An edition of 8–12 stories
  where every slot carries a signal beats 29 where two thirds don't. Cutting is the cheapest fix and
  probably the biggest one.
- **Dedupe misses rewordings.** It merged 7 of 10 "US weapons in space" headlines and left TechCrunch,
  NYT and FT separate; it cannot match Spanish and English coverage of one event. Corroboration is the
  strongest non-recency signal there is, so every miss costs a slot.
- **The corroboration bug is fixed but the lesson generalises:** sources must count *publishers*, not
  feeds (two BBC feeds made BBC corroborate BBC). Any future signal needs the same check.
- **Comment counts cost a call each and cover 4% of the day.** Decide whether that dependency earns
  its place at all, or whether it is cached with the edition.

**Not decided here:** the LLM categorize-and-rank pass. It is a separate bet, priced after someone
has read a real edition.

## Scope — stories
| Sprint | Story | Risk |
|---|---|---|
| 1 | Read path and credential boundary | low |
| 2 | Ranking floor — is the paper worth reading? | low |

## Follow-on bet — sized **L** (confirmed by D3's verdict, 2026-09-15)
**One line:** a readable personalized edition takes at least three independent waves: a per-user
derived cache (D1b), an importance signal the intrinsic data doesn't have (D3), and cross-subdomain
reader auth behind #10 (D2, HIGH). Each of those is its own M.

- **Why not M:** D1b shows a render can't be one live call; a day of entries is 1,156 entries, 9.5 MB
  and two requests, so a cache plus an incremental refresh has to be built before the page exists.
  D3 shows v1 is readable for only five slots, and sprint-2 set the rule itself: "if v1 needs tuning
  to be readable, that is the finding, and it is what makes the follow-on bet L."
- **The verdict landed as *worth reading with tuning*,** which keeps it at L but changes wave 3 from
  an LLM pass to a ranking-and-editing pass. Cheaper, no new runtime dependency, no per-user model
  cost — but still its own wave, because it can only be judged against real editions.
- **Waves:** (1) `mcp-token-handling` (#10, appetite S, HIGH) — must land first per D2, already
  scaffolded; (2) `personalized-edition` — reader session across subdomains + per-user derived cache +
  v1 ranking behind auth (M, HIGH, scaffolded 2026-09-15); (3) `editorial-ranking-tuning` — shorter
  page, better dedupe, decide the HN dependency (seed only, re-bet after wave 2 has run with real
  readers). The LLM pass is **not** a wave; it returns to the funnel unbet.
- **What it displaces:** the ready column holds `onboarding-provisioning-reliability` (LOW) and
  `ci-build-pipeline` (HIGH). `ci-build-pipeline` should go first regardless. An L bet that adds
  Vercel↔VM coupling shouldn't ride on a deploy path that compiles Go on the production host. So this
  bet displaces `onboarding-provisioning-reliability` in the next wave, not the build pipeline.

## Deploy order
None — a spike deploys nothing. No branch, no PR, no production writes. The only artifacts are the
decisions above and the `RETROSPECTIVE.md`.

## Definition of Done (epic)
- [x] `D1`, `D1b`, `D2`, `D3` each carry a decision, its evidence, and what it did not decide
- [x] Every `PENDING` decision names where its evidence must come from (none remain — all four LOCKED)
- [x] The follow-on build bet is sized **M or L** with a one-line reason (L, provisional on D3's verdict)
- [x] `mcp-token-handling` (#10) marked merge / sequence-before / independent, with a reason
- [x] `RETROSPECTIVE.md` written
- [x] Durable learnings promoted to `Roadmap/LEARNINGS.md` (dedupe — sharpen, don't append)
- [x] Product poster (`Roadmap/README.md`) updated
- [x] No code merged to `main` in either repo
- [x] **This README's frontmatter `status: shipped`** (the SSOT — run `node scripts/build-order.mjs`)

<!-- Kill-switch (Stage 6b): N/A — risk: low, and a spike has no runtime seam to gate. The build
     epic this shapes is expected HIGH (cross-subdomain auth) and gets its own Stage 6b decision at
     its own grooming. -->
