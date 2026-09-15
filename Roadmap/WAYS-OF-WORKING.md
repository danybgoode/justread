# Ways of Working

How the product owner and Claude (builder) ship product together. Lightweight scrum: small slices,
plan first, ship the moment each slice works.

---

## Roles

- **Product Owner & Reviewer.** Sets direction, approves plans, tests each shipped slice, makes the
  consequential calls (architecture forks, infra, money).
- **Claude — Builder.** Researches, proposes the plan as user stories, builds, verifies, ships, and
  documents.

**Orientation before building.** Many asks are solvable with existing features + communication or a
light enhancement, not net-new work. Surface that path *first*; build new only when the outcome
genuinely needs it. The `groom` skill gates on this (Stage 2.5).

## The unit of work: the user story

Everything is sliced into **user stories** — the smallest piece of independently testable, shippable
value. Format:

> **As a** \<role\>, **I want** \<capability\>, **so that** \<outcome\>.
> **Acceptance:** plain-language checks the product owner can run.

Stories roll up into **Sprints**, sprints into an **Epic**, epics live under a **Macro-section**
(product domain). See `Roadmap/README.md`.

## The cadence (our core loop)

Work on **feature branches and merge to `main` via PR** (gitflow) — multiple agents can run in
parallel on their own branches, so `main` stays clean and conflict-free. `main` is the production
line: merging to it deploys.

```
Plan → Branch + scaffold docs → Build story → Verify → QA/smoke-test (preview) → push → product owner reviews preview → … → PR → merge to main → (epic close: poster + retro)
```

1. **Plan.** For non-trivial work, Claude enters plan mode, writes a plan as user stories, and the
   product owner approves before code. **Every plan names a QA / smoke-test stage** with the specific
   checks and tools. Reference end-states (spec docs) are inspiration, never signed-off scope. Every
   scope seed also names which UX rails (CI guards, an audits lens, design-language debt) cover its
   surface — the `groom` skill's Stage 4 reuse list (`groom/templates/scope-seed.md` in the
   `ways-of-work` plugin).
2. **Branch + scaffold docs.** Create one working branch per epic — `feat/<epic-slug>` (or `fix/…`,
   `chore/…`) — off the latest `main`, in each repo you'll touch. On it, *before any code*, scaffold
   the epic `README.md` + per-sprint files under the right macro-section (plain-language stories +
   acceptance). The build runs against these docs; the product owner sees scope as it grows. Keep
   them current as stories land (✅ ticks, commit refs); retrospective at epic close.
3. **Build one story at a time.** Iterative. Reuse before rebuild. Commit per story to the branch
   (`Co-Authored-By: Claude` trailer).
