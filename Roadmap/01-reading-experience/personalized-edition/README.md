---
status: shipped   # AUTHORITATIVE epic status (SSOT) — scaffolded | in-progress | shipped | archived. Set shipped at epic close.
slug: personalized-edition
build_order: 12
---

# Epic: Your own feeds, as a newspaper ✅

> **Area:** 01-reading-experience · **Risk:** high · **Class:** Feature · **Scope seed:** [`00-ideas/seeds/personalized-edition.md`](../../00-ideas/seeds/personalized-edition.md)

## Why
A reader's feeds currently have one shape: a list, newest first. This epic gives them a second one —
a front page built from their own sources, where the lead story is the lead because several of their
publishers ran it, not because it arrived four minutes ago. Anonymous visitors keep the curated
edition they get today. Nothing about the Miniflux reader changes.

This is **wave 2** of the three that `spike-personalized-editorial` sized. Wave 1 is
`mcp-token-handling` (#10) and must land first. Wave 3 is ranking tuning, re-bet after this runs.

## Platform-first note
Miniflux stays the system of record for feeds, entries and content — this epic adds **no** write path
to it and **no** Go (rule 1's fork-delta budget is untouched). Payload stays the system of record for
the curated anonymous edition only, single-tenant, with no new collection and no migration (D1). The
personalized edition owns nothing durable: its cache is derived, keyed and disposable, and losing it
loses nothing (D1b).

## What already exists (reuse, don't rebuild)
- `editorial-panfleto/src/lib/miniflux/client.ts` — typed client. Needs the key per call rather than
  read from module-level env; small and contained.
- `editorial-panfleto/src/lib/miniflux/html.ts` — sanitize + Lexical conversion.
- `editorial-panfleto/src/components/Editorial/*` + the front-page grid in `src/app/(frontend)/page.tsx`.
- `editorial-panfleto/src/lib/trending/redis.ts` — **Upstash already wired**; first candidate for the
  per-user cache.
- `fluxonline/panfleto-core/internal/ui/integration_show.go:150-173` — the per-user Miniflux key.
- `fluxonline/deploy/oauth.env.example` — the shared Auth0 tenant.
- The spike's ranking implementation + its measured numbers —
  [`spike-personalized-editorial/README.md`](../spike-personalized-editorial/README.md) D1b and D3.

## Decisions inherited from the spike (do not re-derive)
| # | Decision | Where |
|---|---|---|
| D1 | Live-render; nothing durable written to Payload | spike README |
| D1b | Per-user derived cache over 24 h, keyed on reader + newest entry ID, incremental refresh, stale-while-revalidate. **Never** an inline `limit=100` render | spike README |
| D2 | The per-user Miniflux API key is the credential; Payload auth stays staff-only; **sequences behind #10** | spike README |
| D3 | v1 ranking ships as the spike ran it. Tuning is wave 3, not this epic | spike README |

## Architecture decisions — LOCKED 2026-09-16, against live code and live data

### What the locking pass disproved (read before believing the sprint docs)
- **`editorial.panfleto.win` does not exist.** No DNS record resolves; the Vercel project's only domain is
  **`editorial-panfleto.vercel.app`**. So there is no "cross-subdomain" session to share, and every smoke
  URL below uses the real host. Adding a `panfleto.win` subdomain is DNS work, out of scope.
- **"Map `email → Miniflux user` server-side" cannot yield a credential.** Miniflux's API mints and lists
  API keys only for the *authenticated* user (`internal/api/api_key_handlers.go`), and an admin cannot
  read another user's entries. Editorial could learn *who* a reader is from Auth0, and still have
  nothing to read their feeds with. Both scaffolded options assumed otherwise.
- **Live data (2026-09-16):** 3 users: admin (0 feeds), user 2 (Auth0, 34 feeds, **904 entries/24 h**,
  35 of them HN), user 3 (password, 13 feeds, 253/24 h, 35 HN). **90 of the day's entries were published
  more than 6 h before Miniflux stored them**, so late arrivals are the normal case, not an edge case.
- **A leftover credential:** the spike's `spike-probe` API key on user 2 was never revoked (last used
  2026-09-15 22:17). Owed to the product owner: delete it in panfleto Settings → API keys.
- **Merging to `main` in `editorial-panfleto` IS its production deploy** (Vercel git integration,
  production branch `main`). Its previews run `pnpm payload migrate` against the production database.
  This epic adds **no** migration, so that step is a no-op on every preview and production build.
  That was checked, not assumed: production is on `main`'s HEAD `bf10cff`.

### Decisions
| # | Decision | Locked answer |
|---|---|---|
| **D4** | Session mechanism *(the HIGH-risk contract)* | **The reader connects with their own panfleto token.** The product owner chose this over a Go handoff on 2026-09-16. The reader generates the token in panfleto Settings → Integrations (the explicit, visible, rotatable credential `mcp-token-handling` shipped) and pastes it once at `/tu-edicion/conectar`. The server refuses anything that cannot be a token (`^[A-Za-z0-9_-]{16,128}$`, so no CRLF reaches `fetch`), then checks it against `/v1/me`, splitting **401 → "that token isn't valid"** from **5xx/transport → "panfleto isn't answering, don't rotate your token"**. The session is an **AES-256-GCM sealed, `httpOnly`, `Secure`, `SameSite=Lax` cookie** holding `{key, userId, username, issuedAt}`, 30-day max age. The key exists in the browser only as ciphertext it cannot read. Nothing is stored server-side. Sign-out deletes the cookie and the cached edition. A leaked cookie dies when the reader rotates the token (mcp-token-handling D4 revokes immediately). Same account, no second password, no Auth0 change, **zero Go**. |
| **D5** | Cache location | **Upstash Redis**, which is already wired, over its REST API. Next's data cache is per-deployment, so every deploy wipes every edition, and it has no lock primitive. Key: **`pe:v1:<VERCEL_ENV>:edition:<minifluxUserId>`**. The user ID comes from `/v1/me` at connect time and sits inside the sealed cookie, so it cannot be forged. The environment prefix keeps Preview out of Production's keys, since both share one Upstash database. The value is gzip+base64 JSON of the *slim* day (no `content`, 220-char excerpt), plus HN counts and the ranked edition. That is about 100 KB for the biggest reader, well under Upstash's 1 MB request cap. TTL 48 h. With no Upstash configured (local dev, tests) it falls back to an in-process store. |
| **D6** | Refresh trigger + max-age | **On view, stale-while-revalidate.** Miniflux cannot notify Vercel without Go. **Fresh for 10 min** (Miniflux polls hourly, so fresher buys nothing). A stale view serves the stored edition immediately and refreshes in `after()`, behind a `SET NX EX 120` lock so two tabs don't both rebuild. **The incremental refresh keys on `after_entry_id`, not `published_after`.** That deviates from story 2.2's wording, deliberately. Entry IDs grow with *insertion*, so an entry published at 09:00 and stored at 10:40 is still caught. A `published_after = last build` filter would have missed all 90 of today's late arrivals. `published_after = now − 24 h` stays on as the day window. **Max age 6 h:** past it, the refresh is a full rebuild, which picks up edits, removals and HN comment counts that grew. The first view with no stored edition builds inline. That is the one blocking fetch, paged at `limit=1000` by `after_entry_id`. |
| **D7** | The one resolver + the flag | `resolvePersonalizedReader(cookie)` in `src/lib/personalized/resolver.ts` is the **only** place the flag is read. Flag off, no cookie, bad seal, or expired all return `null`. Its callers: `src/proxy.ts`, whose matcher fires **only** on `/` **with** the session cookie, so anonymous requests never invoke it and `/` stays the same ISR page with the same cache hit; the `/tu-edicion` page (redirects to `/` on `null`); and the connect action (404 when off). A valid reader on `/` is **rewritten** to the dynamic `/tu-edicion`, which sends `private, no-store`. Flag: **`EDITORIAL_PERSONALIZED_ENABLED`** = `false`, a server-only env var in Production, Preview and Development. Note: a Vercel env change reaches a deployment only after a **redeploy**, so "flip" means set it, then redeploy. |
| **D8** | Ranking | **A line-for-line port of the spike's `rank.py`** (spike README D3) into a pure, zero-import `src/lib/personalized/ranking.ts`. It uses the same union-find dedupe (same canonical URL, or title Jaccard ≥ .5 with ≥ 3 shared tokens, with same-feed pairs joining only on URL), with an inverted token index for candidate pairs, which gives the same result without O(n²). Publisher = the site host minus `www.`, reduced to its registrable domain, plus the spike's BBC and NYT aliases. Scoring is identical. Front: 7 stories, ≤ 1 per feed, ≤ 3 per category. The spike hard-coded one reader's five category names; here it is **the reader's categories ordered by story count, the first five**, 6 stories each, ≤ 2 per feed, with no story repeated. HN counts come from `hacker-news.firebaseio.com/v0/item/<id>.json` → `descendants`, fetched once per entry, cached with the edition, with a 3 s timeout, so a failure counts as 0. Parity checked 2026-09-16 on the spike's saved day: the same 1,067 stories and 13 clusters, and an identical front and sections. |
| **D9** | Surface + copy | Routes `/tu-edicion`, `/tu-edicion/conectar`, `/tu-edicion/salir`, **in Spanish** to match the site (`lang="es"`). The anonymous `/` gets **no** new link and no edit: `src/app/(frontend)/page.tsx` is untouched, and it stays a static page revalidated every 10 min. Only the shared CSS bundle changes. Discoverability (a link from the reader's Settings, a header entry) is a follow-up, not this wave. Stories reuse the newspaper's own classes (`editorial-card`, `lead-package`, `home-river`, `section-modules`) and `SectionHeading`, through a sibling `StoryCard`. `ArticleCard` is typed to Payload's `Article` and links internally, so it can't take a Miniflux entry. Each card carries its signal line: publishers, HN comments, age. `noindex`. |
| **D10** | Does `editorial-panfleto` adopt the scaffolding? | **No.** The docs stay here, as the epic's system of record. Editorial gets its specs in its own `tests/int/` and nothing else. Adopting `AGENTS.md`/guards there is a separate chore. |
| **D11** | PR shape + review | **One PR per repo.** The three sprints land as separate commits on one `editorial-panfleto` branch. By the product owner's instruction for this run, review is **one fresh-reviewer subagent and one external cross-family pass, on the whole diff**. That is not the per-sprint two-family stack. The downgrade is recorded here and in the PR body. |

| **D12** | *(added at review)* A key must still be accepted, for its cookie's user, at view time | Without it, the fresh reviewer showed, a revoked token kept reading an edition that other views kept fresh, which broke D4's promise. The session's key is checked against `/v1/me` at most every 10 min. The result is remembered as `pe:v1:<env>:key:<HMAC of the key>` → `userId`, so the key itself is never stored. Only a **401** rejects; a proxy's 403 is an outage. GCM tags must be the full 16 bytes (Node accepts truncated ones). Live-verified: a key revoked 12 s after its edition was built was refused. |

**Routing:** architect and builder are both Claude Opus 5 in one session (auth is uphill work, which is not
delegated). The fresh reviewer runs on the strongest model; the external pass is the first available
non-Claude family by `review-route.mjs` order.

## Scope — stories
| Sprint | Story | Risk |
|---|---|---|
| 1 | The reader is recognised at editorial | high |
| 2 | The per-user edition cache | high |
| 3 | The edition renders behind auth | high |

## Kill-switch (Stage 6b — decided at grooming)
**`editorial.personalized_enabled` · enablement polarity · default `false` · created DISABLED in every
environment.** Seam: one server-side resolver in front of `/editorial` — off means every visitor gets
the anonymous edition. Mechanism: a server-side Vercel environment variable (never `NEXT_PUBLIC_`),
because `editorial-panfleto` has no flag provider configured. Creating it in Production, Preview and
Development is part of Sprint 3's flag story — a flag that exists only in code is not a flag.

## Deploy order
**As built: `editorial-panfleto` only.** No `fluxonline` code changed, so there was no VM deploy. Merging PR #12
deployed production through Vercel's git integration, dark. The original plan follows.

Backend-first, and the two repos deploy on different rails. If a story touches `fluxonline`, that
merges and is deployed by a human running `update.sh` on the VM **first**; the Vercel side degrades
gracefully until it catches up. The flag stays disabled through all three sprints; flipping it on is
a deliberate, separate act after a real account has been verified.

## Definition of Done (epic) — ✅ complete 2026-09-16
- [x] All sprints merged to `main` + smoke-tested: `editorial-panfleto` PR #12 (`6119f5e` S1, `8bc0cd0` S2,
      `d20f914` S3, `b3bc8d0` review fixes), merge `84225f4`, production deployment `o3j9jzobf`.
      Verified dark in production, and flag-on on a single preview deployment with two disposable readers
      (deleted afterwards). **Gaps stated:** the real sign-in on the product owner's own account, and
      the quality of their own edition, are owed to the product owner (walkthroughs below). The
      Production session secret is write-only, so it is proven only when the flag is first turned on.
- [x] Each `sprint-N.md` has its smoke walkthrough on the real host, with the executed live confirmation
- [x] This README marked ✅; every sprint status ticked with commit refs
- [x] `RETROSPECTIVE.md` written
- [x] Product poster (`Roadmap/README.md`) updated
- [x] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [x] **Kill-switch:** `EDITORIAL_PERSONALIZED_ENABLED` exists in Production, Preview and Development, created
      `false` (enablement polarity). Checked by value where readable (Development: `"false"`) and by
      behaviour in Production (`/tu-edicion/conectar` → 404). One resolver reads it.
- [x] Feature branch deleted; frontmatter `status: shipped`
- **Review, as the product owner set it for this run:** one fresh-reviewer subagent (Opus) plus one external
  pass. Codex's login was revoked, so the external pass fell back to Antigravity. That is one
  cross-family pass, not two, recorded on the PR.
