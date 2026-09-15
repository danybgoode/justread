---
title: "The ad-block rule is silently dropping real articles"
slug: adblock-rule-false-positives
status: scaffolded
area: "01"
type: bug
priority: wave-2026-09-panfleto
appetite: S
underwritten_by: null
risk: low
epic: "01-reading-experience/adblock-rule-false-positives"
build_order: 2
updated: 2026-09-15
---

# Bug — The ad-block rule is silently dropping real articles

## Reproduction
`scripts/enhance_miniflux.js` applies this as a global Miniflux block rule to every feed:

```
(?i)(sponsor|sponsored|ad|promotion|deal|sale|discount|oferta)
```

Nothing in it is anchored. Miniflux block rules are unanchored regex matches against the entry
title, so every one of these is currently blocked:

| Blocked headline fragment | Matches on |
|---|---|
| "The **lead**er of…", "Party **lead**ership" | `ad` inside *leader* |
| "Ro**ad**map", "Bro**ad**cast", "Ahe**ad** of…", "Trinid**ad**" | `ad` |
| "The **deal**er", "I**deal**ism", "**Deal**t with" | `deal` |
| "Whole**sale**", "**Sale**m", "Ver**sale**s" | `sale` |

**Where it diverges from the promise:** the poster and the repo README both say ad filtering "keeps
sponsored posts out of Unread". It also keeps an unknown fraction of real news out of Unread, and
because it is a *block* rule there is no log, no counter and no UI surface — the reader simply never
sees those articles and has no way to know.

## Root cause
Not a regression. The rule was written as a keyword list and never converted to a matching pattern:
the stems `ad`, `deal` and `sale` are substrings of extremely common English and Spanish words, and
`(?i)(…)` with no `\b` matches anywhere in the title. `promotion` and `discount` are long enough to
be mostly safe; `ad`, `deal`, `sale` are not.

## Appetite
**S** — one builder session. Fix the pattern, re-apply it, measure what comes back.

## Lane
**Fixed scope** — a well-specified bug. No betting table; straight to a builder.

## The fix
```
(?i)\b(sponsored|promoted|advertisement|advertorial|publirreportaje|patrocinado)\b
```
Word-boundaried, and the ambiguous stems replaced by the words actually meant. Spanish terms added
because roughly half the starter feeds are Spanish-language (`jornada.com.mx`, `elpais.com`).

## Scope
**In v1:** the corrected pattern; re-applying it across every feed via the API; a before/after count
of how many of the last N entries the old rule would have blocked and the new one doesn't; a
regression note in `scripts/enhance_miniflux.js` explaining why the stems are gone, so nobody
"helpfully" shortens them again.

**Out of v1 (no-gos):**
- Rebuilding ad filtering as a feature (a per-user setting, a UI, a blocked-items view). That is a
  different, larger ask.
- Touching the categorisation half of `enhance_miniflux.js`.
- Any change to `panfleto-core/` — this is entirely a script + API change, per `AGENTS.md` rule 1.

## Rabbit holes
- **Block rules are not retroactive.** Fixing the pattern does not resurrect entries already
  filtered out at ingest — they were never stored. The measurement therefore has to be run *forward*
  (count over a polling cycle after the fix), or reconstructed from the source feeds. Decide which
  before starting; reconstructing is the more convincing number but the more work.
- **Miniflux block rules are per-feed, not global.** `enhance_miniflux.js` applies the same string to
  every feed in a loop. Re-running it rewrites all of them, so it must be idempotent and must not
  clobber any feed whose rule was tuned by hand.

## What already exists (reuse, don't rebuild)
- `scripts/enhance_miniflux.js` — the loop, the API client and the auth are already there
- Miniflux's own `internal/reader/filter/filter.go` — the block-rule engine; no code change needed
- `MINIFLUX_URL` / `MINIFLUX_API_KEY` env convention, already used by both scripts

## UX heuristics & rails check
- **CI guards covering this surface:** `guards.yml` runs `scripts/` node:test — but
  `enhance_miniflux.js` has **no tests**. A pattern like this one is exactly what a unit test of
  "these titles match / these don't" would have caught. Add it with the fix.
- **Audits-lens findings that apply:** none yet
- **Design-language debt:** n/a

## Acceptance criteria
1. Given the headline "Party leadership contest narrows to two", the rule does **not** block it.
2. Given "Sponsored: the best laptops of 2026", the rule **does** block it.
3. Given "Contenido patrocinado por…", the rule **does** block it.
4. A test file asserts both directions and runs under `node --test`.
5. The product owner can see a before/after number for how much was being lost.

## Open risks / research
Low risk, but it is a **write to every feed's configuration** via an admin API key. Run it against
one feed first and diff the result before looping.
