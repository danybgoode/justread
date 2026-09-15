# Put panfleto-core back on upstream's timeline — Sprint 3: Shrink the delta and automate the sync

**Status:** ✅ deployed — #4 (`26400f3`), final pin `fa1046df` (tag `resync-done`) in the close-out PR

> **Architect's correction (2026-09-15):** this sprint's scaffold was written from the tree before the S2
> rebases, and four of its claims don't hold. The corrected shape is **README D13**, and the stories below
> are measured against D13 rather than the struck-through lines.

> **Build contract (locked by the architect before the builder started)**
>
> - **D4 · the suggested-feeds table is rebuilt from `feeds.json`**, not preserved as markup. It is
>   ~240 lines of hand-written table in a file upstream also edits, for a feature that is a loop.
> - **Order matters, and it is the point of this sprint.** Story 3.1 removes the inline `<script>` at
>   `add_subscription.html:351`; only *then* does 3.2 become a no-op deletion rather than a
>   behaviour change. Doing 3.2 first breaks the subscribe page's CSP.
> - **Verify D5 before starting:** confirm `add_subscription.html:351` is still the only consumer of
>   `.cspNonce` outside `layout.html`. *(Verified at `upstream/main` (2ee92c9b): still the only one.)*
> - **This sprint removes code.** If it is adding net lines, something has gone wrong.
> - **Low risk, and it is the only low-risk sprint in this epic** — no migrations, no auth, no
>   production data. A non-builder agent may merge on green.

## Stories

### Story 3.1 — One feeds.json, three lists gone
**As a** maintainer, **I want** every recommended feed listed in exactly one file, **so that** a dead
feed is fixed once instead of three times and the fork stops carrying 240 lines of table markup that
upstream also edits.

Today the same knowledge lives in three places: 13 feeds hardcoded in Go
(`internal/ui/user_onboarding.go`), roughly the same list as hand-written table rows
(`views/add_subscription.html`), and a keyword→category map in `scripts/enhance_miniflux.js`. The
most recent commit on this repo before the bootstrap was *"Replace three starter feeds that no longer
work"* — which is what maintaining three copies feels like.

