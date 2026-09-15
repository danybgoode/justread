---
status: shipped
slug: adblock-rule-false-positives
build_order: 2
---

# Epic: The ad-block rule is silently dropping real articles ✅

> **Area:** 01-reading-experience · **Risk:** low · **Class:** Bug · **Scope seed:** [`00-ideas/seeds/adblock-rule-false-positives.md`](../../00-ideas/seeds/adblock-rule-false-positives.md)
>
> **Shipped 2026-09-15** — PR #7 (`4b125ef`). Rule live on all 52 production feeds the same day.

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

> **What the locking pass found instead (2026-09-15).** The premise was worse on paper and harmless in
> practice. The script PUT the rule as `block_rules`, a field Miniflux's API has never had
> (`FeedModificationRequest` only knows `blocklist_rules`), and the API silently ignores unknown JSON
> fields — so the rule never reached a feed through the script. And the script never ran against the
> current production database at all: on 2026-09-15 **no feed of any user had a block rule, and none had
> the crawler on**, which the script also sets. Nothing was being dropped. Had the old rule ever been
> applied, it would have hidden **13,869 of 32,499** stored entries (43%) — every La Jornada and every
> Freakonomics Radio entry among them, because `filter.go` matches the **URL, author and tags** as well
> as the title, and `jornada.com.mx` contains `ad`.

## Platform-first note

Entirely a script + data change. Miniflux's own `internal/reader/filter/filter.go` is the block-rule
engine and is fine — **no Go change, no fork delta** (`AGENTS.md` rule 1).

## What already exists (reuse, don't rebuild)

- `scripts/enhance_miniflux.js` — the loop, the API client and the auth are there
- `internal/reader/filter/filter.go` — the engine, unchanged
- `MINIFLUX_URL` / `MINIFLUX_API_KEY` env convention, shared with the other scripts

## Architecture decisions — locked

| # | Decision | State |
|---|---|---|
| **D1** | The replacement pattern | **Revised at review.** The scaffolded `(?i)\b(sponsored\|promoted\|advertisement\|advertorial\|publirreportaje\|patrocinado)\b` still blocked news: "Leeds promoted to the Premier League", "State-sponsored hackers breach utility", "Evento patrocinado por el gobierno" (found by the fresh reviewer). Shipped: `(?i)^\W*(sponsored\|advertisement\|patrocinado\|contenido patrocinado\|paid post)\b\|\b(advertorial\|publirreportaje)\b\|/(sponsored\|patrocinado)[/-]` — a field that *starts* with an ad label, the two words that only ever mean an ad, or a URL path segment that is the label. Cross-checked in Go RE2 |
| **D2** | How the loss is measured | **Counterfactual over stored entries**, because nothing was ever filtered (see *Why*). Same fields as `filter.go` (URL, title, author, tags), on production, 2026-09-15: **old rule 13,869 / 32,499; new rule 4 / 32,499** — all four genuine 9to5Mac deal posts. Postgres ARE (`\y`) stood in for RE2 `\b`; the difference is only at non-ASCII letters |
| **D3** | Hand-tuned feeds | **None exist** — 0 of 52 feeds carried any block, keep or entry rule. The script still leaves any rule it didn't write alone (trimmed exact match) |
| **D4** | How the rule reaches production feeds | **SQL, reversible — product owner, 2026-09-15.** Production has **0 API keys** and the 52 feeds belong to two non-admin users, so no credential the script could use reaches them; minting keys inside users' accounts was rejected. One `UPDATE feeds SET blocklist_rules = <BLOCK_RULE> WHERE blocklist_rules = ''`, one feed first (#52), byte-identical to the script's constant (md5 `faa1bca8…`). Revert: `UPDATE feeds SET blocklist_rules='' WHERE md5(blocklist_rules)='faa1bca81ece4de8a76b9324180c10bf'` |

## Scope — stories

| Sprint | Story | Risk | Status |
|---|---|---|---|
| 1 | 1.1 — A pattern that means what it says | low | ✅ `4122dba`, `fc72b8c` |
| 1 | 1.2 — Applied everywhere, measured honestly | low | ✅ production, 2026-09-15 (D2, D4) |

## Definition of Done (epic)
- [x] Sprint merged to `main` + the rule applied + smoke-tested (gaps stated in `sprint-1.md`)
- [x] `sprint-1.md` has its smoke walkthrough
- [x] This README marked ✅; sprint status ticked with commit refs
- [x] `RETROSPECTIVE.md` written
- [x] Product poster updated — 09's "unanchored stems" line corrected
- [x] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [x] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
