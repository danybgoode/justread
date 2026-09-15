# 00-ideas — the idea funnel

The front of the pipeline: raw ideas → scoped seeds → scaffolded epics. Lifecycle is tracked in
**frontmatter on each seed**, not in folder names.

```
00-ideas/
├── README.md         ← you are here
├── BUILD-ORDER.md    ← GENERATED status board (run `node scripts/build-order.mjs`) — do NOT hand-edit
├── seeds/            ← every idea/scope seed, flat, one .md each (with frontmatter)
└── audits/           ← UX/UI (or equivalent) audit findings (reference material, NOT seeds)
```

## Seed frontmatter (the lifecycle source)

Every file in `seeds/` starts with this block:

```yaml
---
title: "Example feature idea"
slug: example-feature-idea          # kebab; matches the filename
status: raw                          # raw | ready | queued | scaffolded | in-progress | shipped | archived
area: "01"                           # macro-section number, matching Roadmap/README.md's table
type: feature                        # feature | spike | chore | epic
priority: null                       # a wave/priority label, or null
appetite: null                       # S | M | L — the budget, set at shaping; REQUIRED before `queued`
underwritten_by: null                # wave that pays for this (a Roadmap/bets/<wave>.md), or null
risk: low                            # low | high
epic: null                           # path to the scaffolded epic, or null until scaffolded
build_order: null                    # BUILD-ORDER id, or null
updated: <date>
---
```

### status — definitions

| status | meaning |
|---|---|
| `raw` | unrefined idea, no scope yet |
| `ready` | Definition-of-Ready scope doc written |
| `queued` | accepted into `BUILD-ORDER.md` (⬜) |
| `scaffolded` | epic + sprint docs created (`epic:` set; poster 🚧) |
| `in-progress` | building (some sprint stories ticked) |
| `shipped` | epic done (epic ✅ + RETROSPECTIVE; poster ✅) |
| `archived` | dropped or superseded |

The enum should be **enforced, not advisory** — wire `scripts/build-order.mjs` (and any Notion/board
sync you add) to hard-fail on a present-but-unrecognized `status:` value, rather than falling back
silently to a derived status. A silent fallback makes drift undetectable exactly where it matters.

### Who owns `status` (seed vs. epic-README frontmatter)

One field is authoritative at each stage — they never both drive the board:

- **Before an epic exists** (`epic: null`) → the **seed's** `status` (`raw`/`ready`/`queued`) is
  authoritative; you set it by hand or the `groom` skill sets it. This is what the BUILD-ORDER
  **funnel** shows.
- **Once `epic:` is set** → the **epic README's frontmatter `status:` is the SSOT** (set at epic
  close: `scaffolded` → `in-progress` → `shipped`). The seed is now **funnel-only** — its `status:` is
  no longer read for the board, so it can't drift it. **`BUILD-ORDER.md` is a generated view — never
  hand-edit it; change the README `status:` and run `node scripts/build-order.mjs`.**

### appetite & underwriting — the economics fields

`appetite` (S | M | L) is the **budget the idea is worth**, fixed at shaping *before* the solution
is designed — sessions + an implied token band, never a time estimate (see WAYS-OF-WORKING →
*Betting & appetite*). `underwritten_by` names the **wave that pays for it** (a
`Roadmap/bets/<wave>.md` file), set at the betting table. `null` means nobody has paid for it yet —
fine in the funnel, impossible on the board: `build-order.mjs` **hard-fails** a `queued` seed with
no `appetite`, and flags a missing `underwritten_by` as drift. Like `status`, `appetite` is an
enforced enum — a present-but-unrecognized value fails the board, it never falls back silently.

## How seeds flow (no file moves)

1. **Capture** — drop a raw idea as `seeds/<slug>.md` with `status: raw` (the `groom` skill does this
   from a brain-dump).
2. **Scope** — `groom` fills out the Definition-of-Ready (appetite included) and flips
   `status: ready`.
3. **Queue** — bet on it at a wave boundary (`appetite:` + `underwritten_by:` set, the wave's
   `Roadmap/bets/` file records what it displaced); `status: queued`.
4. **Scaffold** — on approval, `groom` runs its own `scaffold-epic.mjs` (ships inside the `groom`
   skill, `ways-of-work` plugin) to create the epic/sprint docs, then sets the seed's `epic:` +
   `status: scaffolded`. **No file ever moves between folders** — the frontmatter carries the state.

Filenames are kebab-case and match `slug`. Audits live in `audits/`, never in `seeds/`.

## Ordering — read this before trusting the board's order

`build_order` in seed frontmatter is the **agreed sequence** and the SSOT. Two known gaps in the
template's tooling, both reported upstream to `dobby-foundation` rather than patched here (patching a
plugin-shipped script in one consuming project is exactly the fork drift the plugin exists to avoid):

1. **`BUILD-ORDER.md` does not sort by `build_order`.** The funnel section sorts by `priority` then
   alphabetically by title (`scripts/build-order.mjs`, the `funnel` sort). `build_order` *is*
   extracted — it feeds the Notion projection's "Build order ID" — but the in-repo board ignores it.
   **So read the sequence from the seeds, not from the board's order.**
2. **`type: bug` renders as "Feature".** `TYPE_LABEL` in `scripts/roadmap-to-notion.mjs:58` has
   `feature | spike | chore | epic` and silently falls back for anything else, while
   `scaffold-epic.mjs` validates against `feature | spike | bug | chore`. A bug seed therefore shows
   on the board as a Feature. Same class of problem this file warns about for `status:` — a silent
   fallback makes drift undetectable exactly where it matters.

**panfleto's agreed sequence (2026-09-14):**

| # | Seed | Lane | Appetite | Risk |
|---|---|---|---|---|
| 1 | `ways-of-work-bootstrap` | fixed scope | S | low |
| 2 | `adblock-rule-false-positives` | fixed scope | S | low |
| 3 | `paywall-rail-single-source` | fixed scope | S | **high** |
| 4 | `miniflux-upstream-resync` | **shaped bet** | **L** | **high** |
| 5 | `spike-unwall-app` | spike | S | low |
| 6 | `article-autofetch` | **shaped bet** | M | **high** |
| 7 | `inline-comments` | **shaped bet** | M | **high** |
| 8 | `ci-build-pipeline` | **shaped bet** | M | **high** |
| 9 | `onboarding-provisioning-reliability` | fixed scope | S | low |
| 10 | `mcp-token-handling` | fixed scope | S | **high** |
| 11 | `spike-personalized-editorial` | spike | S | low |
| 12 | `personalized-edition` | **shaped bet** | M | **high** |
| 13 | `editorial-ranking-tuning` | **shaped bet** | M | low |

Dependencies that constrain the order: **4 blocks 6 and 7** (both patch the fork; doing either first
means replaying a moving delta). **10 blocks 12** and **12 blocks 13**; 10 blocks 11's follow-on build epic (the personalized edition would otherwise ship a second consumer of the query-string MCP credential — see that epic's D2). **5 blocks step 2 of 6's fallback chain**, and can run in parallel
with 4. **3 does not block on 5** — it only adds a link. **8 de-risks 4** and every rebase after it,
so there is a real argument for pulling it earlier than 8.
