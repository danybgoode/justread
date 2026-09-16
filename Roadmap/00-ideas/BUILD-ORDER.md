<!-- GENERATED FILE — do not edit by hand.
     Regenerate:  node scripts/build-order.mjs
     Status SSOT: each epic README's frontmatter `status:` field (set at epic close). Funnel
     ordering: seed frontmatter (priority). Both projected via scripts/roadmap-to-notion.mjs --extract. -->

# Build order — generated status board

> **Generated 2026-09-16 — do not hand-edit.** Epic status SSOT = the epic `README.md` frontmatter
> `status:` field (set at epic close). To change what this shows, edit that field (or a seed for the
> funnel), then run `node scripts/build-order.mjs`. This board and the Notion "Marketplace Roadmap"
> DB are both *derived views* — never hand-edit the board.

## 🏗️ Building now (1)

- [MCP tokens shouldn't travel in query strings](../../03-agent-surface/mcp-token-handling/README.md) — 03 Agent surface · 0/4 stories · risk: High

## 📋 Ready to build (scaffolded, not started) (1)

- [Your own feeds, as a newspaper](../../01-reading-experience/personalized-edition/README.md) — 01 Reading experience · 0/9 stories · risk: High

## ✅ Shipped (9)

- [Can the newspaper read one reader's feeds? ✅](../../01-reading-experience/spike-personalized-editorial/README.md) — 01 Reading experience · 6/6 stories · risk: Low
- [Click an article and the content is already there ✅](../../01-reading-experience/article-autofetch/README.md) — 01 Reading experience · 7/7 stories · risk: High · wave-2026-09-panfleto
- [How should unwall.app reach the reader? ✅](../../01-reading-experience/spike-unwall-app/README.md) — 01 Reading experience · 2/2 stories · risk: Low · wave-2026-09-panfleto
- [Read the comments without leaving the reader ✅](../../01-reading-experience/inline-comments/README.md) — 01 Reading experience · 3/3 stories · risk: High · wave-2026-09-panfleto
- [Tell the paywall rail once, in the template, correctly ✅](../../01-reading-experience/paywall-rail-single-source/README.md) — 01 Reading experience · 5/5 stories · risk: High · wave-2026-09-panfleto
- [The ad-block rule is silently dropping real articles ✅](../../01-reading-experience/adblock-rule-false-positives/README.md) — 01 Reading experience · 2/2 stories · risk: Low · wave-2026-09-panfleto
- [A new signup should not be a coin flip ✅](../../02-onboarding-and-signup/onboarding-provisioning-reliability/README.md) — 02 Onboarding & signup · 2/2 stories · risk: Low
- [Put panfleto-core back on upstream's timeline ✅](../../09-platform-infra/miniflux-upstream-resync/README.md) — 09 Platform & Infra · 9/9 stories · risk: High · wave-2026-09-panfleto
- [Stop compiling Go on the production VM ✅](../../09-platform-infra/ci-build-pipeline/README.md) — 09 Platform & Infra · 4/4 stories · risk: High

## ⬜ Funnel — seeds not yet scaffolded (1)

- [An edition, not a river with quotas](seeds/editorial-ranking-tuning.md) — Ready · Feature · appetite M

## ⚠️ Status drift — README frontmatter vs sprint/retro-derived (1)

These epics’ authoritative README-frontmatter `status:` disagrees with what the sprint/retro
derivation infers. The board trusts the **frontmatter**; a mismatch usually means a close-out
forgot to set `status:` (or the README is stale). Reconcile the README, then this advisory clears.

| Epic | frontmatter (used) | sprint/retro-derived |
|---|---|---|
| MCP tokens shouldn't travel in query strings | In progress | Scaffolded |

---
_Epics: 11 · seeds in funnel: 1 · status drift: 1. Regenerate with `node scripts/build-order.mjs`._
