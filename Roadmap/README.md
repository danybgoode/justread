# panfleto — Product Roadmap & Feature Poster

> **Mission:** give people back a reading experience they control — their feeds, in the order they
> happened, with the article already there. Zero algorithms, zero ads, zero distractions, $0/month.

This folder is the **product source of truth**. It speaks in plain product language for product,
design, and business — **no engineering or tech specs here** (those live in `AGENTS.md`, the code,
and each epic's `RETROSPECTIVE.md`).

---

## How this roadmap is organized

```
Roadmap/
├── README.md                ← you are here · the product poster (all features)
├── WAYS-OF-WORKING.md       ← how we plan, build, ship (scrum cadence) + tooling
├── LEARNINGS.md             ← the cross-cutting retro digest, read at every session start
├── SESSION-KICKOFFS.md      ← thin-pointer prompt cheat sheet for starting a session
├── 00-ideas/                ← the idea funnel (seeds, audits, the generated BUILD-ORDER.md)
├── bets/                    ← one file per wave: bets placed, appetite, what each displaced
└── <Macro-section>/         ← a product domain (a journey, not a component)
    ├── README.md            ← what this area is, for whom, current features
    └── <Epic>/              ← a meaningful body of work
        ├── README.md        ← the epic's product overview
        ├── sprint-N.md      ← the sprint's user stories (As a… I want… so that…)
        └── RETROSPECTIVE.md ← what we learned
```

**Levels:** `Roadmap → Macro-section → Epic → Sprint → User Story`. Each user story is a small,
independently shippable slice of value.

---

## The macro-sections (product domains)

| # | Macro-section | Covers |
|---|---|---|
| 01 | **Reading experience** | The reader itself: the entry list and entry view, how an article's content gets there, paywalls, comments, keyboard and mobile reading, themes. Everything a reader touches after they log in. |
| 02 | **Onboarding & signup** | Getting from "never heard of it" to "reading": the landing page, registration and Auth0 SSO, the starter feeds a new account arrives with, welcome email, and feed discovery. |
| 03 | **Agent surface** | panfleto inside an AI assistant: the MCP endpoint, its tools, token provisioning and the connector panel. The non-human way to read. |
| 09 | **Platform & Infra** | Engineering work that isn't a user-facing product domain — the Miniflux fork and its upstream sync, deploy pipeline, CI guards, backups, feed-enhancement scripts, cross-cutting process. (Reserving `09` for platform/infra is a deliberate convention carried from the project template; keep the number stable so tooling that reads it needs no per-project config.) |

---

## Feature map

> Convention: **✅ means enforced in code**, not merely intended. Partial or aspirational is 🚧.
> Updating this page is part of the epic Definition of Done (see WAYS-OF-WORKING.md).

### 01 · Reading experience
- ✅ Miniflux reader at `app.panfleto.win` — entry list, entry view, star, share, keyboard shortcuts, PWA install
- ✅ New accounts read newest-first and land on Feeds, not Unread
- ✅ Paywall-bypass link rail on every article (archive.ph · archive.is · unwall.app), told once, by the template
- ✅ **Ad filtering** — every feed that existed on 2026-09-15 carries a block rule that matches ad *labels* ("Sponsored:", "Contenido patrocinado", `/sponsored/`), not ad words; on stored entries it blocks 4 of 32,499, all genuine deal posts
- ✅ **Original-content fetching** — new feeds fetch the full article by default, and the 26 teaser feeds that existed on 2026-09-15 were switched on. When the site refuses panfleto, unwall.app is tried next. It runs off the poll path, one request per host, and every piece switches off in `deploy/.env`. BBC and FT still arrive as teasers, and the rail covers them
- ✅ **Comments** — a Hacker News article opens its thread inside the reader: lazy, nested 5 deep, sanitized, cached 10 minutes. Other sites keep the outbound link, and Reddit was cut (it blocks panfleto's IP)
- ✅ The entry page says when an article is still being fetched ("Loading…"), or when automatic fetching found nothing and the paywall rail is the way in

### 02 · Onboarding & signup
- ✅ Landing page and one-click signup at `panfleto.win`
- ✅ Auth0 SSO (opt-in via `deploy/oauth.env`) with password login as the fallback
- ✅ 16 starter feeds across Tech · News · Business · Comics · Culture · Podcasts, categorised on arrival — the same set for password and Auth0 signups, from one `feeds.json`
- 🚧 **Welcome email (Resend) and a Telegram ping** — sent for password signups (the landing page); **not for Auth0 signups**, because the reader's onboarding code never receives `RESEND_API_KEY`/`TELEGRAM_BOT_TOKEN` (compose passes them only to `landing`)
- ✅ Suggested-feeds gallery on the subscribe page — 23 feeds from the same `feeds.json`, Quick Add and Review with no inline script (no CSP violations)
- 🚧 **Onboarding is fire-and-forget** — provisioning runs in an unsupervised goroutine with no timeout, retry or error surfacing; a partial feed list is invisible

### 03 · Agent surface
- ✅ MCP endpoint at `panfleto.win/api/mcp?token=…` with feed-management and search tools
- ✅ Per-user MCP token auto-provisioned and shown in Settings → Integrations
- 🚧 **Token handling** — the credential travels in a query string and is minted implicitly on page view; no rotate control

### 09 · Platform & Infra
- ✅ Single Oracle Always Free ARM VM (2 OCPU / 12 GB), Docker Compose, Caddy with automatic TLS
- ✅ State on a separate block volume — the instance itself is disposable
- ✅ Nightly `pg_dump` to OCI Object Storage via instance principal (no API keys on the host), 30-day expiry
- ✅ Ways-of-working scaffolding: `Roadmap/`, `AGENTS.md`, local-first git hooks, the guards workflow
- ✅ **Miniflux fork sync** — `panfleto-core` is a real fork (`danybgoode/panfleto-core`, a submodule here) sitting on upstream `main` plus six panfleto topic commits; every migration and its rollback rehearsed on a restored copy of production
- ✅ **Upstream sync workflow** — on the fork: rebases onto `miniflux/v2` `main` and runs `go build`/`vet`/`test`; quiet when there's nothing to do, a PR when clean and green, an issue naming the conflicting file or failed step otherwise; `accept` refuses a moved base and tags the old tip first. Every path observed on real runs
- 🚧 **…on a weekly schedule** — cron Mon 06:17 UTC is configured; the first scheduled run has not been observed yet
- 🚧 **Feed categorisation and ad filtering** — `enhance_miniflux.js` writes a tested, label-shaped block rule to the field Miniflux actually reads; feeds added after 2026-09-15 (including new signups' starter feeds) don't get it until the rule is re-applied
- ❌ **No CI build** — `update.sh` compiles Go on the production VM; a compile error takes the reader down and there is no artifact to roll back to
- ✅ **Nothing outside Miniflux writes article content** — `scripts/content-write-guard.mjs` fails `guards` and pre-push on a script that would

---

## Recent highlights

- **2026-09-15** — `article-autofetch` + `spike-unwall-app`: click an article and the text is already there. The spike ran from the production VM. It showed unwall.app works as a server-side API and archive.ph is unreachable, so the chain became direct → unwall.app. After a staged rollout by env var, the first poll brought in 135 full articles at load 0.18, and a 327-entry backlog drained through unwall.app with no rate limit. The kill switch was tested live, off and on.
- **2026-09-15** — `inline-comments`: Hacker News threads open inside the reader, sanitized and cached, with no migration. Reddit was cut because it blocks panfleto's IP and its entries carry no comments URL.

- **2026-09-15** — `paywall-rail-single-source`: the paywall rail is told once, by the template, and now links archive.ph, archive.is and unwall.app. The cron job that appended link blocks into stored articles is deleted, and a guard stops any script doing it again. The feared production cleanup had nothing to clean: 0 affected rows, because the job had stopped before the current database existed.
- **2026-09-15** — `adblock-rule-false-positives`: panfleto filters ads for the first time. The old rule had never reached a feed (the script wrote a field the API ignores), and it would have hidden 43% of stored articles, every La Jornada story among them. The new rule matches ad labels, not words, and is live on all 52 feeds; on the same data it blocks 4 deal posts.
- **2026-09-15** — `miniflux-upstream-resync`: the reader moved from a pasted-in Miniflux 131 commits behind to upstream `main`, in two rehearsed hops, with no user-visible change beyond a cleaner subscribe page. `panfleto-core` is now a real fork with a weekly rebase-and-PR workflow, three copies of the starter-feed list became one `feeds.json`, and the CSP nonce patch is gone.
- **2026-09-14** — `ways-of-work-bootstrap`: panfleto adopted the dobby-foundation operating system — `Roadmap/`, `AGENTS.md` with five cannot-be-violated rules, the guards workflow and local-first hooks. First full audit of the Miniflux fork landed with it: the delta is 12 files, the fork point is `06e36c3e`, and there are zero custom migrations.

## License

`panfleto-core` is derived from Miniflux and remains under the Apache 2.0 license. The landing page,
deploy tooling and this roadmap are private to the project.
