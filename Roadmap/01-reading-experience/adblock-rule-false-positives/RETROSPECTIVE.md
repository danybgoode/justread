# The ad-block rule is silently dropping real articles — Retrospective

_Closed: 2026-09-15_

## What shipped

**panfleto now filters ads for the first time, and only ads.** The bug as scoped, a stem list quietly
eating news, turned out never to have reached a single feed. The script sent the rule in a field the
API ignores, and it had never run against this database. The rule it would have applied matches
43% of everything stored (13,869 of 32,499 entries), including every La Jornada and Freakonomics
article, because Miniflux matches entry URLs as well as titles. What's live now is a label-shaped rule
on all 52 production feeds. On the same data it blocks 4 entries, all 9to5Mac deal posts.

| Story | What's now true | Ref |
|---|---|---|
| 1.1 | `enhance_miniflux.js` writes `blocklist_rules` with a label-shaped pattern. It leaves hand-tuned rules alone, only PUTs what changed, has `--rules-only`/`--dry-run`/`--feed`, and a 32-case table test runs in `guards` | PR #7: `4122dba`, `fc72b8c` · merge `4b125ef` |
| 1.2 | 52/52 production feeds carry the rule, applied in SQL by product-owner decision (D4), one feed first, byte-checked against the script's constant | production, 2026-09-15 |

## What went well

- **Querying production before believing the scope doc turned the epic around.** The questions were "how
  many hand-tuned rules?" and "how much was lost?". The answer to both was zero, and that led straight to the
  real defect (a silently ignored field) and to a measurement that means something.
- **The fresh reviewer caught the scaffolded fix repeating the bug.** "Leeds promoted to the Premier
  League" and "State-sponsored hackers" were blocked by the word-boundaried pattern the scope doc had
  marked *Decided*. The same review found CI red for an unrelated reason (axios loaded at import).
- **Cross-checking the JS test table in Go's RE2** kept the tests honest about the engine that
  actually runs the rule.

## What we learned

- **An API that ignores unknown JSON fields makes a wrong field name look like a successful write.**
  `PUT /v1/feeds/{id}` with `block_rules` returned 200 and changed nothing, for months. Read back what
  you wrote, or assert the payload's field names against the model.
- **A pattern applied to URLs as well as titles needs URL cases in its tests.** The worst damage the old
  rule would have done was to whole feeds, through their domain names. No title-only test would show it.
- **Word boundaries are not the same as meaning.** `sponsored` and `promoted` are ordinary news words. An ad
  filter has to match the *label shape* (a field that starts with the label, a URL segment), not the word.
- **A script that holds one user's API key can only reach that user's feeds.** "Applied to every feed"
  was never possible for this script on a multi-user install.

## Gaps / follow-ups

- **Feeds added after 2026-09-15 don't get the rule.** That includes new signups' starter feeds, because
  onboarding doesn't set block rules. Options: a user-level `block_filter_entry_rules` default set at
  onboarding (a fork-delta change, rule 1), or re-running the SQL/script periodically. Not decided.
- **Owed to the product owner:** smoke steps 1–4 (signed in: the rule in a feed's settings, La
  Jornada in Unread, no new sponsored 9to5Mac post).
- **The measurement is a counterfactual on stored entries.** It is a lower bound on what the new rule
  will block. Sponsored posts that feeds publish in the future will show up only in the feeds themselves,
  because blocked entries are never stored.
- `enhance_miniflux.js` still forces `crawler: true` and re-categorises unless `--rules-only` is passed.
  That's the categorisation half, left alone by scope.
