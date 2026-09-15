---
status: scaffolded
slug: paywall-rail-single-source
build_order: 3
---

# Epic: Tell the paywall rail once, in the template, correctly

> **Area:** 01-reading-experience · **Risk:** high · **Class:** Chore · **Archetype:** Sweeper · **Scope seed:** [`00-ideas/seeds/paywall-rail-single-source.md`](../../00-ideas/seeds/paywall-rail-single-source.md)

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

## Platform-first note

No new primitive, and no Go beyond one template helper. `entry.html` is already one of the fork's own
delta files, so editing it costs no new rebase tax (`AGENTS.md` rule 1). The cleanup is a data
operation, not a feature.

## What already exists (reuse, don't rebuild)

- `internal/template/templates/views/entry.html:290–298` — the rail block, already ours
- `internal/template/functions.go` — where `untrustedURL` and friends live; `stripScheme` belongs beside them
- `internal/urllib/url.go` — URL parsing helpers already in the fork
- `deploy/backup.sh` + the `panfleto-backups` bucket — the restore path S1 depends on

## Architecture decisions — to be LOCKED before any builder starts

| # | Decision | State |
|---|---|---|
| **D1** | Rail becomes archive.ph · archive.is · **unwall.app**; Txtify.it and Wayback are dropped | **Decided** — product owner 2026-09-14 |
| **D2** | This epic changes **links only**, not rendering. Rendering unwall.app content is `article-autofetch` S2 | **Decided** |
| **D3** | Cleanup runs over the API or in SQL | **To lock** — API is safer and slower, SQL is fast and irreversible. Decide before S1, not mid-build |
| **D4** | Blast radius | **To lock** — run `SELECT count(*) FROM entries WHERE content LIKE '%Paywall Bypass%'` **first**. That number decides whether S1 is five minutes or a batched job |

## Not blocked on the spike

`spike-unwall-app` does **not** block this epic. Adding a link degrades to a dead link if unwall.app
is flaky — it cannot break the reader. Only `article-autofetch` S2, which *fetches* from unwall.app,
needs the spike's decision.

## Scope — stories

| Sprint | Story | Risk |
|---|---|---|
| 1 | 1.1 — Stop the mutation | low |
| 1 | 1.2 — Clean up what it left behind | high |
| 1 | 1.3 — A guard so it can't come back | low |
| 2 | 2.1 — A stripScheme template helper | low |
| 2 | 2.2 — One rail, correct links | low |

## Deploy order

**S1 before S2, and 1.1 before 1.2 inside it.** The mutation has to stop before the cleanup, or the
Action re-dirties what was just cleaned. S2 is a template change and deploys normally.

## Kill-switch (risk:high — Stage 6b)

**Carve-out.** There is no runtime seam and panfleto has no flag provider. The two risky acts have
their own reversibility mechanisms:

- The **cleanup** is reversed by the verified restore, not a flag — it runs against a backup that was
  restored and checked beforehand, in batches, with output inspected between batches.
- The **template edit** is reversed by `git revert` + `update.sh`, which is this rail's whole rollback
  story regardless.

## Definition of Done (epic)
- [ ] All sprints merged to `main` + deployed + smoke-tested (gaps stated)
- [ ] Each `sprint-N.md` has its smoke walkthrough (real URLs)
- [ ] This README marked ✅; every sprint status ticked with commit refs
- [ ] `RETROSPECTIVE.md` written
- [ ] Product poster updated — 01's rail line names the new link set; 09's "Content mutation in production" ❌ line is **removed**
- [ ] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [ ] `AGENTS.md` rule 2 keeps this epic as its worked example, with the final entry count
- [ ] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
