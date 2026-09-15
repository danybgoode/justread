---
title: "Tell the paywall rail once, in the template, correctly"
slug: paywall-rail-single-source
status: scaffolded
area: "01"
type: chore
priority: wave-2026-09-panfleto
appetite: S
underwritten_by: null
risk: high
epic: "01-reading-experience/paywall-rail-single-source"
build_order: 3
updated: 2026-09-15
---

# Pitch — Tell the paywall rail once, in the template, correctly

> **Archetype: Sweeper.** Acceptance is *less code, same behaviour, no regressions* — plus proving
> the old path is unreachable and guarding against its return.

## Problem
The paywall-bypass rail is currently told **twice**, and one of the two tellings writes to the
production database.

1. `internal/template/templates/views/entry.html:290–298` renders the rail on every article view.
   This is correct: presentation in a template, computed fresh from `.entry.URL`.
2. `scripts/archive_appender.js`, run **every 3 hours by a GitHub Action**, fetches up to 100 unread
   entries and `PUT`s `content + appendHtml` back over the API — permanently appending the same link
   block into stored article content.

The second one is wrong in four separate ways:

- It is an **irreversible, unattributable edit to the reader's own data** (`AGENTS.md` rule 2).
- It **duplicates** what the template already renders, so affected entries show the rail twice.
- Its idempotence guard is `content.includes("archive.ph")`, which **breaks the moment anything
  replaces content** — exactly what `article-autofetch` is about to start doing. Scraper overwrites,
  guard passes, block gets appended again.
- Every entry it has already touched now carries **hardcoded Txtify.it and Wayback links** that will
  outlive removing them from the template.

And the rail itself is out of date: Txtify.it and Wayback are being dropped in favour of
`unwall.app`, which renders behind more paywalls than either.

## Appetite
**S** — one builder session for the code, plus a supervised production cleanup pass. The cleanup is
what makes this HIGH tier, not the size.

## Lane
**Fixed scope.** A known defect with a known fix; no betting table.

## Outcome & signal
The rail exists in exactly one place, is correct, and nothing outside Miniflux writes to
`entries.content` ever again.

**Test:** open any article on `app.panfleto.win` — one rail, four correct links, no duplicate block
at the bottom of the article body. Check an article from before the cleanup: same.

## Stage-2.5 bucket
**light-enhancement** — the template already renders the rail. This is deleting a thing and editing
four lines, plus a data migration.

## Bill of materials (What / Why)

| What | Why |
|---|---|
| Delete `scripts/archive_appender.js` + `.github/workflows/archive_appender.yml` | The mutation has to stop before the cleanup, or it re-dirties what was just cleaned |
| One-time cleanup pass over `entries.content` | Injected HTML outlives the script; without this, old articles keep showing dead Txtify links forever |
| `stripScheme` template function | `unwall.app`'s format is `unwall.app/{host}{path}` — the template only has a full URL, and string-munging in a template is how you get an XSS |
| Rail rewritten: archive.ph · archive.is · **unwall.app** | Drops the two that rarely work, adds the one that does |
| A guard: `enhance_miniflux.js`-style scripts may not `PUT` `content` | Rule 2 is only a rule if something checks it |

## Scope
**In v1:** the deletions; the cleanup pass; the `stripScheme` helper and the rewritten rail block; a
test for `stripScheme`; a note in `AGENTS.md`'s rule 2 pointing at this seed as the worked example.

**Out of v1 (no-gos):**
- Rendering unwall.app *content* inside the reader. That is `spike-unwall-app` → `article-autofetch`.
  This slice only changes the **links**.
- Any change to the "Save Panflo" link that shares the rail's container.
- Restyling the rail. It uses inline styles today; that is design-language debt, noted below, not
  this slice's job.

## Rabbit holes
- **The cleanup pass is a production write and there is no staging.** It must run against a
  **verified-restorable** backup, on a `LIMIT`ed batch first, with the exact matched HTML printed
  before anything is updated. The injected block is bounded by `<hr/><p><strong>🔓 Paywall Bypass:`
  and the closing `</p>`, which is distinctive enough to match safely — verify that on real rows
  before trusting it.
- **Some entries may have been appended more than once** (the guard fails whenever content changed
  between runs). The cleanup has to strip *all* occurrences, not the first.
- **Doing it over the API vs. in SQL.** The API path is safer (goes through Miniflux, one entry at a
  time, respects the model) but slow and rate-limited by the reader itself. SQL is fast and
  irreversible. Decide at the architecture lock, not mid-build.
- **`entry.URL` is already `untrustedURL`-escaped in the template.** `stripScheme` must not undo
  that — it takes the parsed host and path, not a string slice of the raw URL.

## What already exists (reuse, don't rebuild)
- `internal/template/templates/views/entry.html:290–298` — the rail block, already ours (one of the
  12 delta files, so editing it costs no new rebase tax)
- `internal/template/functions.go` — where `untrustedURL`, `queryString` and the other template
  helpers live; `stripScheme` belongs beside them
- `internal/urllib/url.go` — URL parsing helpers already in the fork
- `deploy/backup.sh` + the `panfleto-backups` bucket — the restore path the cleanup depends on

## UX heuristics & rails check
- **CI guards covering this surface:** `guards.yml` covers `scripts/**` tests; nothing guards
  template changes or content writes. The "no `PUT` on content" guard in the bill of materials is
  the new rail this slice adds.
- **Audits-lens findings that apply:** none yet
- **Design-language debt:** the rail block is styled with **inline `style=` attributes and a raw hex
  `#BD5FFF`** on the Save Panflo link, rather than the theme's CSS custom properties. Noted, not
  fixed here.

## Kill-switch / runtime gate (risk:high — Stage 6b)
**Carve-out.** There is no runtime seam to gate and no flag provider in panfleto (see
`article-autofetch`, which hits the same wall). The two risky acts are a **one-time data cleanup**
and a **template edit**:
- The cleanup's reversibility mechanism is the **verified restore**, not a flag — it runs against a
  backup restored and checked beforehand, in batches, with output inspected between batches.
- The template edit is reverted by `git revert` + `update.sh`, which is the whole rollback story on
  this rail anyway.

## Acceptance criteria
1. The archive-appender workflow no longer appears under Actions, and the script is gone.
2. An article last touched by the appender shows **no** injected block in its body.
3. Every article shows exactly one rail, linking archive.ph, archive.is and unwall.app.
4. The unwall.app link for `https://www.nytimes.com/2026/09/14/us/politics/x.html` resolves to
   `https://unwall.app/www.nytimes.com/2026/09/14/us/politics/x.html`.
5. `stripScheme` has a unit test covering http, https, a URL with a query string, and a malformed URL.
6. The product owner has confirmed 2–4 on `app.panfleto.win` after deploy.

## Open risks / research
- **How many entries are affected is unknown.** `SELECT count(*) FROM entries WHERE content LIKE
  '%Paywall Bypass%'` is the first thing the architect should run — it decides whether this is a
  five-minute pass or a batched job.
- unwall.app's availability and rate limits are **unverified** — see `spike-unwall-app`. This slice
  only adds a link, so a flaky unwall.app degrades to a dead link rather than a broken reader, which
  is why the link change doesn't have to wait for the spike.
