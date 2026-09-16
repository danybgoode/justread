# Agent index — panfleto

## What is this?

panfleto is a minimalist, distraction-free RSS reader: zero algorithms, zero ads, zero
distractions, feeds in the order they happened. It is a hosted [Miniflux](https://miniflux.app) fork
with a landing page, a one-click signup flow, and an MCP server that puts a reader's feeds inside any
AI assistant — running entirely on Oracle Cloud's Always Free tier for $0/month.

**Architecture**: a Go Miniflux fork (`panfleto-core`) + a Next.js 16 landing page and MCP server,
behind Caddy on one Oracle ARM VM, orchestrated with Docker Compose against Postgres 17.

**Repo layout** (monorepo):
```
fluxonline/                  ← git remote is danybgoode/justread; the product is "panfleto"
├── panfleto-core/           ← the Miniflux fork — the reader itself (Go). A git SUBMODULE
│                               (danybgoode/panfleto-core, branch `panfleto`); clone with
│                               --recurse-submodules or the directory is empty
├── landing-page/            ← Next.js 16: panfleto.win, /api/register, /api/mcp
├── deploy/                  ← Oracle Cloud provisioning + the running compose stack
├── scripts/                 ← ways-of-work tooling (*.mjs) + feed-enhancement utilities (*.js)
├── e2e/                     ← Playwright harness (api gate + opt-in browser smoke)
└── Roadmap/                 ← product source of truth (see Start here)
```

**Workflow (gitflow)**: work on a **feature branch** (`feat/<epic-slug>`), commit per story, open a
**PR**, and **merge to `main`** when verified + approved. Never commit feature work straight to
`main`. Roll back a bad merge with `git revert` on `main`.

> ⚠️ **On panfleto, merging to `main` is NOT the deploy.** There is no CD. Production updates when a
> human runs `/opt/panfleto/deploy/update.sh` on the VM, which pulls `main`, resolves the reader
> image from the submodule pin and **pulls it from GHCR** (since
> `Roadmap/09-platform-infra/ci-build-pipeline`; the reader is no longer compiled on the VM, though
> the small `landing` image still is). See rule 5 below — this changes what "done" means, and it is
> the most common way a panfleto PR gets called finished when it isn't.

## Start here (orientation for any agent)

Before planning or building, read these — they are the source of truth and change often:
- **`Roadmap/README.md`** — the product poster: every feature by domain, current status.
- **`Roadmap/WAYS-OF-WORKING.md`** — the cadence, gitflow, Definition of Done (story **and** epic),
  QA/smoke rules, risk tiers, the review roster. Follow it.
- **`Roadmap/LEARNINGS.md`** — distilled cross-cutting wisdom from past epics' retrospectives.
  **Read it.** You feed it at epic close (see the epic Definition of Done).
- Process: **plan first** (plan mode → user stories → product-owner approves) → branch + **scaffold
  the epic/sprint docs before code** → build one story → verify → **smoke-test** → PR → merge →
  **deploy and confirm live**. At epic close, update `Roadmap/README.md`, write a `RETROSPECTIVE.md`,
  and promote durable learnings to `Roadmap/LEARNINGS.md`.

---

## ⚠️ The rules that cannot be violated

### 1. Upstream Miniflux owns the reader. The fork's delta is a budget, not a canvas.
`panfleto-core` tracks `miniflux/v2` and is rebased onto upstream `main` — weekly, by the
`panfleto upstream sync` workflow on the fork. As of 2026-09-16 the delta is **eight topic commits**
touching **30 code and template files**, plus `internal/ui/static/bin/feeds.json` (the one list of recommended
feeds), **two** workflows, and 17 branding icons — and that number is the budget. It was 12 until
`article-autofetch` and `inline-comments` added two genuinely new capabilities: 9 new panfleto-owned files
(`internal/reader/{autofetch,prefetch,comments}/`, `internal/ui/entry_comments.go`) and 6 upstream files
touched for the first time (`cli/daemon.go`, `config/options.go`, `reader/handler/handler.go`,
`reader/processor/processor.go`, `ui/ui.go`, `ui/static/js/app.js`). The upstream-owned ones are the rebase risk.
`mcp-token-handling` added the 30th,
`internal/template/panfleto_integrations_test.go` — it renders the MCP panel and fails on an inline
`style=`/`onclick`, which is the only automated way to hold a CSP fix on a page that lives behind a
session. `onboarding-provisioning-reliability` added the 29th, `internal/ui/user_onboarding_test.go` — the
cheapest kind of delta, a `_test.go` beside a file the fork already owns, which upstream has no file
named. `ci-build-pipeline` added the 28th, `.github/workflows/panfleto-image.yml` — deliberately a
panfleto-owned file in a directory upstream's own workflows also live in, and the *cheapest* way to
move the reader's build off the production VM: `packaging/docker/alpine/Dockerfile` is untouched.
`git -C panfleto-core fetch -q https://github.com/miniflux/v2 main && git -C panfleto-core diff --stat FETCH_HEAD...HEAD`
shows it (three dots: only panfleto's side, however far upstream has moved). Every file you add to the fork is
rebase tax paid at every future sync, forever.

Before changing a file under `panfleto-core/`, exhaust these in order:

| Reach for | Before |
|---|---|
| A Miniflux config option / env var in `deploy/docker-compose.yml` | Patching Go |
| A per-feed setting (crawler, scraper rules, rewrite rules, block rules) | Patching the processor |
| A repo-local script under `scripts/` against the Miniflux API | Patching anything |
| An **upstream PR** to `miniflux/v2` | Carrying a patch forever |

If you must patch, keep it to a file the fork already owns, and put it in the topic commit it belongs
to, never a new one on top. Say in the PR body which of the 30 it touches — or that the delta just grew
to 31 and why that was worth it.

### 2. Never mutate `entries.content` from outside Miniflux.
The reader owns article content. **Presentation** belongs in a template
(`internal/template/templates/`); **enrichment** belongs in the scraper/processor
(`internal/reader/processor/`). A script that reaches in over the API and rewrites stored content is
an irreversible, unattributable edit to the reader's own data, and it silently fights anything that
later replaces that content. This rule exists because `scripts/archive_appender.js` did exactly that
every three hours for months — see `Roadmap/01-reading-experience/paywall-rail-single-source/`, the
worked example (its writes landed on the pre-Oracle install; the current database held 0 affected
entries when the epic closed on 2026-09-15). It is enforced: `scripts/content-write-guard.mjs` fails `guards.yml` when anything
under `scripts/` issues a `PUT`/`PATCH` to `/entries` with a `content` field.

### 3. A panfleto-owned migration is a permanent rebase conflict. Treat one as HIGH and escalate.
`internal/database/migrations.go` is an append-only slice and `schemaVersion = len(migrations)`.
Upstream appends to the same slice. So a migration we own at index *N* collides with upstream's
migration at index *N* at every rebase, and getting the ordering wrong on a deployed database is
unrecoverable without a restore. As of 2026-09 the fork has **zero** custom migrations — that is
what makes the resync safe, and it is worth protecting.

Any new table is therefore an **escalate-don't-guess** decision, not a builder's call: stop, hand
back to the planning tier, and record the decision in the epic README before writing the migration.

### 4. Secrets live on the host, never in the repo.
Runtime config is read from `deploy/.env` and `deploy/oauth.env` on the VM — both `600`, both
git-ignored; `deploy/.env.example` documents every value. **MCP tokens are credentials**: they are
API keys minted per user by `internal/ui/integration_show.go` — **on request since 2026-09-16, never
as a side effect of viewing a page**. Never log one, never paste one into a doc, never commit a
fixture containing one. Two traps found the hard way (`03-agent-surface/mcp-token-handling`): a
credential rendered into a page is in the DOM on every load, disclosure widget or not; and Node quotes
a rejected header's *value* in its exception, so an unsanitised catch logs whatever the caller sent.

### 5. Done means deployed, not merged.
Merging to `main` changes nothing in production. A story is done when the change is on `main`, the
VM has been updated, and the behaviour has been confirmed against `https://app.panfleto.win`. A PR
that says "ready to deploy" is an unfinished PR — say who runs `update.sh` and when, in the PR body.

**A change to `panfleto-core` is not deployable until CI has built its image.** The deploy resolves
`ghcr.io/danybgoode/panfleto-core:<the submodule pin>`; if the `panfleto image` workflow has not
finished (or the pinned commit was docs-only and skipped), `update.sh` aborts and the old reader
keeps serving. Move the pin to a commit that has a green run.

---

## Context routing — read only what you need

| I'm working on… | Read these docs |
|---|---|
| The reader UI, entry view, fetching, comments | `Roadmap/01-reading-experience/`, `panfleto-core/internal/ui/`, `internal/template/templates/views/entry.html` |
| Article fetching / scraping / paywalls | `panfleto-core/internal/reader/processor/processor.go`, `internal/reader/scraper/`, `internal/ui/entry_scraper.go` |
| Signup, starter feeds, welcome email | `Roadmap/02-onboarding-and-signup/`, `panfleto-core/internal/ui/user_onboarding.go`, `landing-page/src/app/api/register/route.ts` |
| The MCP server / agent surface | `Roadmap/03-agent-surface/`, `landing-page/src/app/api/mcp/route.ts`, `panfleto-core/internal/ui/integration_show.go` |
| The upstream fork, CI, deploy, the VM | `Roadmap/09-platform-infra/`, `deploy/README.md`, `deploy/docker-compose.yml` |
| Feed categorisation / block rules | `scripts/enhance_miniflux.js` |

---

## Quick-reference

```bash
# Reader (Go) — from panfleto-core/ (a submodule: git submodule update --init --recursive)
go build ./...                       # compile
go vet ./...                         # vet
go test ./...                        # unit tests
make miniflux                        # the real build target

# Landing page (Next.js) — from landing-page/
npm run build
npx tsc --noEmit

# Whole stack, locally
# Needs MINIFLUX_IMAGE (or compose falls back to the moving :panfleto tag) and an arm64 host - the
# published reader image is arm64-only. On amd64, uncomment docker-compose.yml's `build:` block.
MINIFLUX_IMAGE=ghcr.io/danybgoode/panfleto-core:panfleto \
  docker compose -f deploy/docker-compose.yml up -d

# The deterministic gate
npm run test:e2e                     # Playwright api project (see e2e/README.md)
node scripts/build-order.mjs --check # the roadmap board is fresh

# Production (a human runs this, on the VM)
ssh -i ~/.ssh/panfleto_oci ubuntu@<ip>
/opt/panfleto/deploy/update.sh       # pull main, pull the reader image, restart
/opt/panfleto/deploy/backup.sh       # manual backup (also nightly 04:30 UTC)
```

**Key env vars** (all from `deploy/.env` / `deploy/oauth.env` on the host):

| Var | Where | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | compose | required, no default |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | miniflux + landing | the landing page authenticates to the reader's API as admin |
| `BASE_URL` | miniflux | `https://app.panfleto.win` |
| `POLLING_FREQUENCY` / `BATCH_SIZE` | miniflux | `60` / `100` — retune together, they interact |
| `OAUTH2_*` | `oauth.env` | Auth0 SSO; the file must be **absent**, not empty, to fall back to password login |
| `RESEND_API_KEY` / `TELEGRAM_BOT_TOKEN` | landing **and miniflux** | onboarding notifications; optional. Both containers, since 2026-09-16 — `/api/register` (password signup) is in `landing`, `provisionUserOnboarding` (Auth0 signup) is in `miniflux`, and passing them to only one is what made every SSO signup notify nobody |
| `PANFLETO_TELEGRAM_CHAT_ID` / `PANFLETO_EMAIL_FROM` | landing + miniflux | optional; default to the values that used to be hardcoded |
| `MINIFLUX_URL` / `MINIFLUX_API_KEY` | `scripts/*.js` | generated at Settings → API Keys |

**Key seams** — reuse these instead of reinventing:

| Seam | Path | What it owns |
|---|---|---|
| Content processing | `internal/reader/processor/processor.go` | the `feed.Crawler && entryIsNew` gate — the one place scraping is decided |
| Scraper | `internal/reader/scraper/` + `internal/reader/readability/` | fetching and extracting a web page |
| Fetcher | `internal/reader/fetcher/` | HTTP request building, encoding, response handling |
| Sanitizer | `internal/reader/sanitizer/` | **every** piece of untrusted HTML goes through here |
| View context | `internal/ui/view/view.go` | what every template can see (including `cspNonce`) |
| Entry model | `internal/model/entry.go` | `CommentsURL` already exists and is already persisted |