4. **Verify.** Type-check + lint clean, build passes.
5. **QA — the deterministic gate (pre-merge) + the live confirmation (split).** Two distinct layers;
   don't conflate them.
   - **Deterministic gate — must be green BEFORE merge:** typecheck + build + your test suite, run by
     the building agent. This is non-negotiable — nothing merges on a red gate. Where the acceptance
     check is browser-/API-testable, add **one** spec (Playwright or equivalent) as part of the story.
   - **Deploy rail — panfleto has NO per-branch preview.** There is no Vercel, no preview-per-PR,
     no preview URL and no protection-bypass token. The whole stack is one Docker Compose deployment
     on one Oracle VM, and it only changes when a human runs `update.sh` (see step 7). This is the
     "build-on-merge container platform" shape the template names, and it has three consequences,
     all of which are **correct, not gaps**:
     1. **The pre-merge gate runs locally.** `go build ./...` + `go vet ./...` + `go test ./...` for
        the reader, `npx tsc --noEmit` + `npm run build` for the landing page, and the Playwright
        `api` project against a local `docker compose up`
        (`PLAYWRIGHT_BASE_URL=http://localhost:8080`). Nothing merges on a red gate.
     2. **There is no e2e-vs-preview step in CI.** `guards.yml` checks the roadmap board and the
        `scripts/` tests; it does not and should not try to reach a deployment.
     3. **Live confirmation is post-merge, post-deploy, against `https://app.panfleto.win`** — and
        the PR body states that split explicitly, naming who runs `update.sh` and when.
   - **Live confirmation can be async + divided** (it's *confirmation*, not the gate): the agent owns
     API-level smoke where it has access; **the product owner owns the browser / real-session smoke**
     for anything credential-gated. Exercise real behaviour — a disposable/test account for anything
     that mutates data; clean up after (revoke test tokens).
6. **Push as you go.** Each push updates the preview (if your rail has one); the reviewer (and the
   product owner) can test per story without touching production.
7. **PR → review → merge to `main`.** Open a PR early (draft is fine); keep it updated with a self-QA
   note **and a risk tier** (see *Review & merge* below). Trigger the reviewer (a fresh agent, not the
   builder — see *Review & merge* below). When the deterministic gate is green, the review is clean,
   and the merge is authorized for the PR's risk tier, merge to `main`. Small epics merge once; larger
   ones may merge per sprint. Delete the branch after merge.

   > ⚠️ **On panfleto, merging to `main` is NOT the production deploy.** There is no CD. Production
   > changes only when a human SSHes to the Oracle VM and runs `/opt/panfleto/deploy/update.sh`,
   > which pulls `main`, rebuilds the images **on the VM** and restarts the stack. So the step after
   > merge is a real, named step — not a wait. Every PR body says who runs it and when, and a story
   > is not done until the behaviour has been confirmed live (see *Definition of Done*, and
   > `AGENTS.md` rule 5). Two things follow from compiling on the production host: a build failure
   > takes the reader down, and there is no previous artifact to roll back to — rollback is
   > `git revert` on `main` plus another slow rebuild. Removing that property is tracked as
   > `00-ideas/seeds/ci-build-pipeline.md`.
8. **Continue / close.** Roll into the next story. At **sprint close**, emit the sprint-wrap terminal
   summary (`SESSION-KICKOFFS.md` §7) — a thin pointer to the sprint doc + what's owed/next, never a
   re-summary. At **epic close**, do the epic Definition of Done (below) — including updating the
   product poster.

## Epic-mode builds — the default for a scaffolded epic

**A whole epic in one orchestrated session is the normal unit of work, not the exception.** The sprint
documents are integration, review and rollback boundaries *inside* that run — internal structure, not
separate engagements. Per-sprint sessions remain valid for a one-sprint epic, or when a sprint's outcome
genuinely changes the next sprint's scope; everything else runs epic-mode. The cadence above still holds;
this section says who does what. The kickoff prompt is generated, not hand-written —
`node skills/groom/emit-epic-kickoff.mjs --epic <slug>` (the `groom` skill).

**One architect, many builders, assembly line.** The orchestrating agent reads the epic + sprint docs and
the shipped seams, then does the single most valuable thing in the whole run: **locks the architecture
decisions against the live code and the live data before any builder starts**, and writes them into the
epic `README.md` as numbered decisions (`D1…Dn`) plus a per-sprint **"Build contract (locked by the
architect before the builder started)"** section. Builders *cite* those decisions; they never re-derive
them. This is what turns three sprints into an assembly line instead of three independent rediscoveries.

The locking pass is not a summary of the sprint docs. It must:
- **Disprove scope.** Read the code before believing the doc. A scaffolded acceptance criterion that
  describes a guard, a table, a dependency or a flag state the live system doesn't have is fiction —
  correct the doc, with the reasoning, and say so out loud.
- **Query the live data, not just the migration files.** Row counts decide what is safe: a schema fork
  that is free while a table is empty is *only* free then, and that window is worth spending deliberately.
- **Name every deviation** in the README, decided — not discovered by a builder mid-build.
- **Say where each contract lives, once.** Import the shipped rule; never restate it.

**Stack the branches.** `feat/<slug>` → `-s2` → `-s3`, each cut from the previous, one PR per sprint,
merged in order. Sprints in one epic share hot files by construction (a shared `lib/` directory, a page,
the flag registry, the migration set); siblings cut off one base pay a per-merge conflict tax — *stack or
pay*. One PR for the whole epic is acceptable only when the sprints don't split cleanly along a review
boundary; prefer per-sprint PRs so the highest-risk sprint gets reviewed as one.

**Route models by risk, and invert it for review.** Assign the sprint that defines the contract everything
else imports — the authorization boundary, the migration, the shared seam — to the stronger model; assign
the sprints that are mechanical over a locked contract to the faster one. Review is inverted: the fresh
reviewer pass on the highest-risk PR runs on the strongest model. State the routing in the epic README so
the choice is auditable.

