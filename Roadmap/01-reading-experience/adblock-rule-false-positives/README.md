---
status: scaffolded
slug: adblock-rule-false-positives
build_order: 2
---

# Epic: The ad-block rule is silently dropping real articles

> **Area:** 01-reading-experience · **Risk:** low · **Class:** Bug · **Scope seed:** [`00-ideas/seeds/adblock-rule-false-positives.md`](../../00-ideas/seeds/adblock-rule-false-positives.md)

## Why

`scripts/enhance_miniflux.js` applies this as a global Miniflux block rule to every feed:

```
(?i)(sponsor|sponsored|ad|promotion|deal|sale|discount|oferta)
```

Nothing is anchored, and Miniflux block rules match anywhere in an entry title. So `ad` matches
*leader*, *roadmap*, *broadcast*, *ahead*, *Trinidad*; `deal` matches *dealer* and *idealism*; `sale`
matches *wholesale* and *Salem*. The poster claims ad filtering "keeps sponsored posts out of
Unread" — it also keeps an unknown fraction of real news out, with no log, no counter and no UI
surface. The reader simply never sees those articles and has no way to know.

Not a regression: the rule was written as a keyword list and never converted into a matching pattern.

## Platform-first note

Entirely a script + API change. Miniflux's own `internal/reader/filter/filter.go` is the block-rule
engine and is fine — **no Go change, no fork delta** (`AGENTS.md` rule 1).

## What already exists (reuse, don't rebuild)

- `scripts/enhance_miniflux.js` — the loop, the API client and the auth are there
- `internal/reader/filter/filter.go` — the engine, unchanged
- `MINIFLUX_URL` / `MINIFLUX_API_KEY` env convention, shared with the other scripts

## Architecture decisions — to be LOCKED before the builder starts

| # | Decision | State |
|---|---|---|
| **D1** | The replacement pattern | **Decided** — `(?i)\b(sponsored\|promoted\|advertisement\|advertorial\|publirreportaje\|patrocinado)\b`. Word-boundaried; the ambiguous stems replaced with the words actually meant; Spanish terms added because roughly half the starter feeds are Spanish-language |
| **D2** | How the loss is measured | **To lock** — block rules are **not retroactive**, so filtered entries were never stored. Either count forward over a polling cycle after the fix (easy, less convincing) or reconstruct from the source feeds (more work, a real number). Pick one before starting |
| **D3** | Hand-tuned feeds | **To lock** — `enhance_miniflux.js` rewrites every feed's rule in a loop. Check whether any feed's block rule was tuned by hand before clobbering it |

## Scope — stories

| Sprint | Story | Risk |
|---|---|---|
| 1 | 1.1 — A pattern that means what it says | low |
| 1 | 1.2 — Applied everywhere, measured honestly | low |

## Definition of Done (epic)
- [ ] Sprint merged to `main` + the script re-run + smoke-tested
- [ ] `sprint-1.md` has its smoke walkthrough
- [ ] This README marked ✅; sprint status ticked with commit refs
- [ ] `RETROSPECTIVE.md` written
- [ ] Product poster updated — 09's "unanchored stems" line corrected
- [ ] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [ ] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
