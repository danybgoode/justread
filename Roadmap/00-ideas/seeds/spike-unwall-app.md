---
title: "Spike — how should unwall.app reach the reader?"
slug: spike-unwall-app
status: scaffolded
area: "01"
type: spike
priority: wave-2026-09-panfleto
appetite: S
underwritten_by: null
risk: low
epic: "01-reading-experience/spike-unwall-app"
build_order: 5
updated: 2026-09-15
---

# Spike — how should unwall.app reach the reader?

**This is an investigation that ends in a written decision in this file. No branch, no build.**

## The question
`article-autofetch` wants unwall.app as a fallback when a direct scrape returns nothing. There are
two ways to get its output in front of the reader, and they are not equally good:

- **(A) Server-side fetch.** unwall.app becomes step 2 of the fallback chain — pulled through
  `internal/reader/fetcher`, run through `internal/reader/readability`, stored as entry content.
  Works regardless of what headers unwall.app sends, keeps panfleto's typography and reading
  position, and means the article is *already there* on click rather than loading in a frame.
- **(B) iframe embed.** One line of template. Fails silently if unwall.app sends
  `X-Frame-Options: DENY` or a restrictive `frame-ancestors`, needs the reader's CSP widened to
  allow it, and hands a third party the reader viewport.

**Prior is strongly (A).** The spike exists because the facts that would confirm it could not be
obtained.

## Why this is a spike and not a story
During the 2026-09 audit, `unwall.app` returned **403 from the egress proxy** on every attempt —
from both the cloud sandbox and the connected device shell. So none of the following is known:

- its response shape (rendered HTML? a redirect? JSON?)
- whether `X-Frame-Options` / `frame-ancestors` permit embedding
- its rate limits from a single IP, and what it returns when throttled
- whether the `unwall.app/{host}{path}` format needs a scheme, tolerates query strings, or handles
  non-`www` hosts and AMP URLs
- whether it is a person's side project that may vanish, or something with an uptime story

Planning a fallback chain on a service nobody has successfully called is exactly the "stale
assumption" the groom skill warns about.

## Appetite
**S** — well under one session. This is `curl` and reading.

## The investigation
Run **from the Oracle VM**, not from a laptop and not from an agent sandbox — the VM's IP is the one
that will actually be making these requests in production, and rate limits are per-IP.

```bash
U="https://unwall.app/www.nytimes.com/2026/09/14/us/politics/donald-trump-jr-wedding-russian-businessman.html"

curl -sSI -L "$U"                        # status chain, X-Frame-Options, CSP, content-type
curl -sS -L "$U" | head -c 4000          # is it rendered article HTML, or a shell?
curl -sS -L "$U" | wc -c                 # enough body to be the article?
for i in $(seq 1 12); do curl -sS -o /dev/null -w "%{http_code} " -L "$U"; sleep 2; done   # throttling
```

Then repeat against **three more publishers** the starter feeds actually use — `ft.com`,
`elpais.com`, `newyorker.com` — because a service that only works on one publisher isn't a fallback.

## What the decision must state
1. **(A) or (B)**, and why.
2. Whether unwall.app's output needs readability extraction or is already clean enough to store.
3. The **failure mode**: what the chain does when unwall.app 403s, throttles or disappears. A
   fallback that hard-fails the fetch is worse than no fallback.
4. Whether it earns a **cache** (and with what TTL) before `article-autofetch` starts calling it at
   polling volume.
5. The exact URL-construction rule, including the query-string and non-`www` cases.

## What this unblocks
- `article-autofetch` step 2 of the fallback chain — blocked on this
- `paywall-rail-single-source` — **not** blocked; that slice only adds a link, which degrades to a
  dead link rather than a broken reader if unwall.app is flaky

## Cross-agent planning panel
This is a Spike, so the panel is **offered** (per groom Stage 2): once the findings are written,
`node scripts/cross-panel.mjs Roadmap/00-ideas/seeds/spike-unwall-app.md --lens both --agent codex`
for an architecture second opinion on the A/B call, and again with `--agent antigravity` for family
diversity. Advisory, print-only, never a gate.

## Decision
_(not yet made — this section is the deliverable)_