**The review stack does not shrink because the epic is built at once** — but it is *right-sized by tier*,
and it is not three passes. See *Review & merge* below: two cross-family passes on every PR, the fresh
reviewer subagent on HIGH only. Findings route back to the original builder (context intact, fixes cheap)
while the next sprint's builder starts. **The builder never merges their own PR** — and when the
orchestrator finishes a builder's last mile itself (session limits will do this to you), a fresh
independent agent must review those self-authored commits before merge.

**Merges are pre-authorized on green, and done means shipped.** In a named epic-mode run the orchestrator
may merge on a green gate — deterministic gate green, review findings resolved, risk tier declared —
without a round-trip per sprint boundary. Pre-authorization removes the round-trip, **not** the layers,
and it does **not** extend to a new category of production mutation (TLS/IAM/secrets, money or entitlement
writes, a new external dependency or production secret): name those in one focused question.

*Done* means **shipped**, not merged. A merged PR that hasn't deployed, a migration written but not
applied, a flag that exists in code but not in the flag provider — none of those are done. Where the work
includes a migration, **apply it BEFORE merging** (merging deploys, and code reading a new column against
an unmigrated table breaks an actively-used path rather than staying dark): apply → verify live → merge →
confirm the deploy actually succeeded.

**Assume the orchestrator dies too — derive state, journal intent.** Session limits kill whole agent trees
mid-flight. The docs record *decided* state, never *in-flight* state, so: **derive what is derivable;
journal only what isn't.** Re-derive branches, dirty trees, worktrees, open PRs and migration drift at
session start rather than storing a snapshot (a stored snapshot is stale by the time it's read, and a
stale snapshot is worse than none because it reads as authoritative). Journal each locked decision and
each sprint/PR boundary — intent is the only thing a resume cannot re-derive.

**Compact at sprint/PR boundaries.** The durable state — the epic README's decisions, the per-sprint build
contracts, team memory — is *designed* to make re-entry cheap. That is what makes a whole epic in one
session affordable.

## Betting & appetite — the economics layer

A ticket board without economics is a sausage machine: work goes through it, and nothing records
what budget it drew from or what it displaced. This layer makes **opportunity cost** — *what else
could we be building?* — the visible, guiding question. Principles adapted from Shape Up for an
agent-speed operation: with agents, *time* is the wrong denominator (the op runs round the clock),
and raw tokens alone are too weak a ceiling (an agent will eventually build anything if allowed to
tokenmaxx). The binding constraints are **product-owner attention and session context**, with
review rounds close behind — so appetite is denominated in **sessions**, each tier carrying an
implied token band:

| Appetite | Buys | Circuit breaker |
|---|---|---|
| **S** | one builder session; fixed scope (a bug, a chore, a clear story) | escalate-don't-guess (2+ failed attempts) — no hard breaker |
| **M** | one wave: an architect session + builder fan-out + review rounds | appetite exhausted → stop, back to shaping |
| **L** | a multi-wave epic | per-wave: each wave is re-bet at the boundary |

**Appetite, not estimates.** Shaping fixes the budget before the solution: fixed appetite, variable
scope. The appetite is what makes an agent stop, zoom out, and hammer scope instead of hammering
the problem.

**The circuit breaker is the default, not the exception.** When an M/L bet exhausts its appetite,
work *stops and returns to shaping* — never extended in flight. Repeated hammering on one problem
signals the work is uphill (unknowns), not that it needs more tokens.

**Underwriting.** Nothing reaches `status: queued` without `appetite:` set — `build-order.mjs`
hard-fails otherwise — and a wave underwriting it (`underwritten_by:`). `underwritten_by: null` is
the honest state of an idea nobody has paid for yet: fine in the funnel, impossible on the board.

**Betting at wave boundaries (no fixed calendar).** Before a new wave starts, the betting table —
product owner + architect agent, with `cross-panel.mjs` available for an advisory different-family
read — picks bets from `ready` seeds and records them in `Roadmap/bets/<wave>.md`: each bet, its
appetite, and **what it displaced**. Three lines per bet, not a ceremony. An unpicked pitch is let
go, not backlogged — if it matters, it resurfaces.

