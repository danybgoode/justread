# Tell the paywall rail once, in the template, correctly — Retrospective

_Closed: 2026-09-15_

## What shipped

**The rail now has one source, and nothing in the repo can quietly write article content again.** Every
article on `app.panfleto.win` shows one rail: archive.ph, archive.is and unwall.app, built by the
template from the entry's own URL. The cron job that appended link blocks into stored content is
gone. A guard in `guards` and pre-push fails any script that tries to do the same.

The high-risk part of the epic, a production cleanup, turned out to have nothing to clean. The workflow had
been disabled for inactivity since 2026-07-21, and the Oracle database starts on 2026-08-27. None of its
32,499 entries carries the appended block.

| Story | What's now true | Ref |
|---|---|---|
| 1.1 | Appender, its workflow and `test_fetch.js` deleted; Actions lists only `guards` | `ce5677a` |
| 1.2 | 0 affected rows in production. No restore or write was needed. The cleanup regex is proven locally and kept | production count, 2026-09-15 |
| 1.3 | `content-write-guard.mjs` runs in `guards.yml` and pre-push, and is tested against the deleted appender's exact code | `c6ede3a`, `9983d41` |
| 2.1–2.2 | The rail links archive.ph · archive.is · unwall.app. The scheme cut lives in `entry.html` with no Go helper (D5). The fork topic commit was amended, the delta is still 12 code files, and `panfleto-core` is pinned at `37d7a7e9` | `a20c21d`, fork `37d7a7e9` · merge `23813b5` · `update.sh` 16:43 UTC |

## What went well

- **Counting before writing.** D4's query took seconds and removed the only irreversible step in the
  epic. The whole restore-rehearse-batch procedure was ready and turned out to be unnecessary.
- **Checking the scope doc's "reuse" list against the fork's delta** caught that `functions.go` isn't
  one of panfleto's files. The template-only link is smaller than the helper it replaces, and it's
  demonstrably safe.
- **The fresh reviewer earned its slot on a HIGH PR with no blocking bugs.** It caught the runnable fixture, the
  public-repo exposure of the leaked key, the self-referential spec, and a deploy order that would have
  left `main` pinning a SHA reachable only through a branch.
- **A share code set and cleared inside a minute** gave an anonymous, real-data smoke of a rendered
  template without a test account.

## What we learned

- **Check which database a script ever ran against before scoping its cleanup.** Production had been
  migrated to a fresh install after the script's last run. A "cleanup" scoped from the script's history
  would have been a HIGH-tier operation on zero rows.
- **`cross-review.mjs` can't see behind a submodule pin.** `gh pr diff` shows one `Subproject commit`
  line, so the reviewer reviews nothing of the fork. Append `git -C panfleto-core diff <old> <new>` to its
  input.
- **In Go's html/template, safety comes from the render-time contextual escaper, not from `untrustedURL`.**
  `untrustedURL` only checks the scheme. After a static `https://host/` prefix, a sliced string can't
  change the origin.
- **Postgres ARE takes a whole regex's greediness from its first quantifier.** A `\s*…(.*?)` cleanup
  pattern turns greedy and swallows everything between the first and last match. Use negated character
  classes instead of `.*?` in `regexp_replace`.
- **Amending a fork topic commit means force-pushing the fork before merging the pin, and tagging both tips.**
  Otherwise `main` pins a SHA reachable only through a branch, and the weekly sync rebuilds from a tip
  that lacks the change.

## Gaps / follow-ups

- **Owed to the product owner:**
  - **The leaked API key.** `scripts/test_fetch.js` (committed `a67dcc3`) sits in a **public** repo's
    history. It isn't a key on production, which has 0 API keys, but the old Render instance
    `miniflux-rss-app.onrender.com` still answers its healthcheck. Revoke the key there, or shut the instance down.
  - The now-unused `MINIFLUX_API_KEY` / `MINIFLUX_URL` Actions secrets can be deleted.
  - Signed-in smoke: sprint 1 steps 2–4, sprint 2 steps 1–6 (clicking through unwall.app, phone width).
- **The unwall link has no Go unit test**, by D5. It's covered by html/template harnesses at build and review
  time and by `e2e/paywall-rail.spec.ts`, which needs `PANFLETO_SHARED_ENTRY` and so skips in CI.
- **The guard is a heuristic.** A request body built far from the call, or an endpoint assembled in
  another module, gets past it.
- **`main` has no branch protection,** so a red `guards` doesn't technically block a merge.
- The rail's inline styles and raw `#BD5FFF` remain design-language debt, out of scope by the contract.
