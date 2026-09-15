---
title: "An edition, not a river with quotas"
slug: editorial-ranking-tuning
status: ready
area: "01"
type: feature
priority: null
appetite: M
underwritten_by: null
risk: low
epic: null
build_order: 13
updated: 2026-09-15
---

# Pitch — An edition, not a river with quotas

> **Wave 3 of the programme `spike-personalized-editorial` sized. Not bet yet** — it is deliberately
> left unscaffolded until `personalized-edition` has run with real readers, because tuning a ranking
> before anyone reads it daily is guessing.

## Problem
The spike rendered a real edition and the product owner read it. The verdict was **worth reading with
tuning**, and the spike's own data says exactly where the tuning is:

- **Only 13 of 1,067 stories carried any signal besides recency.** By slot 7 the signals are used up,
  and the page went to a Guardian theatre review because it was 24 minutes old.
- **20 of the 29 stories on the page were there on recency alone** — so below the top five it reads as
  "the last half hour, one per feed". That is a river with quotas, not an edition.
- **Dedupe is precise but narrow.** It merged 7 of the 10 "US weapons in space" headlines and left
  TechCrunch, NYT and FT separate. It cannot match Spanish and English coverage of the same event —
  which matters a lot for a mixed EN/ES readership.
- **HN comment counts cover 4% of the day and cost one API call each.** 90 entries had a
  `comments_url`; only the 49 Hacker News ones resolve to a count.
- **Volume is skewed hard.** El Economista posted 200 entries that day, The Guardian 170, BBC 146.

## Appetite
**M** — one wave. This is a judgement-heavy loop (change, render, read, decide), so the circuit breaker
matters: if the page still isn't an edition when the appetite is spent, that is the finding, and the
LLM pass becomes the honest next bet rather than more tuning.

## Outcome & signal
A reader opens their edition and every story on the page is there for a reason they could name. The
product owner tests it the same way D3 was tested: read the whole page, not just the top.

## Stage-2.5 bucket
**Light enhancement** in mechanism — no new surface, no new dependency, no auth. All of it is inside
the ranking and the page's length. The weight is in the judgement, not the build.

## Rough shape — four moves, cheapest first
1. **Make the page shorter.** 8–12 stories where every slot carries a signal beats 29 where two thirds
   don't. Probably the biggest single improvement, and it is a length constant.
2. **Widen dedupe to rewordings and across languages.** Corroboration is the strongest non-recency
   signal, so every miss costs a slot. Cross-language matching is the interesting part and the most
   likely rabbit hole.
3. **Decide the HN dependency.** 4% coverage for one call per story — either cache it with the edition
   or cut it. Don't leave a per-render external call in for a twentieth of the page.
4. **Find one more intrinsic signal, or accept recency below the fold.** Candidates: entry length as a
   proxy for a real piece vs. a brief; a feed's own posting rate (a story from a 2-a-day feed is worth
   more than one from a 200-a-day feed); whether the reader has historically opened that feed.

## Scope
**In v1:** the four moves above, judged against real editions from at least two accounts.
**Out of v1 (no-gos):** the LLM categorize-and-rank pass (still unbet, in the funnel); any per-user
learning/personalization model; sections, search and archive on the personalized side; anything
touching auth or the cache contract from wave 2.

## Rabbit holes
- **Cross-language dedupe is a research problem wearing a chore's clothing.** Time-box it. If it
  doesn't fall out cheaply, ship same-language dedupe and note it.
- **Tuning without reading.** Every change is judged by rendering an edition and reading it, not by a
  metric. A ranking that scores better and reads worse is worse.
- **One account is not evidence.** The spike used user 2 (39 feeds, heavy Spanish/English mix). Tune
  against at least one more account with a different shape, or you fit to one reader.

## What already exists (reuse, don't rebuild)
The v1 ranker shipped in `personalized-edition` sprint 3, and the spike's rendered edition + its
findings in [`spike-personalized-editorial/README.md`](../../01-reading-experience/spike-personalized-editorial/README.md) → D3.

## UX heuristics & rails check
- **CI guards covering this surface:** the deterministic gate only; ranking quality is not
  machine-checkable, which is why the acceptance is a read, not a metric.
- **Audits-lens findings that apply:** none.
- **Design-language debt:** a shorter page changes the front-page grid's assumptions — check it against
  the Editorial components rather than forcing the layout.

## Acceptance criteria
1. Reading the whole page, every story is there for a nameable reason.
2. A story covered by several publishers appears once, including when the headlines are reworded, and
   ideally across Spanish and English.
3. No per-render external call remains for a signal covering a small fraction of the page.
4. Verified on at least two accounts with different feed shapes.

## Open risks / research
- **Depends on `personalized-edition` having run with real readers.** Bet at the wave boundary after
  it, not before.
- **If this wave's appetite is exhausted and the page still isn't an edition**, the LLM pass is the
  honest next bet — priced then, with a kill-switch, not assumed now.