**Lanes — not everything earns the betting table.** The groom skill classifies each ask into:

- **Shaped bet** (genuinely-new / strategic) → full pitch (problem · appetite · bill of materials ·
  rabbit holes · no-gos) → betting table.
- **Fixed scope** (bug, chore, well-specified story) → default appetite S, straight to a builder.
- **Reactive/ops** (incidents, launch support) → no shaping, but logged against the current wave's
  budget so the economics stay visible.

**Hill routing.** Uphill work (unknowns being figured out) stays on the strongest model and is
never delegated; downhill work (known execution) routes to the builder tier. A scope that stops
moving is a raised hand: escalate, don't hammer.

**Reporting register.** Close-out prose walks the ladder **outcome → behavior → implementation**:
lead with what's now true and why it was worth the bet, support with observable behavior,
implementation detail only where the mode asks. The SSOT is `scripts/prose-draft.prompt.md`.

## Review & merge — cross-agent
With multiple agents potentially running in parallel, the agent that **builds** a PR is not the one
that **approves** it — a fresh reviewer re-derives intent from the diff alone and catches what the
author's context-bias hides. Two layers do this, and they're complementary:
- **CI (determinism):** a deterministic gate on every PR — the tireless gate that never forgets or
  runs out of tokens; a red CI blocks merge. Typecheck + build + your test suite against the PR's
  preview (if your rail has one) is the minimum shape; adapt to your actual stack. If a repo has no
  per-branch preview (deploys post-merge only), there is correspondingly no e2e-vs-preview step in its
  gate — that's correct, not a gap.
