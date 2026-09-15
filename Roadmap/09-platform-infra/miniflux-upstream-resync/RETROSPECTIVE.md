# Put panfleto-core back on upstream's timeline — Retrospective

_Closed: 2026-09-15_

## What shipped

**panfleto's reader now runs current Miniflux, and staying current is a weekly button rather than an
archaeology project.** Production went from a pasted-in copy 131 commits and three releases behind, with no
merge base, to `miniflux/v2` `main` (`76889f08`) plus six named panfleto commits. The four months of upstream
fixes it had missed are live, including the username-timing fix, the OAuth identity-field fix and
`DISABLE_LOCAL_AUTH` enforcement on the API. Nothing a reader sees changed except the subscribe page, which
lost 20 CSP violations and gained six suggestions.

| Sprint | What's now true | PR · merge · deployed |
|---|---|---|
| S1 · Re-root | `danybgoode/panfleto-core` is a real fork: `upstream` remote, `panfleto` rooted at `06e36c3e`, the delta replayed as five topic commits, byte-identical to the vendored tree. Wired in as a submodule; `update.sh` initialises it | #1 · `27fe3b6` · 2026-09-15 01:00 UTC |
| S2 · Rebase forward | S2.1: a bucket dump restored and verified *before* any deploy. Hop 1 → v2.3.3 (migrations 131–132), soaked through a full refresh cycle. Hop 2 → `upstream/main` (133–134). Both hops' migrations **and their rollbacks** rehearsed on a restored production copy on the VM | #2 · `6c53c96` · 01:36 · #3 · `02e065c` · 02:39 |
| S3 · Shrink + automate | One `feeds.json` replaces four lists (Go onboarding, the subscribe-page table, the landing signup, the categoriser). The subscribe page is a no-JS loop, so the CSP nonce patch is gone. The weekly `panfleto upstream sync` workflow is observed on every path | #4 · `26400f3` · 02:42 · #5 · `777c3c0` · 03:01 |

The proof, as the pitch promised: `git rev-list --count panfleto..upstream/main` = 0, and
`git log --oneline upstream/main..panfleto` lists exactly the six topic commits. Deployed pins are all tagged:
`pre-resync`, `resync-hop1-v2.3.3`, `resync-hop2-main`, `resync-s3`, `resync-done`.

## What went well

- **Locking decisions against the live system before building paid for itself.** Reading the tree and the database
  instead of the scaffold corrected **four** scoped claims before they became bugs: four migrations, not two (D6);
  `/about` can't report 2.3.3 from a git-less Docker build (D9); `/about` isn't anonymous; "delta 12 → 9" was
  unreachable while keeping D4 (D13). Each correction is written into the README, not rediscovered mid-build.
- **Rehearsing on a restored copy of production, on the production host,** made the one irreversible part of the
  epic boring: every migration ran first on real data (0.12–0.45 s), and no production data left the VM.
- **The fresh reviewer subagent was the review layer that found real bugs, four times over:** the first `update.sh`
  run executing the *old* script, the rollback that looks green but breaks every enclosure write, `GITHUB_TOKEN`
  being unable to push workflow-file changes, and an `accept` race. The external passes mostly re-reviewed the
  delta's existing behaviour and repeatedly flagged upstream's own columns as missing migrations.
- **Exercising the automation on throwaway branches instead of trusting a green "nothing to do" run** found the
  worst bug of the epic: `gh` was aiming the sync PR at miniflux/v2.
- **Two hops kept the evidence attributable.** Hop 1's soak (48/48 feeds, 62 enclosures written through the new
  index, zero errors) meant hop 2 started from a proven state, not a hopeful one.

## What we learned

- **A rolled-back binary happily boots on a newer schema — and an expression index can make it fail silently.**
  Miniflux refuses only an *older* schema. Once migration 131 rebuilt the enclosures unique index on a new
  expression, the old binary's `ON CONFLICT (…md5(url))` hit 42P10 on every refresh while `/healthcheck` stayed
  200. Rollback needs down-SQL, and it has to be rehearsed, not written.
- **A conflict-surface audit that counts text files misses binary modify/delete conflicts.** `aa509b88` was the
  audited `layout.html` commit, but it also deleted five favicon PNGs; taking upstream's `icon.svg` as-is would have
  silently swapped the favicon for Miniflux's. The spec now asserts the favicon is panfleto's.
- **A script that `git reset --hard`s its own checkout runs the old version on that run.** bash keeps reading the
  replaced inode. Any change to `update.sh` needs a reset-first deploy.
- **`gh` treats a git remote named `upstream` as the base repository.** A bot that adds `upstream` must pin
  `GH_REPO`, or its PRs and issues go to someone else's repo.
- **`GITHUB_TOKEN` can never push commits that touch `.github/workflows/*`.** A rebase-tracking bot needs a token
  with workflow scope, because upstream's history contains dependabot action bumps.
- **"Remove the workaround and the patch deletes itself" was only half true.** Deleting the inline script did
  retire the nonce patch, but a template loop still needs Go to hand it data, so `view.go` stayed in the delta.
  Count the plumbing a replacement needs before promising a smaller number.
- **Young review CLIs drift inside one session.** agy auto-updated twice (1.2.1 → 1.2.3), breaking its version
  pin each time, and stalled when run in parallel. Codex was capped for the whole epic.

## Gaps / follow-ups

**Owed to the product owner (credential-gated smoke, not automatable here):**
- Sprint-1 walkthrough steps 3–5 in production (signed in: look and feel unchanged).
- Sprint-2 walkthrough steps 2–7 (Auth0 sign-in, article + rail, Download, star, subscribe, the MCP panel).
- Sprint-3 walkthrough steps 1–5 (suggestions, a clean console, Quick Add, Review, **a brand-new account's starter feeds** — not
  exercised in production to avoid a real welcome email and Telegram ping; both signup paths were verified locally,
  and the landing container's live read of `feeds.json` was verified in production).

**Decisions to revisit:**
- **D14 — `SYNC_TOKEN` is the owner's gh CLI token** (`repo` + `workflow` on all repos). Swap it for a fine-grained
  token scoped to `danybgoode/panfleto-core` (contents, pull requests, issues, workflows): `gh secret set SYNC_TOKEN
  --repo danybgoode/panfleto-core`.
- **Upstream's dependabot still runs on the fork** and will open bump PRs weekly/monthly; they should be closed
  (bumps arrive through the rebase). Disabling it needs a repo setting or a delta file — not done.
- **The first *scheduled* sync run** (Monday 06:17 UTC) is still to be observed; every path was observed on dispatch.

**Pre-existing, surfaced by reviews, deliberately not changed here (rule 1 / out of scope):**
- `/integrations` still carries 4 CSP violations (the MCP panel's inline styles and `onclick`).
- Onboarding runs only on the Auth0 path, fire-and-forget; `TELEGRAM_BOT_TOKEN`/`RESEND_API_KEY` are passed only
  to `landing`, so Auth0 signups never send the welcome email or the ping. Tracked by
  `onboarding-provisioning-reliability`.
- `DISABLE_LOCAL_AUTH` must not be enabled until `/api/register` uses an admin API key (warning in
  `deploy/oauth.env.example`).
- The Telegram chat id and Resend from-address are hardcoded.
