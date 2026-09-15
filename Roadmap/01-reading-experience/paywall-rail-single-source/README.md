---
status: shipped
slug: paywall-rail-single-source
build_order: 3
---

# Epic: Tell the paywall rail once, in the template, correctly ✅

> **Area:** 01-reading-experience · **Risk:** high · **Class:** Chore · **Archetype:** Sweeper · **Scope seed:** [`00-ideas/seeds/paywall-rail-single-source.md`](../../00-ideas/seeds/paywall-rail-single-source.md)
>
> **Shipped 2026-09-15** — PR #8 (merge `23813b5`), deployed with `update.sh` at 16:43 UTC; `panfleto-core` pinned at `37d7a7e9`.

## Why

The paywall-bypass rail is told **twice**, and one of the two tellings writes to the production
database every three hours. `entry.html` renders it correctly from the template; a GitHub Action runs
`scripts/archive_appender.js`, which fetches up to 100 unread entries and `PUT`s
`content + appendHtml` back over the API — permanently appending the same link block into stored
article content. That is an irreversible, unattributable edit to the reader's own data, it duplicates
what the template already shows, and every entry it has touched carries hardcoded Txtify.it and
Wayback links that will outlive removing them from the template.

Sweeper acceptance: **less code, same behaviour, no regressions** — plus proof the old path is
unreachable and a guard against its return.

> **What the locking pass found (2026-09-15).** The mutation had already stopped, and it never touched
> the current database. GitHub disabled the workflow for inactivity after its last run on 2026-07-21
> (`disabled_inactivity`); the production database on the Oracle VM begins on 2026-08-27. Production
> holds **0** entries containing the block, Txtify.it, `archive.ph/newest` or the Wayback prefix. The
> appender's writes landed on the earlier Render-hosted instance, which is still up.

## Platform-first note

No new primitive, and no Go at all — the scheme cut lives in the template (D5). `entry.html` is already
one of the fork's own delta files, so editing it costs no new rebase tax (`AGENTS.md` rule 1). The
cleanup is a data operation, not a feature.

## What already exists (reuse, don't rebuild)

- `internal/template/templates/views/entry.html:290–298` — the rail block, already ours
- `internal/template/functions.go` — where `untrustedURL` and friends live (**not** a delta file — see D5)
- `internal/urllib/url.go` — URL parsing helpers already in the fork
- `deploy/backup.sh` + the `panfleto-backups` bucket — the restore path S1 depends on

## Architecture decisions — locked

| # | Decision | State |
|---|---|---|
| **D1** | Rail becomes archive.ph · archive.is · **unwall.app**; Txtify.it and Wayback are dropped | **Decided** — product owner 2026-09-14. Shipped |
| **D2** | This epic changes **links only**, not rendering. Rendering unwall.app content is `article-autofetch` S2 | **Decided**. Held |
| **D3** | Cleanup runs over the API or in SQL | **Moot** — D4 is zero, so there is nothing to write. (Had there been rows: SQL, rehearsed on a restored dump — the API path would itself be a script PUTting content, which story 1.3's guard forbids, and it re-sanitises the whole body) |
| **D4** | Blast radius | **0 rows**, production, 2026-09-15 — `content LIKE '%Paywall Bypass%'`, `ILIKE '%txtify.it%'`, `'%archive.ph/newest%'`, `'%web.archive.org/web/2/%'` all zero across 32,499 entries. No restore and no write were needed; story 1.2 closes on the count. The cleanup regex was still built and proven on a local copy (strips every occurrence, leaves text intact) — kept in `sprint-1.md` for the Render instance |
| **D5** | Where `unwall.app/{host}{path}` is built | **In `entry.html`, no Go helper** — deviation from the scaffold, decided at build. `functions.go` is not a fork-delta file, so `stripScheme` would have grown the delta. The template cuts `https://`/`http://` with `startsWith` + `slice`; html/template's contextual escaper still escapes the remainder, and the `https://unwall.app/` origin is static, so no entry URL can change the link's scheme or host (verified with hostile inputs by the builder and the fresh reviewer). The scaffold's worry — slicing "undoes the untrustedURL escaping" — does not hold: `untrustedURL` only checks the scheme; escaping happens at render. Non-http(s) URLs get no unwall link |
| **D6** | The fork change and the pin | The existing `panfleto: reader link rail` topic commit was amended (autosquash), not stacked on. Fork `panfleto` was force-pushed to the reviewed `37d7a7e9` **before** the merge, so `main` never pinned a SHA reachable only through a branch. Old tip tagged `pre-paywall-rail`, new one `paywall-rail-s2` |

## Not blocked on the spike

`spike-unwall-app` does **not** block this epic. Adding a link degrades to a dead link if unwall.app
is flaky — it cannot break the reader. Only `article-autofetch` S2, which *fetches* from unwall.app,
needs the spike's decision.

## Scope — stories

| Sprint | Story | Risk | Status |
|---|---|---|---|
| 1 | 1.1 — Stop the mutation | low | ✅ `ce5677a` |
| 1 | 1.2 — Clean up what it left behind | high | ✅ nothing to clean — 0 rows (D4) |
| 1 | 1.3 — A guard so it can't come back | low | ✅ `c6ede3a`, `9983d41` |
| 2 | 2.1 — A stripScheme template helper | low | ✅ replaced by D5 — no helper |
| 2 | 2.2 — One rail, correct links | low | ✅ `a20c21d` (fork `37d7a7e9`) |

## Deploy order

**S1 before S2, and 1.1 before 1.2 inside it.** The mutation has to stop before the cleanup, or the
Action re-dirties what was just cleaned. S2 is a template change and deploys normally.

As run: fork force-push → merge #8 (workflow file leaves `main`) → D4 = 0, no cleanup → `update.sh`
16:43 UTC → live confirmation (health spec 7/7; rail spec on a production entry via a share code set
and cleared within the minute).

## Kill-switch (risk:high — Stage 6b)

**Carve-out.** There is no runtime seam and panfleto has no flag provider. The two risky acts have
their own reversibility mechanisms:

- The **cleanup** is reversed by the verified restore, not a flag — it runs against a backup that was
  restored and checked beforehand, in batches, with output inspected between batches. *(Not exercised:
  zero rows.)*
- The **template edit** is reversed by `git revert` + `update.sh`, which is this rail's whole rollback
  story regardless. The previous pin `804e6dfc` stays fetchable through the `pre-paywall-rail` tag.

## Definition of Done (epic)
- [x] All sprints merged to `main` + deployed + smoke-tested (gaps stated)
- [x] Each `sprint-N.md` has its smoke walkthrough (real URLs)
- [x] This README marked ✅; every sprint status ticked with commit refs
- [x] `RETROSPECTIVE.md` written
- [x] Product poster updated — 01's rail line names the new link set; 09's "Content mutation in production" ❌ line is **removed**
- [x] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [x] `AGENTS.md` rule 2 keeps this epic as its worked example, with the final entry count
- [x] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
