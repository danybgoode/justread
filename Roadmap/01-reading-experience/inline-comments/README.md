---
status: shipped
slug: inline-comments
build_order: 7
---

# Epic: Read the comments without leaving the reader ✅

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

## Architecture decisions — LOCKED 2026-09-15 against production

| # | Decision | Evidence |
|---|---|---|
| **D1** | **In-process TTL cache**: 10 minutes, 128 threads, keyed by thread. **No migration and no side schema.** A restart is a cache miss, by design | HN's Algolia API is unauthenticated and generous. With Reddit cut (D4), nothing left needs protection that survives a restart. Rule 3 stays at zero custom migrations |
| **D2** | **Nested, capped:** 5 levels deep and 300 comments. A truncated thread ends with the existing translated "View Comments" link to the full thread on HN | HN's front page regularly carries threads with several hundred comments. Rendering all of them inline is its own performance problem |
| **D3** | **An unreachable API shows a short fragment with the same outbound link**, and the route answers 502. The outbound comments link in the toolbar stays on every entry | The reader never sees a broken page, and today's escape hatch is untouched |
| **D4** | **One adapter, then stop: Hacker News. Reddit (story 2.2) is cut by the product owner, 2026-09-15** | From the VM: Reddit `.json` returns **403**, RSS returned **429 after 3 calls**, and 3 of the 4 production Reddit feeds are already failing to poll. Reddit entries carry **no** comments URL (0 of ~640 in 14 days), and Reddit isn't in the starter feeds. The only working path was a registered OAuth app, a new external dependency and production secret, which the product owner declined |
| **D5** | **The panel renders only for URLs an adapter supports** (`news.ycombinator.com/item?id=N`), only for a signed-in reader, and never on `/share/` | Ars Technica and 9to5Mac entries also carry comments URLs (539 in 14 days) to their own sites, and a panel that can't load would be worse than today's link |
| **D6** | **Rendered by the comments package's own `html/template`, styled only by existing classes** (replies nest as `blockquote` inside `.entry-content`). Every comment body goes through `sanitizer.SanitizeHTML` | The reader's CSP is `style-src 'nonce-…'`, so inline `style` attributes are blocked. A view registered in `engine.go` would add an upstream file to the delta. The fragment is inserted through the one `html` Trusted Types policy `app.js` already declares, created once and shared, because CSP `trusted-types html url` forbids creating a duplicate |

**Fork delta (rule 1).** New files: `internal/reader/comments/` (adapter, cache, render and tests) and
`internal/ui/entry_comments.go` (the route). Upstream files touched: `internal/ui/ui.go` (one route line)
and `internal/ui/static/js/app.js` (the lazy loader and the shared policy). Already panfleto's:
`entry.html` and `view/view.go`. It lands as one new topic commit, `panfleto: inline comments`.

## Non-negotiables for whoever builds this

1. **Every comment body goes through `internal/reader/sanitizer`.** This is untrusted HTML written by
   strangers, rendered inside an authenticated session. There is no version of this epic where that
   is skipped.
2. **~~Reddit will throttle a single VM IP.~~** Confirmed on 2026-09-15 (403 on JSON, 429 on RSS), and Reddit is cut. The cache
   still exists, so reopening an HN thread doesn't refetch it.
3. **The panel is lazy.** An entry with no comments URL costs nothing — same pattern as enclosures.

## Scope — stories

| Sprint | Story | Risk |
|---|---|---|
| 1 | 1.1 — A comments route and a lazy panel | low |
| 1 | 1.2 — Hacker News threads, sanitized | high |
| 2 | 2.1 — A cache that survives the decision | high |
| 2 | ~~2.2 — Reddit threads, rate-limit aware~~ **cut by the product owner 2026-09-15 (D4)** | — |

## Deploy order

Backend + template; no data migration in S1 by construction. S1 ships and is useful alone — HN alone
covers the single most comment-driven feed in the starter set. S2 only ships once D1 is decided.

## Definition of Done (epic)
- [x] All sprints merged to `main` + deployed + smoke-tested. Gaps are stated in each sprint's walkthrough: the signed-in expand is owed to the product owner
- [x] Each `sprint-N.md` has its smoke walkthrough (real URLs)
- [x] This README marked ✅; every sprint status ticked with commit refs
- [x] `RETROSPECTIVE.md` written
- [x] Product poster updated — 01's "Comments" line goes 🚧 → ✅
- [x] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [x] **Kill switch:** D1 added no migration, so none is needed for schema. Rollback is `git revert` of the merge, or moving the pin back to `fa8e46a2` (tag `pre-inline-comments`)
- [x] `AGENTS.md` rule 1's delta count updated for the files this epic added
- [x] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
