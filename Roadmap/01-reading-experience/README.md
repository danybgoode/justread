# 01 · Reading experience

**Who it's for:** someone who has already signed up and is here to read.

Everything after login: the entry list, the entry view, how an article's text actually gets onto the
page, what happens when a publisher doesn't want it to, comments, and the reading surfaces
(keyboard, mobile, PWA, themes).

The north star for this domain is **"click an article and it's already there."** No Download button,
no second tab, no bouncing to a paywall. Whatever it takes to make that true — the crawler, a
fallback chain, a prefetch worker — belongs here.

## Current features
See the poster's [01 · Reading experience](../README.md#01--reading-experience) section — it is the
status source of truth, not this page.

## Where the code lives
`panfleto-core/internal/ui/` · `internal/template/templates/views/entry.html` ·
`internal/reader/processor/` · `internal/reader/scraper/` · `internal/reader/sanitizer/`

## Epics

Build order runs top to bottom.

| # | Epic | Status | Risk | Appetite |
|---|---|---|---|---|
| 2 | [`adblock-rule-false-positives`](adblock-rule-false-positives/README.md) — the ad filter is eating real articles | ✅ shipped 2026-09-15 | low | S |
| 3 | [`paywall-rail-single-source`](paywall-rail-single-source/README.md) — tell the rail once, in the template | ✅ shipped 2026-09-15 | high | S |
| 5 | [`spike-unwall-app`](spike-unwall-app/README.md) — how should unwall.app reach the reader? | ✅ shipped 2026-09-15 | low | S |
| 6 | [`article-autofetch`](article-autofetch/README.md) — click an article and it's already there | ✅ shipped 2026-09-15 | high | M |
| 7 | [`inline-comments`](inline-comments/README.md) — read the comments without leaving | ✅ shipped 2026-09-15 | high | M |
| 11 | [`spike-personalized-editorial`](spike-personalized-editorial/README.md) — can the newspaper read one reader's feeds? | ✅ shipped 2026-09-15 | low | S |
| 12 | [`personalized-edition`](personalized-edition/README.md) — your own feeds, as a newspaper | 📋 scaffolded | **high** | M |

**Dependencies:** **12 must not start before `03-agent-surface/mcp-token-handling` (#10)** — it consumes the per-user Miniflux key that #10 fixes (see the spike's D2); `ci-build-pipeline` (#8) should also land first, since 12 adds Vercel↔VM coupling. Wave 3 of that programme is seed `editorial-ranking-tuning` (#13), unscaffolded on purpose until 12 has run with real readers. The spike (5) blocks story 2.2 of autofetch (6). Both 6 and 7 patch the fork, so
both wait for `09-platform-infra/miniflux-upstream-resync` — building either first means replaying a
moving delta. 2 and 3 depend on nothing and can start today.
