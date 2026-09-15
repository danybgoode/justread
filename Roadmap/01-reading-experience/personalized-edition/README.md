---
status: scaffolded   # AUTHORITATIVE epic status (SSOT) — scaffolded | in-progress | shipped | archived. Set shipped at epic close.
slug: personalized-edition
build_order: 12
---

# Epic: Your own feeds, as a newspaper

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

**Still open — the architect pass locks these before any builder starts:**
1. **Cache location.** Upstash (already a dependency) vs. Next's data cache vs. something else.
2. **Refresh trigger.** On view vs. on Miniflux's 60-minute poll; plus the max-age fallback for a feed
   that backfills older entries without moving the newest-ID key.
3. **Session mechanism.** Editorial runs its own OIDC against the same Auth0 tenant and maps
   `email → Miniflux user` server-side, vs. a signed handoff from the reader. This is the HIGH-risk
   contract everything else imports.
4. **Whether `editorial-panfleto` adopts the ways-of-working scaffolding** (it has no `AGENTS.md`, no
   `Roadmap/`, no guards workflow). This is the first real cross-repo epic.

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
Backend-first, and the two repos deploy on different rails. If a story touches `fluxonline`, that
merges and is deployed by a human running `update.sh` on the VM **first**; the Vercel side degrades
gracefully until it catches up. The flag stays disabled through all three sprints; flipping it on is
a deliberate, separate act after a real account has been verified.

## Definition of Done (epic)
- [ ] All sprints merged to `main` + smoke-tested (gaps stated)
- [ ] Each `sprint-N.md` has its smoke walkthrough (real URLs)
- [ ] This README marked ✅; every sprint status ticked with commit refs
- [ ] `RETROSPECTIVE.md` written
- [ ] Product poster (`Roadmap/README.md`) updated
- [ ] Durable learnings promoted to `Roadmap/LEARNINGS.md` (dedupe — sharpen, don't append)
- [ ] **Kill-switch:** `editorial.personalized_enabled` exists in **every** environment, created
      **disabled** (enablement polarity, per Stage 6b above)
- [ ] Feature branch deleted; **frontmatter `status: shipped`** (run `node scripts/build-order.mjs`)
