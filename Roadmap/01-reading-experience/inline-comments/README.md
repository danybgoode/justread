---
status: scaffolded
slug: inline-comments
build_order: 7
---

# Epic: Read the comments without leaving the reader

> **Area:** 01-reading-experience · **Risk:** high · **Class:** Feature · **Scope seed:** [`00-ideas/seeds/inline-comments.md`](../../00-ideas/seeds/inline-comments.md)

## Why

For a Hacker News or Reddit item, the comments *are* the article. Today panfleto parses the comments
URL, stores it, and renders it as a link that takes the reader out of panfleto into a browser tab —
which is exactly the moment a distraction-free reading session ends. This epic brings the thread
inside.

> **Post-resync note (2026-09-15).** `miniflux-upstream-resync` has **shipped**, so this epic is
> **unblocked** — the earlier warning that building it first would turn a 12-file delta into a 15-file
> one no longer applies. The current delta is **six topic commits** plus `feeds.json`, the sync
> workflow and 17 branding icons (`AGENTS.md` rule 1). `internal/reader/comments/` will grow it; say
> so in the PR body and keep it to the adapter plus the route.
>
> One thing the resync **confirmed** and this epic depends on: the fork now tracks `upstream/main` with
> a weekly rebase PR, so any Go file added here is replayed every week. That is the tax, and it is why
> D1's cache decision below matters more than it looks.

## Platform-first note — this is cheaper than it looks

Nothing new needs to be parsed from feeds or stored on the entry. It is **already there**, untouched:

| Already shipped | Where |
|---|---|
| `CommentsURL` parsed from RSS | `internal/reader/rss/adapter.go:137` |
| `CommentsURL` parsed from Atom | `internal/reader/atom/atom_10_adapter.go:151` |
| Persisted on every entry | `internal/storage/entry.go`, `internal/model/entry.go:31` |
| On the API and usable in filter rules | `internal/api/messages.go`, `internal/reader/filter/filter.go:163` |
| Rendered as an outbound link with an icon | `entry.html`, the `.entry.CommentsURL` block |
| Sanitizer for untrusted HTML | `internal/reader/sanitizer/` |
| Lazy `<details>` pattern to copy | the enclosures block in `entry.html` |

The work is an adapter per source, a route, a panel, and a cache.

## ⚠️ The decision that makes this HIGH — resolve before S2

**The cache wants a table, and a panfleto-owned migration is a permanent rebase conflict.**
`internal/database/migrations.go` is an append-only slice with `schemaVersion = len(migrations)`;
upstream appends to the same slice, so a migration panfleto owns at index N collides with upstream's
at index N at **every** rebase, and wrong ordering on a deployed database is unrecoverable without a
restore. The fork has **zero** custom migrations today and that property is worth real money.

Three options, and the architect picks one and writes it into D1 **before S2 starts**:

| Option | Cost | Buys |
|---|---|---|
| A real migration + `entry_comments` table | permanent per-rebase conflict | proper relational storage, survives restarts |
| In-process TTL cache | zero schema cost | lost on restart — so no cross-restart protection from Reddit's rate limit |
| A side table created outside the `migrations` slice by the deploy step | no rebase cost | panfleto now owns a schema Miniflux doesn't know about |

This is **escalate-don't-guess** (`AGENTS.md` rule 3). S1 is deliberately sliced so it does **not**
need the answer — HN's API is generous enough to survive without a durable cache.

## Architecture decisions — to be LOCKED before S2

| # | Decision | State |
|---|---|---|
| **D1** | Cache: migration, in-process, or side schema | **To lock** — the table above |
| **D2** | Thread depth: top-level only, or nested with a cap | **To lock** — a 400-comment HN thread rendered in full is its own problem |
| **D3** | Unreachable comments API: show an error, or fall back to today's link | **To lock** |
| **D4** | Two adapters, then stop | **Decided** — HN + Reddit covers nearly all of the starter feeds |

## Non-negotiables for whoever builds this

1. **Every comment body goes through `internal/reader/sanitizer`.** This is untrusted HTML written by
   strangers, rendered inside an authenticated session. There is no version of this epic where that
   is skipped.
2. **Reddit will throttle a single VM IP.** The cache is not an optimisation, it is the feature
   working at all.
3. **The panel is lazy.** An entry with no comments URL costs nothing — same pattern as enclosures.

## Scope — stories

| Sprint | Story | Risk |
|---|---|---|
| 1 | 1.1 — A comments route and a lazy panel | low |
| 1 | 1.2 — Hacker News threads, sanitized | high |
| 2 | 2.1 — A cache that survives the decision | high |
| 2 | 2.2 — Reddit threads, rate-limit aware | high |

## Deploy order

Backend + template; no data migration in S1 by construction. S1 ships and is useful alone — HN alone
covers the single most comment-driven feed in the starter set. S2 only ships once D1 is decided.

## Definition of Done (epic)
- [ ] All sprints merged to `main` + deployed + smoke-tested (gaps stated)
- [ ] Each `sprint-N.md` has its smoke walkthrough (real URLs)
- [ ] This README marked ✅; every sprint status ticked with commit refs
- [ ] `RETROSPECTIVE.md` written
- [ ] Product poster updated — 01's "Comments" line goes 🚧 → ✅
- [ ] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [ ] **Kill-switch:** carve-out or flag per D1's outcome — if a migration was added, the README records who approved it and why
- [ ] `AGENTS.md` rule 1's delta count updated for the files this epic added
- [ ] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