- **Cross-family review (judgment) — TWO passes on every PR:** `node scripts/cross-review.mjs <PR#>
  --agent <family>` pipes the PR diff into a **different model family's** CLI for one pass and posts the
  findings as a clearly-labeled PR comment. Four families are wired — `codex`, `antigravity` (agy),
  `vibe` (Mistral) and `claude` (Claude Code as a plain CLI) — and **two of them review every PR**. One
  external pass has no corroboration; the families disagree often enough that the second read is where an
  argued-down finding gets a second vote. It reads the same shared prompt a human reviewer would
  (`scripts/cross-review.prompt.md`), is **single-pass** (no debate loop), and `--skip-trivial` skips
  docs-only / tiny diffs. Every finding is resolved before merge — fixed, or answered on the PR with the
  reason it isn't a bug. The *run* still never **authorizes** a merge; CI + the risk-tier rule do that.

  `claude` is on this roster specifically so a **non-Claude orchestrator can use it**. When Codex or agy
  is driving a build, "get a Claude review" used to require a Claude host to spawn a subagent; exposing
  Claude Code as a CLI reviewer makes the layer symmetric — any orchestrator, from any family, routes to
  any other family through one script.

  **panfleto's roster: `codex`, `antigravity` (agy) and `vibe` are all installed and authenticated**
  (confirmed 2026-09-14), so `review-route.mjs` has the full four-family order to choose from and
  every PR gets two genuinely external passes. Claude stays last in the preference order because
  Claude capacity is usually the thing building.

  **Update 2026-09-15, after the first real epic:** installed is not the same as available. The resync
  retro records that **Codex was capped for the entire epic**, and that **agy auto-updated twice
  (1.2.1 → 1.2.3) mid-session**, breaking its version pin each time and stalling when run in parallel.
  Plan for the roster being short rather than assuming four families. A capped family is a refund ask,
  and the downgrade goes in the PR body.

  Gotchas as we hit them — **add to this list, don't rediscover it**:
  - **The failure shape to watch for is exit 0 with empty output.** That reads as a clean review and
    is the single most dangerous outcome on this layer. If a pass returns nothing, treat it as DARK
    and say so in the PR body; never as "no findings".
  - **A Go diff is the unusual case for this roster.** Most of these CLIs are tuned on TypeScript;
    on a `panfleto-core/` diff, say in the review prompt that the target is Go inside a Miniflux
    fork and that the standing constraint is `AGENTS.md` rule 1 (keep the delta small), or you get
    idiomatic-refactor findings that would grow the fork.
  - _(pin versions here as they bite — a young CLI's print contract breaks on minor bumps.)_

- **Fresh reviewer subagent (context independence) — HIGH tier only:** an agent that did **not** hold the
  diff in its head while writing it, re-deriving intent from the diff alone. This is a *different axis*
  from family independence, not a substitute for it: it is the layer that catches money-path bugs (IDOR,
  SSRF, consent-boundary holes) that every external family misses. **Mandatory on HIGH tier. Not spawned
  at all on LOW.** Dropping it on LOW is the deliberate saving — the old habit of running the external
  passes *and* the orchestrator's own parallel reviewer subagents on every PR was paying twice for one
  read. That is only safe because the deterministic gate carries the repetitive checking.

  Keep review a **single pass on a green CI gate** — not an iterative refine loop (that loop is the
  dominant token cost in multi-agent dev). Whoever reviews, it is never the agent that built the PR.

### Routing the reviewers — `node scripts/review-route.mjs --builder <who> --tier <low|high> <PR#>`

Once more than one family can build, "run cross-review" stops being unambiguous: the default agent flag
on a Codex-built diff is **Codex reviewing Codex** — a same-family pass wearing a cross-family label, and
a silent downgrade nothing in a hand-driven flow would catch. The router makes the policy executable and
auditable; it prints its reasoning and the exact commands to run.

Preference order is **codex → agy → vibe → claude**, and the two highest-preference families that did
*not* build the diff review it:

| Builder | Cross-family reviewers | Fresh subagent |
|---|---|---|
| claude | codex + agy | HIGH only |
| codex | agy + vibe | HIGH only |
| agy | codex + vibe | HIGH only |
| vibe | codex + agy | HIGH only |

`claude` is deliberately **last** in that order — not because it reviews badly, but because Claude
capacity is usually the thing *building*. It rotates in the moment one of the three ahead of it is
capped, which is the point of having it wired.

**A capped family is a REFUND ASK, not a licence to substitute.** When fewer than two external families
are available, the orchestrator **stops and asks the product owner to top up the quota** before spending
its own subagent tokens on the same read. External quota is refundable in minutes; subagent tokens come
out of the build budget. The pause is bounded — `--fallback-after <minutes>` (default 30) states how long
the run waits before proceeding with subagents, and **either way the downgrade is recorded in the PR
body**. A missing layer must be loud: if the router reports the cross-family layer as short or DARK, say
so in the PR body, because a missing layer that reads like a clean one is worse than no layer at all.

**Every PR declares a risk tier** (in the PR body); that tier decides who may merge:
- **Low-risk → an agent other than the builder may merge** once CI is green and both cross-family passes
  are clean or their findings are answered: docs/copy, non-commerce-adjacent UI, additive tools behind
  auth, tests, internal tooling. (Not spawning a fresh subagent here doesn't lower the bar; it moves the
  bar onto the two mandatory cross-family passes.)
  - **The builder never merges their own PR — no exceptions.** In a single-session epic-mode run the
    orchestrator often *is* the builder; when that's the case, the fresh reviewer subagent stops being
    HIGH-only and becomes the thing that supplies the second pair of eyes, or the product owner merges.
    "A different model family reviewed it" is not the same as "a different agent than the one holding the
    diff's context" — this is the one place that distinction could quietly erode.
- **High-risk → always a product-owner merge** (a human green-light, never an autonomous ship):
  anything touching money, auth, DB migrations, or shared infra. This preserves the guardrail — an
  agent never deploys a real-money or real-auth path to production on its own. HIGH also carries the
  mandatory fresh-reviewer subagent above.
  - **Exception — a named epic-mode run.** The product owner may pre-authorize merging HIGH PRs for a
    *named* epic (see *Epic-mode builds*). That covers the plan as discussed; it is not a standing grant,
    and it never skips the gate or the review layers.
When unsure which tier, treat it as high-risk. High-risk epics are also *planned behind a kill-switch*
at grooming (the flag is decided + sliced there, verified at epic DoD — not a new gate); see the
`groom` skill's Stage 6b.

## Definition of Ready (a story can start)
- The "as a / I want / so that" is clear and the acceptance check is testable.
- It's a slice that can ship on its own.

## Definition of Done (a story)
- Acceptance criteria met and confirmed working.
- Type-check + lint + build clean.
- **Smoke-tested** (on the branch's preview where applicable). The story's real behaviour is exercised
  end-to-end with an appropriate tool — a Playwright spec, `curl`, or a real artifact render fit
  API-only/non-browser checks; a scripted browser-verification tool (see the origin project's
  `live-smoke` skill for a worked pattern) is the default for rendered-page checks. Never "build
  passes, therefore done." If a live smoke test genuinely can't run (no test account,
  money-/account-gated), that gap is stated explicitly in the PR rather than glossed.
- **Every new spec was observed failing (red) at least once** — via a deliberate break-the-
  implementation mutation check if the test was written after the code. This verifies the spec isn't
  a false-positive tautology; it is **not** an ordering mandate — don't force test-first.
- Committed to the feature branch; sprint doc status ticked.

## Definition of Done (an epic) — the close-out checklist
When the last story of an epic is merged, the epic is not "done" until ALL of these are true:
- [ ] All sprints' stories merged to `main` and smoke-tested (gaps stated).
- [ ] **Each sprint has a fool-proof smoke walkthrough in its `sprint-N.md`** — numbered steps, one
      action + one expected result each, using **real production URLs** once deployed (preview URLs
      pre-merge). Money/auth/checkout steps are flagged by name as **owed to the product owner** (an
      automated browser smoke can't fully cover them). Format + example: `groom` skill, Stage 8b.
- [ ] Epic `README.md` marked ✅ complete; every `sprint-N.md` status ticked with commit refs.
- [ ] **`RETROSPECTIVE.md`** written alongside the epic (what shipped / went well / learned / gaps).
- [ ] **Product poster updated — `Roadmap/README.md`.** Find the epic's macro-section in the
      **Feature map** and update its line(s) to reflect what's now live (✅), and add a **Recent
      highlights** entry. The poster is the at-a-glance product source of truth — it must never lag a
      shipped epic.
- [ ] Team memory updated (epic memory + the index, if your workflow keeps one).
- [ ] **`Roadmap/LEARNINGS.md` updated** — promote any durable, generalizable learning from the
      `RETROSPECTIVE.md` into the right section (one-liner + *why* + date/source). Dedupe — sharpen
      the existing line, don't append a near-duplicate. This is how a retro reaches the next agent.
- [ ] **Kill-switch (if one was planned at grooming):** the flag slice shipped and the flag exists
      with the polarity the scope doc stated (kill-switch ⇒ default `true`, created **enabled**;
      enablement ⇒ default `false`, created **disabled**). This **verifies** planned work — it is
      **not** a new build-time gate. Whether a high-risk epic needs a kill-switch is decided at
      **grooming** (the `groom` skill, Stage 6b), not discovered here.
- [ ] Feature branch deleted; PR merged.

## Automated QA — where we are
The test harness should grow by **one spec per new browser-/API-testable story** — coverage accretes
with the work, not as a separate project. Two layers is the recommended shape (see the origin
project's `apps/*/e2e/README.md` for a worked example):

- **`api` project — the deterministic gate (always-on).** API-level, no browser binaries. CI runs
  this on every PR. Must be green before merge.
- **`browser` project — opt-in real-browser smoke (NOT the gate).** Chromium, asserts *rendered* UI
  an API call can't see. Kept out of the blocking gate (binaries are heavy/slow); run on demand and/or
  on a schedule. A browser spec **replaces a browser smoke previously owed to the product owner** —
  many client-island assertions even work anonymously (no login). Authed/epic smokes read test-account
  secrets and **skip gracefully** when unset.

## Documentation map
- **`Roadmap/`** — product source of truth (this folder). Plain language, no tech. Macro-section →
  Epic → Sprint → Story, plus the feature poster.
- **`Roadmap/LEARNINGS.md`** — the distilled, cross-cutting wisdom from past epics' retrospectives.
  **Read it at session start.** Fed at every epic close — see the epic Definition of Done. The full
  story of any item stays in its epic `RETROSPECTIVE.md`; this is the transferable digest so a retro
  reaches the *next* agent instead of dying in its folder.
- **`Roadmap/00-ideas/`** — the idea funnel: `seeds/` (one .md per idea, lifecycle in **frontmatter** —
  no folder shuffling), `audits/` (UX/UI findings), and `BUILD-ORDER.md` — a **generated** status
  board (`node scripts/build-order.mjs`), **never hand-edited**. See `00-ideas/README.md`. **Status
  SSOT = each epic README's frontmatter `status:`** (seed frontmatter owns only the un-scaffolded
  funnel); `BUILD-ORDER.md` is a *derived view* of it — regenerated, not maintained.
- **`Roadmap/bets/`** — one file per wave: the bets placed, their appetite, and what each displaced.
  Written at the wave boundary (see *Betting & appetite*).
- **`tasks/`** — engineering delivery log: what was built, decisions, commit hashes, runbooks, known
  limitations.
- **Team memory** — durable cross-session facts and pointers, if your tooling keeps one.
- **Retrospectives** — one per epic/sprint, alongside the epic.

## Conventions
- **Gitflow.** Branch off `main` per epic (`feat/<slug>`); commit per story; PR → merge to `main`.
  Never commit feature work straight to `main`, and never force-push a shared branch. Rebase/merge
  latest `main` into a long-running branch before opening the PR. Roll back a bad merge with
  `git revert` on `main`.
- **Branch + preview hygiene (at merge, and as a periodic sweep).** If your deploy rail keeps preview
  deployments forever (e.g. Vercel), deleting a merged branch does **not** remove its preview
  deployments — dead branches pile up stale previews. After deleting merged branches, prune their
  previews with whatever tool your rail supports (dry-run by default; keep any branch with an OPEN PR
  — its preview is the live review target). Same cadence as the branch cleanup itself.
- **Planning commits — own worktree + path-limited.** Multiple sessions running in the same shared
  worktree can collide the git index (a bare `git add Roadmap/` stages a sibling agent's in-flight
  files → "another git process is running" / index lock errors). Two rules remove the contention: (1)
  **commit only your own paths** — `git add <specific files>` then `git commit -- <those paths>`
  (never `git add Roadmap/` or `git add -A`); and (2) for parallel planning, **give each planning
  session its own `git worktree`**, or appoint a single **scribe** for shared files like
  `BUILD-ORDER.md`. Path-limited commits are the single highest-leverage habit — they keep each commit
  clean regardless of what else is in the shared index.
- **Model tiers — a strong-planning / fast-building split, if your tooling supports it.** The origin
  project runs grooming/spikes/plan-mode/review on its strongest available model with full
  deep-thinking, and per-story execution on a faster model once slices are approved — this is a
  default worth adopting, not a hard requirement; adjust to whatever models you have access to.
  **Escalate-don't-guess:** a build session stops and asks / hands back to the planning tier — instead
  of inventing an answer — on the same triggers as the **high-risk tier** defined above (money / auth
  / DB migrations / shared infra) — **plus** plan ambiguity, a decision the plan doesn't cover, or a
  repeated failed attempt (2+ tries at the same problem). Default to escalate when unsure.
- **Docs track code — verified, not generalized.** A canonical rule (your `AGENTS.md`'s cannot-be-
  violated rules) must reflect what the code *actually* does, checked against it — don't globalize a
  scoped learning into a site-wide rule. On the product poster (`README.md`), **✅ means enforced in
  code**, not merely intended — partial/aspirational is 🚧. Run a lightweight **drift audit**
  periodically (paths · imports · env vars · routes · key policy claims vs the codebase).
- Commit messages end with the `Co-Authored-By: Claude` trailer.
- **Language.** Docs are written in **English** — everything under `Roadmap/`, `tasks/`, code
  comments, and PR descriptions. **App copy is different:** the reader's UI strings are owned by
  Miniflux's own i18n system (`panfleto-core/internal/locale/`) and are translated upstream — never
  hardcode a user-facing string in a template when a `{{ t "…" }}` key exists, and never add a
  panfleto-only locale file (that is fork delta, see `AGENTS.md` rule 1). The landing page and the
  welcome email are **English-first**; panfleto's readership is mixed EN/ES and the starter feeds
  reflect that, but a new surface is not bilingual by default — extend deliberately, one surface at
  a time, and say so in the story.
- Build from existing primitives first (your project's canonical system of record for a domain, not a
  secondary datastore or a bespoke route).
- **Session hygiene (long epics).** Running a whole multi-sprint epic in one session is the main
  context-cost driver. The durable state (the plan file, sprint docs, team memory) makes re-entry
  cheap by design — so compact at each sprint/PR boundary, and for big epics consider a **fresh
  session per sprint**. See `LEARNINGS.md → Working efficiently`.
- **Parallel agents + async deploys.** If `main` moves under you and multiple repos deploy at
  different speeds, merge latest `main` into your branch before/while a PR is open; merge the
  data-producing repo first when a consuming repo depends on its data; make the consumer degrade
  gracefully. See `LEARNINGS.md → Multi-agent & async deploy coordination`.
- **Wakeup-resilient orchestration — worker death is a normal case, not an incident.** Running a
  multi-agent batch (several builders spawned in parallel), three rules make death-mid-task
  survivable instead of a per-session rediscovery: (1) **spawn each builder on its own isolated
  `git worktree`**, never the shared root checkout — a killed agent's in-progress tree then can't
  collide with anyone else's. (2) **A killed/rate-limited worker's uncommitted tree is evidence,
  not garbage** — before discarding or re-spawning, diff it; it's often a coherent, attributable
  answer to whatever it was mid-task on. If the same agent id is still resumable, **message it to
  resume with a one-paragraph state recap** (paste its actual `git status`/`git diff` output) rather
  than spawning a cold replacement — a resumed agent's first instinct is to trust its pre-kill
  memory, and the pasted state is what corrects that. (3) **Verify by re-deriving actual repo state,
  never by trusting a worker's own completion report.** A subagent that dies mid-task from a shared
  rate limit still returns a plausible-sounding `result` — that text is its last tool-call
  narration, not proof of completion. After any subagent/fork batch, re-derive directly (`git
  status`/`diff`/`log`, re-run the type-checker/build/tests) before treating it as done.

---

## Tooling — what Claude can drive from the CLI

| Tool | Used for |
|------|----------|
| **git / gh** | Version control, feature branches, PRs + merges, GitHub operations. Also the **submodule** commands once `panfleto-core` is re-rooted. |
| **go** | The reader: `go build ./...`, `go vet ./...`, `go test ./...`, `make miniflux`. This is the primary toolchain — panfleto is more Go than TypeScript. |
| **node / npm** | The landing page (`tsc --noEmit`, `npm run build`) and every `scripts/*.mjs` tool in this repo. |
| **docker / docker compose** | The whole stack locally (`deploy/docker-compose.yml`) — the only way to exercise reader + Postgres + Caddy together before merge. |
| **psql** | Reading the live database. Row counts decide what a migration is safe to do (see *Epic-mode builds* → the architect's locking pass). |
| **playwright** | The `api` gate and the opt-in `browser` smoke — see `e2e/README.md`. |
| **codex / agy / vibe** | The two cross-family review passes, routed by `scripts/review-route.mjs`. All three authenticated as of 2026-09-14. |
| **ssh + oci** | The Oracle VM: `update.sh` (deploy), `backup.sh`, `allow-my-ip.sh`. **Product-owner territory** — see below. |

### What an agent may and may not drive

A story can go from code → verified locally → PR → reviewed → merged, entirely agent-driven. It
**cannot** go to production that way, and that is deliberate:

- **`update.sh` on the VM is a product-owner action.** It rebuilds Go on the single production host
  serving real users, with Postgres holding 3 GB of `shared_buffers` on the same 2 OCPU. An agent
  proposes the deploy and states what to watch; a human runs it.
- **Anything touching Oracle Cloud resources, DNS, Cloudflare, Auth0 or the block volume** is
  surfaced for a green light first. These are the "money / auth / shared infra" triggers in the
  HIGH-risk tier, and on panfleto they are also literally irreplaceable — the Always Free tier has
  no support path.
- **Restoring or writing to the production database** — including the one-time content-cleanup pass
  in `paywall-rail-single-source` — is HIGH tier, runs against a verified-restorable backup, and is
  never an autonomous action.

**Dynamic/parallel-agent workflows — available, not required.** Some coding-agent tools can fan a task
across many parallel subagents with independent verification and adversarial cross-checking. This is
**token-heavy**, so it's worth reserving for two cases: (1) **repo-wide doc↔code drift audits**, and
(2) an **optional adversarial second review of HIGH-risk money-path PRs**. It is **never a gate and
never required**: the deterministic CI gate plus a single-pass reviewer remain the baseline.
