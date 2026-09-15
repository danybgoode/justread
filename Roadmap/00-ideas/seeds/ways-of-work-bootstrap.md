---
title: "Adopt the dobby-foundation operating system"
slug: ways-of-work-bootstrap
status: shipped
area: "09"
type: chore
priority: wave-2026-09-panfleto
appetite: S
underwritten_by: null
risk: low
epic: null
build_order: 1
updated: 2026-09-15
---

# Pitch — Adopt the dobby-foundation operating system

## Problem
panfleto was built as a series of one-off sessions. There is no product source of truth, no
Definition of Done, no risk tiering, no review policy and no place to put an idea — so every session
re-derives context from the code, and findings evaporate when the session ends. The 2026-09 fork
audit found a repo that is **131 commits behind upstream with no upstream remote**, a GitHub Action
silently rewriting production article content, and a block rule dropping legitimate articles. None of
those were discovered by anyone watching; they were discovered by reading the tree. That is the cost
of having no operating system.

## Appetite
**S** — one session. This is scaffolding, not a build: copy `template/`, fill the markers, commit.
If it grows past one session it has turned into a project, which is the failure mode to avoid.

## Outcome & signal
A fresh agent in any family can open this repo, read three files, and know the cadence, the risk
tiers, the review routing, and the five things it must never do. The product owner can see every
feature's real status on one page.

**Test:** open `Roadmap/README.md` and find any feature's status; run
`node scripts/build-order.mjs --check` and get a clean board.

## Stage-2.5 bucket
**genuinely-new** — nothing like this exists in the repo. But it is *copy-once*, not build: the
skeleton comes from `dobby-foundation/template/` and the living skills come from the `ways-of-work`
plugin, so almost all of the value is inherited rather than written.

## Bill of materials (What / Why)

| What | Why |
|---|---|
| `template/.` copied into the repo root | The skeleton is already written and already guarded; forking it would be drift |
| `AGENTS.md` with 5 cannot-be-violated rules | The load-bearing file — this is what stops a builder growing the fork delta or writing to `entries.content` |
| `Roadmap/README.md` poster with 4 macro-sections | One page showing what is actually enforced in code vs. merely intended |
| `WAYS-OF-WORKING.md` deploy-rail + tooling fill-ins | panfleto's rail has **no preview and no CD** — the template's defaults are wrong here and would quietly mislead |
| Reviewer roster wired into both prompt files | The external families need panfleto's rules verbatim, or they file findings that grow the fork |
| `e2e/` harness relocated out of `apps/example-app/` | panfleto has no `apps/` layout; inherited cruft confuses a fresh agent |
| 10 scope seeds from the audit | Findings that aren't seeds are findings that evaporate |

## Scope
**In v1:** the template copy; every `TEMPLATE FILL-IN` outside `scripts/routines/`; the four
macro-section folders and READMEs; the ten seeds; a generated `BUILD-ORDER.md`.

**Out of v1 (no-gos):**
- Writing `scripts/session-trail.mjs` or any of the other scripts the template names but doesn't
  ship — they are named as absent in `SESSION-KICKOFFS.md`, which is the honest state.
- Scaffolding any epic. That is gated on the product owner approving the scope docs.
- Touching `panfleto-core/`, `deploy/` or any application behaviour.
- A `tasks/` engineering log — nothing to put in it yet.

## Rabbit holes
- **The template's `README.md` overwrites the project's.** It did, on the first copy. Restore from
  `HEAD` and append a pointer section rather than merging by hand.
- **`.gitignore` collision.** Verified identical; if it ever isn't, the project's wins — it is the
  one carrying the `deploy/.env` and `deploy/oauth.env` exclusions.
- **`vercel-prune-previews.mjs` and `roadmap-to-notion.mjs` ship but don't apply.** Keep the files
  (deleting creates template drift) and name the unused rails in WAYS-OF-WORKING instead. A rail
  that silently doesn't apply is worse than one named as N/A.

## What already exists (reuse, don't rebuild)
- `dobby-foundation/template/` — the whole skeleton, guarded by `check-plugin-leaks.mjs`
- `dobby-foundation/plugins/ways-of-work/` — groom + its generators, already installed here
- `scripts/build-order.mjs`, `review-route.mjs`, `cross-review.mjs`, `cross-panel.mjs` — all shipped
- The existing `README.md`, which already documents the architecture accurately

## UX heuristics & rails check
- **CI guards covering this surface:** `guards.yml` (build-order freshness + `scripts/` node:test),
  `.githooks/pre-commit` as the local-free equivalent
- **Audits-lens findings that apply:** none — `00-ideas/audits/` is empty, this is the first pass
- **Design-language debt:** n/a, no UI surface

## Acceptance criteria
1. `grep -rn "TEMPLATE FILL-IN"` returns nothing outside `scripts/routines/` and the root README's
   own instructions.
2. `node scripts/build-order.mjs --check` exits 0.
3. `node --test scripts/*.test.mjs scripts/lib/*.test.mjs` passes.
4. `Roadmap/README.md` marks every feature ✅ only where it is enforced in code.
5. The original panfleto `README.md` content is intact.

## Open risks / research
- The `ways-of-work` plugin is installed from the `dobby-foundation` marketplace, whose
  `KNOWN_ABSENT` ledger records **eight of ten skills as dark** (their scripts were never extracted
  from the origin project). panfleto gets `groom` and `doc-hygiene` working; `standup-post`,
  `weekly-recap`, `pmo-report`, `babysit-pr`, `live-smoke`, `build-order-sync`, `vercel-prune` and
  `prose-draft` are **not** working skills here. That is inherited debt, not a panfleto bug — but it
  should not be discovered later as a surprise.