**Acceptance:**
- One `feeds.json` holds every feed's URL, title and category
- `user_onboarding.go` reads it ~~via `go:embed`~~ (via upstream's existing `bin/*` embed and `view.SuggestedFeeds`) — no hardcoded list remains
- *(added by D13)* the landing page's `/api/register` reads it too — its own 16-feed copy is gone
- The subscribe page renders its suggestions in a **template loop** over the same data
- A new account still arrives with the same feeds, categorised the same way
- The subscribe page still offers Quick Add and Review for each suggestion
- ~~`scripts/enhance_miniflux.js` reads the same file rather than its own map~~ → it has no feed list, only a keyword → category map for any feed. It now categorises feeds that are on `feeds.json` by URL first, and keeps the keyword map for everything else (D13)
- Adding a feed to `feeds.json` and nothing else makes it appear in **both** places

**Result (2026-09-15):** ✅ locally. Fork commits `a76c83c9` (onboarding + `feeds.json` + loader) and
`28bc8650` (subscribe page), in a history rebuilt as six topic commits on `upstream/main`, each building
on its own.
- `feeds.json`: 23 feeds, 16 `starter`. It is the union of the old lists, and the titles for feeds that
  were only in Go were fetched from the feeds themselves.
- **Subscribe page:** a loop of POST forms + Review links, no `<script>`, no `style=`. Logged-in browser
  smoke: 23 rows; **Review** → `/bookmarklet?uri=…` with the URL pre-filled; **Quick Add** on xkcd →
  `/feed/1/entries` "xkcd.com".
- **New accounts, both paths, same 16 feeds** `{Tech 5, News 4, Business 2, Comics 1, Culture 1, Podcasts 3}`:
  the landing signup run locally against the stack (`POST /api/register` → 16), and `provisionUserOnboarding`
  exercised directly by a throwaway, uncommitted Go test against the local Postgres (16, and `entry_direction`
  `desc` / `default_home_page` `feeds` intact).
- **Specs:** `scripts/feeds-json.test.mjs` (3 tests — schema; no file hardcodes a listed URL; no inline
  script/nonce) is **red at hop 2** (3 failures) and green at S3. `e2e/subscribe-suggestions.spec.ts` (served
  `feeds.json`; the signed-in half with a password account) passes 8/8 locally with `reader-health`. **Observed red:**
  one suggestion dropped from the loop → the signed-in test fails; production before this deploy → the
  anonymous test fails (no `feeds.json` served yet).

**Risk:** low

### Story 3.2 — The nonce patch returned to upstream
**As a** maintainer, **I want** `view.go` and `layout.html`'s nonce line back to upstream's version,
**so that** the fork stops carrying a CSP patch it no longer needs.

The `cspNonce` in `internal/ui/view/view.go` exists for exactly one reason: the inline `<script>` at
`add_subscription.html:351` needs the same nonce `layout.html` put in the CSP header, and calling
upstream's `nonce` function again would produce a different one. Story 3.1 deletes that inline
script. So this story is a deletion, not a rewrite — and it takes the delta from 12 files to **9**.

**Acceptance:**
- ~~`internal/ui/view/view.go` is byte-identical to upstream's~~ → the nonce is gone from it, but it stays in the delta as the `feeds.json` loader (D13)
- `layout.html` differs from upstream **only** in branding (title, apple-mobile-web-app-title, the
  `pan<span>fleto</span>` logo) — the `{{ $cspNonce := nonce }}` line is upstream's again
- ~~`git diff upstream/main..panfleto --stat` shows **9 files** plus icons~~ → 12 code/template files + `feeds.json` + the workflow + 17 icons (D13)
- The subscribe page loads with no CSP violation in the browser console
- `AGENTS.md` rule 1's stated delta count is updated ~~from 12 to 9~~ to what S3 actually left (D13)

**Result (2026-09-15):** ✅ locally. `layout.html`'s nonce line is upstream's again, and `view.go` no
longer mentions `cspNonce`. Chromium console, logged in, against D10's baseline: `/unread` 0 · `/feeds` 0 ·
**`/subscribe` 20 → 0** · `/integrations` 4 (unchanged — the MCP panel, a logged follow-up) · `/about` 0.

**Risk:** low

### Story 3.3 — The weekly sync that makes this stick
**As the** product owner, **I want** a weekly attempt to rebase onto upstream that tells me the
result, **so that** panfleto is never four months behind again without anyone noticing.

**Acceptance:**
- A scheduled GitHub Action on `panfleto-core` fetches `upstream`, rebases `panfleto` onto
  `upstream/main` on a throwaway branch, and builds it
- Clean + building → it opens a PR
- Conflict or build failure → it opens an issue **naming the conflicting file**
- Nothing to do → it exits quietly without opening anything
- The first run has been observed doing one of the three
- The workflow lives on `panfleto-core`, not here — this repo only moves the pin
- *(added by the S2 fresh review)* accepting a sync tags the replaced tip first, so an old superproject pin stays fetchable

**Built (2026-09-15):** `.github/workflows/panfleto-upstream-sync.yml`, fork commit `962dcf5d`, the sixth
topic commit. Weekly (Mon 06:17 UTC) plus `workflow_dispatch`. Nothing to do → a step summary only. Clean
and green → force-pushes `sync/upstream-main-<branch>` and opens or refreshes a PR whose body says **not** to
merge through GitHub (a rebase rewrites history). Conflict → an `upstream-sync` issue naming the files and the
stopping commit. Red build → an issue naming the failed step. Accepting = dispatch with `accept: true`, which
tags the current tip `pre-sync-<stamp>` and force-pushes the sync branch with lease. Actions are pinned to the
SHAs upstream uses, and `actionlint` is clean. The first observed run is recorded below after deploy.
**Fresh review on #4 → fixed** (fork tip `0f4bbb68`): pushes and PRs use the `SYNC_TOKEN` secret (D14), because
`GITHUB_TOKEN` can't push workflow-file changes or open PRs on this repo; `accept` refuses unless `panfleto` is still
the SHA the sync PR recorded (`<!-- sync-base: … -->`), so a later push to `panfleto` can't be silently dropped; the
conflict issue tells people to push the sync branch and `accept`, never `panfleto` directly. In the superproject,
`guards.yml` checks out the submodule and triggers on the pin, and `feeds-json.test.mjs` throws in CI rather than
skipping.

**Risk:** low

## Deployed + observed (2026-09-15)

**S3 live (02:42 UTC, merge `26400f3`, `update.sh` 79 s, reader and landing both rebuilt):**
- The fork's `panfleto` moved `2ee92c9b` → `0f4bbb68` (force-with-lease; tag `resync-s3`). Boot: `current_version=134
  latest_version=134`, no error.
- `npx playwright test --project=api` against production: **7 passed, 1 skipped**. `reader-health` 6/6, the anonymous
  `feeds.json` test passes, and the signed-in half skips (production signs in through Auth0 — owed below).
- `https://app.panfleto.win/icon/x/feeds.json` → 200. **Inside the running landing container**, the S3 code path
  (`new URL("/icon/feeds/feeds.json", MINIFLUX_API_URL)`) reads **23 feeds, 16 starters `{Tech 5, News 4, Business 2,
  Comics 1, Culture 1, Podcasts 3}`**. A real production signup was deliberately *not* made (it would send a real
  welcome email and a Telegram ping); it is owed below.

**3.3 — first runs observed on the fork (all dispatched by hand):**
| Run | Branch | Outcome |
|---|---|---|
| `34922335174` | `panfleto` | ✅ **nothing to do**: step summary only, no PR or issue |
| `34922354625`, `34922506020` | `sync-test` (at hop 1) | ❌ `gh pr create` failed. The first theory (a race with the just-pushed branch) was wrong. **Root cause: `gh` treats a git remote named `upstream` as the base repository, so the PR was being attempted on miniflux/v2.** Fixed by pinning `GH_REPO` to the fork. Nothing reached miniflux/v2 (verified: no issues or PRs by this account) |
| `34922687492` | `sync-test` | ✅ **clean → PR #9**: pushed with `SYNC_TOKEN` a history whose upstream commits touch `.github/workflows` (so the D14 token is load-bearing, as reviewed), with the five topic commits, the 20 upstream commits and the `sync-base` marker |
| `34922780206` | `sync-test`, `accept`, base moved on purpose | ✅ **refused**: `sync-test is 73353fb8… but the sync PR was built from e219eb3d…` |
| `34922801410` | `sync-test`, `accept` | ✅ tagged `pre-sync-202609150252`, moved the branch to the sync branch, PR #9 closed as merged |
| `34922841200` | `sync-conflict-test` (at `pre-resync`) | ✅ **conflict → issue #10** naming the five favicon PNGs and the stopping commit `b6328685` — the same real conflict hop 1 hit |

The exercise surfaced one more gap, now fixed: after a *manual* conflict resolution there is no sync PR carrying a
`sync-base`, so the conflict issue now spells out the PR-with-marker step before `accept`. The test branches,
tag, PR and issue are deleted or closed. Final fork tip **`fa1046df`**, which differs from the deployed `0f4bbb68`
only in the workflow file; the close-out PR pins it and deploys.

## Sprint QA
- **api spec(s):** `e2e/subscribe-suggestions.spec.ts` — anonymous where possible: assert the
  subscribe page's suggestion count matches `feeds.json`'s length, so 3.1 can't silently drop a feed.
  If the page requires auth, assert against `feeds.json` parsing + the embed instead (a pure-logic
  spec on an extracted seam, which is free coverage).
- **browser smoke owed:** yes, to the product owner — the subscribe page's **Quick Add** and
  **Review** actions, and the **browser console being free of CSP violations** after 3.2. A console
  check is precisely what an API-level spec cannot see.
- **deterministic gate:** `go build` + `go vet` + `go test` + `docker compose build` + both api specs.

## Sprint 3 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

1. **(auth path — owed to the product owner by name)** Sign in and go to `https://app.panfleto.win/subscribe`.
   → The "Suggested Feeds" section renders with the same feeds as before, in the same categories.
2. Open the browser console (⌥⌘J) and reload the page.
   → **No Content-Security-Policy violation errors.** This is the check that proves 3.2 was safe.
3. Click "Quick Add" on any suggestion.
   → The feed is subscribed and you land on its entries.
4. Click "Review" on another suggestion.
   → Its URL is loaded into the add-feed form above, not subscribed yet.
5. Register a brand-new test account (or ask for one to be provisioned).
   → It arrives with the same starter feeds, in the same categories, as before this sprint.
6. On `panfleto-core`, go to the Actions tab and run the sync workflow manually.
   → It either opens a PR, opens an issue naming a conflicting file, or exits reporting nothing to do.

If any step fails, note the step number + what you saw — that's the bug report.
