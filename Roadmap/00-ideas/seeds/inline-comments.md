---
title: "Read the comments without leaving the reader"
slug: inline-comments
status: scaffolded
area: "01"
type: feature
priority: wave-2026-09-panfleto
appetite: M
underwritten_by: null
risk: high
epic: "01-reading-experience/inline-comments"
build_order: 7
updated: 2026-09-15
---

# Seed — Read the comments without leaving the reader

> **Portfolio pass only — not Definition of Ready.** Blocked on `miniflux-upstream-resync` — it
> patches the fork, and doing it before the rebase turns a 12-file delta into a 15-file one that
> then has to be replayed.

## Problem
For a Hacker News or Reddit item, the comments *are* the article. Today panfleto parses the comments
URL, stores it, and renders it as a link that takes the reader out of panfleto into a browser tab —
which is the moment the distraction-free reading session ends.

## Appetite
**M** — one wave. Two adapters and a cached panel.

## Lane
**Shaped bet.** New capability with a real data decision inside it (see below).

## Why this is cheaper than it sounds
The groundwork is already in the fork, untouched:

| Already there | Where |
|---|---|
| `CommentsURL` parsed from RSS | `internal/reader/rss/adapter.go:137` |
| `CommentsURL` parsed from Atom | `internal/reader/atom/atom_10_adapter.go:151` |
| Persisted on every entry | `internal/storage/entry.go`, `internal/model/entry.go:31` |
| Exposed on the API and usable in filter rules | `internal/api/messages.go`, `internal/reader/filter/filter.go:163` |
| Rendered as a link with an icon | `entry.html`, the `.entry.CommentsURL` block |
| HTML sanitizer for untrusted input | `internal/reader/sanitizer/` |
| Lazy `<details>` pattern to copy | the enclosures block in `entry.html` |

Nothing new needs to be parsed, stored on the entry, or fetched from the feed. The work is an
adapter per source, a route, a panel, and a cache.

## Rough shape
- `internal/reader/comments/` with one adapter per source:
  - **Hacker News** → `hn.algolia.com/api/v1/items/{id}` — full nested thread, no auth, generous
  - **Reddit** → `{permalink}.json` — needs a real UA, and is rate-limited hard per IP
  - **Lobsters** → `{url}.json` — trivial
  - anything else → keep today's outbound link
- `GET /entry/{id}/comments` returning rendered HTML
- Lazily loaded into a collapsed `<details>` by `app.js` — costs nothing on entries without comments
- Cached in an `entry_comments` table with a TTL

## The decision that makes this HIGH
**The cache needs a table, and a panfleto-owned migration is a permanent rebase conflict**
(`AGENTS.md` rule 3 — `schemaVersion = len(migrations)`, upstream appends to the same slice). The
fork has **zero** custom migrations today and that is worth protecting. So the deep groom has to pick
deliberately between:

- a real migration (permanent per-rebase conflict, but proper relational storage), or
- an in-process TTL cache (zero schema cost, lost on restart, no cross-restart rate-limit protection), or
- a separate schema/table created outside the `migrations` slice by the deploy step (no rebase cost,
  but now panfleto owns a schema Miniflux doesn't know about)

This is an **escalate-don't-guess** call, decided at the architecture lock and written into the epic
README — not something a builder picks mid-sprint.

## Non-negotiables for whoever builds it
1. **Every comment body goes through `internal/reader/sanitizer`.** This is untrusted HTML written
   by strangers on the internet, rendered inside an authenticated session.
2. **Reddit will throttle a single VM IP.** Re-opening an article must not re-hit the API. The cache
   is not an optimisation here, it is the feature working at all.
3. **Two adapters, then stop.** Given the starter feeds — Hacker News plus four Reddit-adjacent
   categories in `enhance_miniflux.js` — HN and Reddit cover nearly everything. Ship, then see.

## Open questions for the deep groom
1. Table, in-process cache, or side schema? (the HIGH decision above)
2. How deep does the thread render — top-level only, or nested with a depth cap?
3. Does an entry with an unreachable comments API show an error, or silently fall back to the link?
