---
status: shipped
slug: spike-unwall-app
build_order: 5
---

# Epic: How should unwall.app reach the reader? ✅

> **Area:** 01-reading-experience · **Risk:** low · **Class:** Spike · **Scope seed:** [`00-ideas/seeds/spike-unwall-app.md`](../../00-ideas/seeds/spike-unwall-app.md)

## Why

**This is an investigation that ends in a written decision. No branch, no build, no PR beyond the doc.**

> **✅ Answered 2026-09-15: (A) server-side fetch through `api.unwall.app/fetch?url=…`**, a miss on any
> failure, a 1-hour in-process cache. Full findings and the five-point decision are in
> [`sprint-1.md`](sprint-1.md). The same session found archive.ph unreachable from the VM, which cut
> `article-autofetch` story 2.3. The decision doc landed on `feat/article-autofetch`, the first branch
> that builds on it.

`article-autofetch` S2 wants unwall.app as step two of its fallback chain, and
`paywall-rail-single-source` S2 adds it as a link. The link is safe either way. The *fetch* is not,
because nobody has successfully called unwall.app: during the 2026-09 audit it returned **403 from
the egress proxy** on every attempt, from both the cloud sandbox and the connected device shell.

So none of this is known: its response shape, whether `X-Frame-Options`/`frame-ancestors` permit
embedding, its rate limits from a single IP and what it returns when throttled, whether the
`unwall.app/{host}{path}` format needs a scheme or tolerates query strings and non-`www` hosts, and
whether it is a side project that may vanish. Planning a fallback chain on a service nobody has
called is exactly the stale assumption the groom skill warns about.

## The question

- **(A) Server-side fetch.** unwall.app becomes step two of the chain — pulled through
  `internal/reader/fetcher`, run through `internal/reader/readability`, stored as entry content.
  Works regardless of headers, keeps panfleto's typography and reading position, and means the
  article is already there on click.
- **(B) iframe embed.** One line of template. Fails silently on `X-Frame-Options: DENY`, needs the
  reader's CSP widened, and hands a third party the reader viewport.

**Prior is strongly (A).** The spike exists because the facts that would confirm it couldn't be got.

## Where it must run

**From the Oracle VM**, not a laptop and not an agent sandbox. The VM's IP is the one that will make
these requests in production, and rate limits are per-IP.

## Scope — stories

| Sprint | Story | Risk |
|---|---|---|
| 1 | 1.1 — Probe it from the VM | low |
| 1 | 1.2 — Write the decision | low |

## Blocks / unblocks

- **Blocks:** `article-autofetch` story 2.2 (assumption A1 in that epic's README)
- **Does not block:** `paywall-rail-single-source` — adding a link degrades to a dead link, it cannot
  break the reader

## Cross-agent planning panel

This is a Spike, so the panel is **offered** (groom Stage 2). Once the findings are written:

```
node scripts/cross-panel.mjs Roadmap/01-reading-experience/spike-unwall-app/sprint-1.md --lens both --agent codex
node scripts/cross-panel.mjs Roadmap/01-reading-experience/spike-unwall-app/sprint-1.md --lens both --agent antigravity
```

Advisory, single-pass, print-only. Never a gate.

## Definition of Done (epic)
- [x] The decision section in `sprint-1.md` is filled in and answers all five required points
- [x] This README marked ✅; frontmatter `status: shipped`
- [x] `article-autofetch`'s README assumption **A1** is updated from "to lock" to the answer
- [x] unwall.app **is** usable, so story 2.2 stays. **Story 2.3 (archive.ph) is cut** instead, because the
      service can't be reached from the VM, and the chain is two steps
- [x] `RETROSPECTIVE.md` written
- [x] `node scripts/build-order.mjs`
