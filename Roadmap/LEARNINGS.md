# Learnings — operating notes for every build

**Read this at the start of every session.** It's the distilled, cross-cutting wisdom from past
epics' retrospectives — the things that would have saved the last agent time. The full story of any
item lives in its epic's `RETROSPECTIVE.md`; this file keeps only the *transferable* rule.

**How this file stays useful (Definition of Done, epic):** at epic close, promote any durable,
generalizable learning from your `RETROSPECTIVE.md` into the right section below — a one-liner + a
*why* + the date/source. **Dedupe** (sharpen the existing line, don't append a near-duplicate). If a
rule here is now wrong, fix or delete it. Keep it short — a long digest is an unread digest.

**TEMPLATE NOTE:** the entries below are a curated, generalized subset carried over from the origin
project (`dobby-foundation`'s own extraction) — the tooling/process gotchas that don't depend on any
particular stack. As you build this project, your own entries will accumulate here; keep the same
one-liner + why + date shape.

---

## Multi-agent & async deploy coordination
*If several agents work in parallel on their own branches, against repos that deploy independently.*

- **`main` moves under you.** Before opening a PR — and again if it sits open — **merge latest `main`
  into your branch**. Tell-tale: CI fails on a spec/check for something you never touched → a sibling
  agent landed something on `main` and your preview (if you have one) predates it. **A re-run alone
  won't fix it** — the mismatch is structural; only `git merge origin/main` + push clears it. Confirm
  with `git log HEAD..origin/main`.
  **Corollary — the stale-vs-fresh mismatch can hit your own NEW code too, not just an untouched
  check, when a sibling PR changes a shared file's CONVENTIONS (a lint rule, not a feature).** The
  diagnostic tell: check whether a FAILING assertion is about a rule/convention that changed, not just
  a feature/data mismatch.
- **Announce cross-cutting or direct-to-`main` changes**, and prefer a PR even for "engine" features.
  Anything touching shared surface — a root layout/middleware file, global styles, `package.json`/deps,
  a new sibling worktree — can break every other open PR.
- **Don't yank a shared branch out from under another agent.** If the repo's working tree is on
  someone else's branch, do your change in an isolated `git worktree` instead of switching it.
  **Corollary — checking CI status and merging a PR need no local checkout at all.** `gh pr checks <N>`
  and `gh pr merge <N>` operate against the pushed remote branch via the GitHub API; they don't care
  what's checked out locally.
- **Before building a story, grep whether a sibling PR already fixed the identical root cause.** Two
  epics approved the same day can target the same bug from different scope docs. Check
  `git log --oneline -- <the file the story's root-cause names>` + `gh pr list` during research, not
  assumed.
- **Risk tier decides who merges**: low-risk → the reviewer/agent may merge on green CI; anything
  touching money / auth / DB / shared infra → the product owner merges. When unsure, treat as high.
  **Corollary — an explicit "merge on green" authorization changes who decides to pause and check in,
  not whether the review layers themselves still run.** "Merge on green" is permission to proceed
  through the established gate without re-asking at each step, not permission to skip the gate.
  **Corollary — a "merge on green" given for one PR does not carry forward to a LATER PR in the same
  session/epic, even a similarly-scoped one**, and a builder's own plan can promise a review step the
  standing authorization never touched. Re-check whether a standing "merge on green" was given for
  *this* PR/story, not just somewhere earlier in the conversation.
- **When your branch is BEHIND `main`, the two-dot `git diff main..HEAD` lies — read the three-dot.**
  Two-dot compares tips directly, so it folds in the *inverse* of every commit `main` gained since you
  branched (a sibling epic's new files show up as "deletions" in your diff — alarming and wrong).
  Review with **three-dot `git diff main...HEAD`** (merge-base→HEAD = only your changes), and **merge
  `origin/main` into the branch before merging the PR** so the merged tree is what actually ships.
- **A squash-merged sprint branch is a dead end — start the next sprint on a FRESH branch off `main`.**
  A squash-merged PR's individual commits aren't on `main` (only the one squash commit is), so
  continuing that branch for the next sprint re-introduces a messy duplicate diff and can't
  fast-forward. Branch clean off `origin/main` for each new sprint.
- **To verify "is the prior sprint serving?", reason off `origin/main` — never the working tree — and
  read PR *state*, not branch commits.** Local app checkouts routinely sit on *other* agents'
  branches, so on-disk files lie about `main`, and a squash-merged sprint's individual commits
  genuinely aren't on `main`. Confirm with `gh pr view <#> --json state,mergeCommit` or `git fetch`
  then `git grep <x> origin/main` — an `ls`/working-tree read is not evidence about `main`.
- **Concurrent planning commits in a shared worktree collide the git index.** Fix: (1) **path-limited
  commits** — `git add <your files>` + `git commit -- <those paths>`, never `git add -A`; (2) for
  parallel planning, give each session its own worktree, or appoint a single **scribe** for shared
  files (like `BUILD-ORDER.md`).
- **A subagent/fork that dies mid-task from a shared session rate-limit still returns a `result` — that
  text is its last tool-call narration, not a trustworthy completion claim.** After any subagent/fork
  batch — especially one large enough to plausibly share a rate-limit, or any showing a failed status —
  re-derive actual file state directly (grep the real repo) and run the language's type-checker/build
  before treating the batch as complete.

## Working with a vendored fork
*panfleto's reader is a Miniflux fork. These are the rules that fall out of that, and they generalise
to any project carrying someone else's codebase.*

- **Reconstruct a vendored fork's base by blob-matching, never by dates.** (2026-09-14, the fork
  audit) A pasted-in copy has no merge base, so "when was this forked" has no git answer. What works:
  hash a file upstream changes often (`go.mod`), search upstream history for that blob to get a
  rough window, then minimise whole-tree diff across candidate commits in that window. It found
  `06e36c3e` exactly — and the naive date-based guess was off by three commits and 9 files, which
  would have meant replaying upstream's own code as "our patches".
- **Before replaying a patch, check whether upstream already has it.** (2026-09-14) Two of panfleto's
  apparent customisations were upstream's: a disabled cross-origin middleware (upstream's own revert,
  at the fork point itself) and an index-dropping migration (upstream's `bdd7f4f3`). Replaying either
  creates a conflict against identical code. *Why it matters:* the delta you think you have is always
  bigger than the delta you actually have, and the difference is pure wasted rebase pain.
- **Find out what a local patch is a workaround FOR before carrying it forward — then count what its
  replacement needs.** (2026-09-14, sharpened 2026-09-15 by the resync) The `cspNonce` patch existed
  solely so one inline `<script>` could share the CSP header's nonce; replacing that script with a no-JS
  template loop did retire the patch. But the promised "three of twelve delta files gone" was wrong: a
  template loop still needs Go to hand it data, so the files stayed (smaller). *Why it matters:* an
  understood patch is removable, but a delta *count* promised before the replacement's plumbing is
  sketched is a guess.
- **`schemaVersion = len(migrations)` means a custom migration is a permanent conflict.** (2026-09-14)
  When upstream appends to the same slice, a migration you own at index N collides at every rebase,
  and wrong ordering on a deployed DB is unrecoverable without a restore. Zero custom migrations is
  a property worth protecting, not an accident. See `AGENTS.md` rule 3.
- **Rolling back an upstream sync is not moving the pin back — rehearse the down-SQL on a restored copy.**
  (2026-09-15, the resync) Miniflux's binary refuses only an *older* schema, so a rolled-back image boots on
  the newer one; but a migration that rebuilt a unique index on a new expression makes the old code's
  `ON CONFLICT` fail (42P10) on every write while the healthcheck stays green. Write per-hop down-SQL,
  run it against a restored dump **on the production host** (data never leaves it), and judge a rollback by the
  log after the next real write cycle, not by a 200.
- **Audit a rebase's conflict surface for binary files and deletions, not just text.** (2026-09-15) The
  audited `layout.html` commit also deleted five favicon PNGs the fork had rebranded — a modify/delete
  conflict no text-diff count showed — and taking upstream's replacement would have silently swapped the
  product's favicon for upstream's logo. Assert branding in a spec so a future sync can't do it quietly.
- **Every file you add to a fork is rebase tax paid forever.** (2026-09-14) Exhaust config options,
  per-entity settings, a repo-local script against the upstream API, and an upstream PR *before*
  patching. The delta count belongs in the project's rules as a number, so growing it is a visible
  decision rather than a drift. **A scope doc's "put the helper beside the others" is exactly how the
  count grows unnoticed** (2026-09-15, paywall-rail): check the target file against
  `git diff --stat upstream...HEAD` before accepting it — the unwall link needed no Go at all.
- **Amending a fork topic commit: move the fork branch before merging the pin, and tag both tips.**
  (2026-09-15, paywall-rail) Rewritten history means the new pin is reachable only through a branch until
  the fork's main branch is force-pushed, and the old pin — every earlier superproject commit's rollback
  target — only through a tag. Merge the pin second, or the weekly sync rebuilds from a tip that lacks
  the change.

## Scoping against production
- **Query the live database before believing a scope doc about production data.** (2026-09-15, both
  `adblock-rule-false-positives` and `paywall-rail-single-source`) Two epics scoped from the scripts'
  history were both wrong about production: the "cleanup" had 0 rows because the database postdated
  the script's last run, and the "rule dropping articles" had never reached a feed. Seconds of `psql`
  removed a HIGH-tier write and turned a bug fix into a first-time rollout. Ask *which install did this
  ever run against*, not just *what does the code do*.
- **An API that ignores unknown JSON fields turns a wrong field name into a silent success.** (2026-09-15,
  adblock) `PUT /v1/feeds/{id}` with `block_rules` returned 200 for months and changed nothing — Go's
  `encoding/json` drops unknown keys. Read back what a script wrote, or test its payload's field names
  against the model.
- **A filter that matches URLs needs URL cases in its tests.** (2026-09-15, adblock) Miniflux block rules
  match URL, author and tags as well as title; the old stem `ad` would have silenced two whole feeds
  through their domains (`jornada.com.mx`), which no headline test shows.

- **A preview deployment is not free when Preview shares production's `DATABASE_URL`.** (2026-09-15,
  spike-personalized-editorial) `editorial-panfleto`'s build command is `pnpm payload migrate && pnpm build`
  and its Preview env inherits the production database URL — so an ordinary preview deploy would have run
  CMS migrations against the live newsroom DB. Check a project's build command AND its per-environment
  variables before deploying a throwaway branch; a one-function, no-build deployment with a
  deployment-scoped secret is the safe shape, and delete it the same day.
- **`limit=N` on a feed API is a TIME WINDOW, not a page size.** (2026-09-15) `limit=100` covered 2 h 7 min
  of one real reader's day; the day held 1,156 entries across 26 feeds. Any "daily" page designed against a
  round limit is silently a "last two hours" page. Measure the span N covers for a real account first — and
  check the API's ceiling (Miniflux refuses `limit > 1000`) before assuming a day fits in one request.
- **Corroboration must count publishers, not feeds.** (2026-09-15) Two BBC feeds and two NYT feeds in one
  account made BBC stories look corroborated by BBC. Any cross-source signal needs a publisher identity
  above the feed row, or duplicate subscriptions manufacture agreement.
- **Probe a third-party dependency from the production IP, and check what its 200 contains.** (2026-09-15,
  spike-unwall-app + inline-comments) From the VM, `unwall.app/{host}{path}` answered 200 as an app shell (the
  article came from a JSON API found in its bundle), archive.ph was refused by the VCN resolver and timed out by IP,
  and Reddit answered 403/429 within three calls. From a laptop all three looked different. Test DNS (`getent`
  vs `dig @8.8.8.8`) and TCP separately, or you misread which layer said no. It cut two stories before they were built.
- **Judge a rollout by what it stored, not by a median going up.** (2026-09-15, article-autofetch) The first crawler
  poll's medians looked like a clean win, but Techmeme's was 105K characters: its item links are anchors into its
  front page, so every entry stored the whole river. Read the outliers in the first cycle before calling it healthy.
- **Moving work off a hot path breaks every caller that relied on it running inline.** (2026-09-15, article-autofetch)
  With scraping deferred to a queue, a forced feed refresh still rewrote stored content from RSS but no longer
  re-scraped it, so fetched articles silently reverted to teasers. The after-scrape filter pass and integrations also
  lost the full text. List everything that ran after the inline call and give each one a deferred equivalent, or
  write down why it doesn't need one.

## Tooling gotchas
- **Under a strict Trusted Types CSP a policy name is a singleton, and a bare fragment route has no CSP.**
  (2026-09-15, inline-comments) `trusted-types html url` forbids a second `createPolicy('html')`, and upstream's
  Download button created one per press, so the second press threw. Share one policy and route every `innerHTML`
  through it, the error path included. A route returning a fragment of third-party HTML carries no page CSP, so it
  needs its own sandbox header. And `fetch` follows a session redirect into your DOM, so use `redirect: "error"`.
- **Postgres ARE takes a whole regex's greediness from its FIRST quantifier.** (2026-09-15, paywall-rail)
  `'<hr\s*/?>…(.*?)</p>'` is greedy throughout because `\s*` comes first, so `regexp_replace(…, 'g')`
  eats everything between the first and the last match. Use negated classes (`(?:[^<]|<a\s[^>]*>[^<]*</a>)*`)
  instead of `.*?`, and prove it on a row with two occurrences and text between them.
- **A script with a co-located pure-logic test file MUST guard its `main()` call with an `isMain`
  check.** Importing a script that calls `main()` unconditionally at module scope re-executes the
  whole script for real (shell-outs, notifications, git pushes, all of it) the moment a test file
  loads it for its pure helpers: `const isMain = process.argv[1] && …; if (isMain) main()`.
- **Run the repo binaries directly when `npm`/`npx` chokes.** A sibling worktree that reuses the same
  `package.json` name as the main checkout breaks npm **workspace resolution** at the monorepo root.
  Use the binary path directly (`node /…/node_modules/typescript/bin/tsc --noEmit`,
  `/…/node_modules/.bin/{next,playwright}`). New worktrees should use a unique package name or be
  excluded from the root `workspaces` glob.
- **A worktree needing its own `npm install` forces worktree-local binaries for everything, including
  test runners.** A fresh `git worktree` resolves most tooling fine via walk-up to the root
  `node_modules`, but if any dependency needs a local install (e.g. a CSS framework's PostCSS plugin
  resolution), that install adds a worktree-local copy of your test framework too — switch to the
  **worktree-local** binary path, or you'll hit "two different versions" / "No tests found" errors.
- **`gh pr merge --delete-branch` fails when a worktree holds `main`.** The merge still succeeds on
  GitHub; only the local branch-delete errors. Verify with `gh pr view <n> --json state`.
- **A server-side `process.env.X ?? \`https://${req.headers.get('host')}\`` fallback is a real
  production landmine, distinct from client-bundle build-time-inlining bugs.** The trap is the
  Host-header fallback when the env var is unset: a bare container run without an explicit runtime env
  var can get a literal `0.0.0.0:PORT` or similar garbage as the `Host` header, and the fallback
  happily builds a broken URL from it — dangerous on any redirect-URL-building code path (OAuth
  callbacks, payment-provider return URLs). Fix: one shared `resolveOrigin()`-style helper that
  rejects obviously-wrong hosts and **throws instead of silently building a broken URL** — a loud
  failure beats a dead redirect.
- **A unit-tested pure helper can't live in the same file as code that imports a framework/runtime-only
  module** (e.g. a Next.js `next/cache` import, or an auth SDK's server-only entrypoint). A generic
  test runner that can't load that module throws an opaque, unrelated-looking error the moment it
  imports the file at all — even if the pure function itself never touches the framework-only code.
  Keep the pure logic in its own zero-import file; let the framework-touching wrapper import *it*.
- **Swapping a framework-generated artifact for a hand-rolled route breaks specs on exact format.**
  Converting a typed/generated file (robots.txt, sitemap, OG image, metadata) to a hand-rolled
  equivalent can silently change output details (header casing, field order) that an existing spec
  asserted on. When you replace anything a framework generates, diff the *exact bytes* the old one
  emitted and grep the suite for any spec asserting that surface.
- **CI sometimes just doesn't schedule a workflow for a PR.** Seen occasionally on `opened`; close/
  reopen doesn't always fix it — an empty-commit push (a real `synchronize` event) does. Don't merge
  on an absent gate: re-trigger, and lean on the local gate + a green preview as the real signal.
- **`node --test <dir>` (bare directory) can silently fail to discover tests depending on your Node
  version** — it may try to load the directory as a module instead of globbing it. Use an explicit
  glob: `node --test 'scripts/lib/*.test.mjs'`.
- **A "resolve the PR from the current branch" tool must read PR `state`** — a list/view call can
  return MERGED/CLOSED PRs too, especially for a reused branch name whose PR already merged. Treat
  `state !== 'OPEN'` as "no open PR for this branch" and pair it with a stale-HEAD guard
  (`git rev-parse HEAD` vs the PR's `headRefOid` → warn + require an explicit override) so the first
  run always reviews the current diff.
- **A hosted CLI-authenticated integration (Vercel-style env-var management, similar platforms) can
  silently store or report EMPTY values** through a convenience CLI command even when the underlying
  API call "succeeds." Verify by value **length** where you can't read the value directly (a scoped
  read token may be needed), not just by exit code.
- **A "sensitive"/write-only secret is confirmable by presence/type but not by value** — you can check
  it exists and which environment it targets, but not its actual content, from a CLI or API. Read the
  provider's dashboard, or have the app surface the cause on use (missing key → a specific, classifiable
  error) instead of guessing.
- **Driving a young foreign CLI: run `<cli> --help` first, pin the version, and design for degrade —
  never build against a documented flag from memory.** A less-mature CLI can have surprising interface
  shapes (no JSON output mode, arguments only via argv not stdin, or vice versa) that don't match a
  more mainstream CLI's conventions. Smoke-test by running it against something real and reading the
  actual output before scripting around it.
  **A young foreign CLI can silently break its own contract on a MINOR version bump** — a print mode
  that used to always emit something can start exiting 0 with empty output on a real failure. Treat
  **empty output as failure** (not success), and make any version-pin check **fail loud** so a
  contract break gets caught, not silently absorbed. **It can also auto-update itself mid-session**
  (agy went 1.2.1 → 1.2.3 inside one epic, tripping the pin twice) and stall when several runs share it —
  re-probe on a pin mismatch and run one pass at a time.
  **A CLI authed by an interactive/OAuth login is NOT free to run in CI** — confirm a portable
  non-interactive credential path AND its cost before automating it in a runner; some CLIs have no
  headless auth at all, which may mean an advisory/local-only tool stays local-only rather than
  becoming a CI job.
- **`process.exit()` truncates piped stdout — flush synchronously, or you ship a tool that works to a
  file but crashes in a pipe.** A script that does `console.log(json); process.exit(0)` can produce
  valid output when redirected to a file (sync writes) but truncated output down a pipe, because the
  async stdout write hasn't drained when exit fires. Use a synchronous write before `process.exit`, or
  exit in the write callback. Test a tool the way it's actually invoked (pipe, not just file redirect).
- **Git background auto-maintenance can race a burst of rapid commits and leave stale `*.lock`
  files**, producing intermittent "cannot lock ref" errors. Clear locks recursively
  (`find .git -name '*.lock'`) and run a rapid-commit batch with `git -c gc.auto=0 commit …` so
  auto-maintenance can't re-trigger mid-sequence.
- **A delta-only reporting tool must special-case a missing/wiped baseline as a bounded no-op, never as
  "everything happened."** Diffing current state against an empty/`null` previous snapshot makes every
  historical item look "new" — guard for a missing baseline with ONE bounded summary (counts only)
  instead of enumerating full history, and keep a message-length safety net regardless of the guard.
- **A script with both scheduled state-tracking delivery and on-demand artifact generation must keep
  the artifact mode stateless.** Reusing a stateful window/log rail for an on-demand report mode risks
  silently advancing state a scheduled run depends on — keep on-demand modes explicitly
  non-state-mutating and lock that with a test.

- **`gh` resolves a git remote named `upstream` as the base repository.** (2026-09-15, the resync's sync
  workflow) A job that adds `upstream` for a fork and then runs `gh pr create` / `gh issue create` aims them at
  the upstream project; it failed only because the branches didn't exist there. Set `GH_REPO` for every job
  that has such a remote. *Found by exercising the PR path on a throwaway branch* — the first real run said
  "nothing to do" and would have hidden it for weeks.
- **`GITHUB_TOKEN` can never push commits that touch `.github/workflows/*`.** (2026-09-15) A bot that rebases a
  fork onto upstream pushes upstream's history, which includes dependabot action bumps, so it needs a token with
  workflow scope (and a repo can separately forbid Actions from opening PRs). Decide the credential at design
  time, not after the first failed push.
- **A deploy script that `git reset --hard`s its own checkout runs the OLD script on that run.** (2026-09-15)
  bash keeps reading the replaced inode. When a change edits the deploy script itself, deploy by resetting
  first and then invoking the new script.
- **A copy-once template clobbers same-named files — diff before you trust the copy.** (2026-09-15,
  the ways-of-work bootstrap) `cp -R template/. .` silently replaced the project's `README.md` with
  the template's. `git diff --stat` caught it; nothing else would have. Check `.gitignore` too — if
  the template ships one, the project's is the one carrying the secret exclusions.
- **A silent enum fallback makes drift undetectable exactly where it matters.** (2026-09-15) Two live
  examples in the shared tooling, both found by reading rather than by a failure:
  `roadmap-to-notion.mjs`'s `TYPE_LABEL` has no `bug`, so every bug renders as a Feature, while
  `scaffold-epic.mjs` validates against a list that includes it; and `BUILD-ORDER.md`'s funnel sorts
  by `priority`, never by `build_order`, so the board's order is not the agreed order. *The rule:*
  when two scripts share an enum, one validating and one labelling, they drift — and the labelling
  one fails silently. Report upstream to `dobby-foundation` rather than patching in one consuming
  project; a fork of a shared script is the drift the plugin exists to prevent.

## Working efficiently
- **A spike's builder must not supply the verdict on the taste question the spike exists to inform.**
  (2026-09-15, spike-personalized-editorial) The run rendered a real edition and its own read pointed at
  an LLM ranking pass — the product owner read the same page and said *tuning*, which is a materially
  cheaper wave. Write the decision doc so the builder's read is labelled as such and the decision stays
  `PENDING` until the owner answers in their own words; a self-approved taste call buys scope nobody asked for.
- **Running a whole multi-sprint epic in one session is the main context-cost driver.** The durable
  state (the plan file, sprint docs, team memory) makes re-entry cheap by design — compact at each
  sprint/PR boundary, and for big epics consider a fresh session per sprint.
