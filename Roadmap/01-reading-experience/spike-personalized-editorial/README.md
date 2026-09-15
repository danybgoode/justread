---
status: in-progress   # AUTHORITATIVE epic status (SSOT) — scaffolded | in-progress | shipped | archived. Set shipped at epic close.
slug: spike-personalized-editorial
build_order: 11
---

# Epic: Can the newspaper read one reader's feeds?

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

**Not decided here:** how the page is cached (D1b), and whether the anonymous edition eventually
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

### D1b — Caching strategy for a per-user page. **PENDING — evidence owed**
**Reasoning so far:** `src/app/(frontend)/page.tsx` is `export const dynamic = 'force-static'` with
`revalidate: 600`. A per-reader edition cannot be statically generated, so the personalized route
needs its own strategy — most likely a short per-user cache keyed on the reader plus a cheap
freshness signal, with the Miniflux call budgeted per render.

**Evidence owed:** end-to-end latency of `GET /v1/entries?limit=100&order=published_at` **measured
from a Vercel function**, not from a laptop. `LEARNINGS.md` already carries this rule from
`spike-unwall-app` — probe from the machine that makes the call in production. Vercel→Oracle-VM is
the hop that has never been timed.

**Blocker (recorded 2026-09-15):** the API was unreachable from both shells available to this
session — the desktop VM's egress refused the connection outright (HTTP 000 in 4ms), and the cloud
container's proxy answered `connect_rejected` (organization policy). Sprint 1 names the probe and
where it has to run.

### D3 — Is a paper ranked on intrinsic signals worth reading? **PENDING — evidence owed**
**Reasoning so far:** view-based trending cannot work per reader (one person generates almost no
views, so `views / (age+2)^1.5` is a permanent cold start). The signals that do fit are already in
the entry payload `client.ts` fetches: recency, source feed and category (readers declare importance
by how they organize), per-section quotas so one noisy feed cannot take the front page, HN comment
counts (`CommentsURL` is persisted and the comments pipeline shipped), and cross-source dedupe so
one story from four feeds becomes one lead with four sources. No new dependency, no cold start.

**Evidence owed:** run that ranking over **one real account's** entries and read the resulting front
page. The question is editorial ("would I read this?"), not numerical — and it is what decides M vs
L, because a paper that needs the LLM pass to be interesting is a bigger bet than one that doesn't.

**Not decided here:** the LLM categorize-and-rank pass. It is a separate bet, priced after someone
has read a real edition.

## Scope — stories
| Sprint | Story | Risk |
|---|---|---|
| 1 | Read path and credential boundary | low |
| 2 | Ranking floor — is the paper worth reading? | low |

## Deploy order
None — a spike deploys nothing. No branch, no PR, no production writes. The only artifacts are the
decisions above and the `RETROSPECTIVE.md`.

## Definition of Done (epic)
- [ ] `D1`, `D1b`, `D2`, `D3` each carry a decision, its evidence, and what it did not decide
- [ ] Every `PENDING` decision names where its evidence must come from
- [ ] The follow-on build bet is sized **M or L** with a one-line reason
- [ ] `mcp-token-handling` (#10) marked merge / sequence-before / independent, with a reason
- [ ] `RETROSPECTIVE.md` written
- [ ] Durable learnings promoted to `Roadmap/LEARNINGS.md` (dedupe — sharpen, don't append)
- [ ] Product poster (`Roadmap/README.md`) updated
- [ ] No code merged to `main` in either repo
- [ ] **This README's frontmatter `status: shipped`** (the SSOT — run `node scripts/build-order.mjs`)

<!-- Kill-switch (Stage 6b): N/A — risk: low, and a spike has no runtime seam to gate. The build
     epic this shapes is expected HIGH (cross-subdomain auth) and gets its own Stage 6b decision at
     its own grooming. -->
