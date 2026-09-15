# Tell the paywall rail once, in the template, correctly — Sprint 1: Stop the mutation and clean up after it

**Status:** ✅ shipped 2026-09-15 — PR #8 (`ce5677a`, `c6ede3a`, `9983d41`; merge `23813b5`)

> **Build contract (locked by the architect before the builder started)**
>
> - **1.1 before 1.2, without exception.** The Action runs every 3 hours. Clean first and it
>   re-dirties within the window.
> - **Answer D4 before writing any cleanup code.**
>   `SELECT count(*) FROM entries WHERE content LIKE '%Paywall Bypass%';` That number decides the
>   shape of 1.2.
> - **The cleanup is a production write and there is no staging.** A verified restore first, a
>   `LIMIT`ed batch second, the exact matched HTML printed for inspection before anything is updated.
> - **Some entries were appended more than once** — the script's guard is
>   `content.includes("archive.ph")`, which fails whenever content changed between runs. Strip **all**
>   occurrences, not the first.
> - The injected block is bounded by `<hr/><p><strong>🔓 Paywall Bypass:` and its closing `</p>`.
>   Distinctive enough to match safely — **verify that against real rows before trusting it.**
>
> **Outcome (README D3/D4):** production held **0** affected rows, so no restore and no write were needed.

## Stories

### Story 1.1 — Stop the mutation ✅
**As the** product owner, **I want** nothing outside Miniflux writing to article content, **so that**
the reader's own data stops being edited by a cron job.

**Acceptance:**
- ✅ `scripts/archive_appender.js` is deleted — and `scripts/test_fetch.js`, its debugging companion
- ✅ `.github/workflows/archive_appender.yml` is deleted (it had been `disabled_inactivity` since its last run, 2026-07-21)
- ✅ The workflow no longer appears under the repo's Actions tab (`gh workflow list --all` → `guards` only)
- ✅ `MINIFLUX_API_KEY` / `MINIFLUX_URL` repo secrets reviewed: **nothing in the repo uses them any more** —
  `enhance_miniflux.js` reads them from the environment of whoever runs it, never from Actions. Deleting
  the secrets is the product owner's call.
- ⚠️ **Found:** `test_fetch.js` carried a hardcoded Miniflux API key (committed in `a67dcc3`, defaulting to
  `miniflux-rss-app.onrender.com`) in a **public** repo. It is **not** a key on the production install
  (production has 0 API keys), but the Render instance still answers its healthcheck — revoking the key
  there, or shutting that instance down, is owed to the product owner.

**Risk:** low

### Story 1.2 — Clean up what it left behind ✅ (nothing to clean)
**As a** reader, **I want** old articles to stop showing a duplicate block of dead links, **so that**
articles read the same whether they were published before or after this fix.

**Acceptance:**
- ✅ D4's count is recorded before anything is written: **0** of 32,499 production entries contain
  `Paywall Bypass`, `txtify.it`, `archive.ph/newest` or `web.archive.org/web/2/` (2026-09-15)
- ➖ Restore, batches, row diff: **not run — there was nothing to write.** A restore exists to make a
  write reversible; with zero matching rows no write happened.
- ✅ The regex that *would* have run was proven on a local copy, on a row dirtied through the API with the
  appender's exact block, twice — both occurrences removed, text intact. Postgres ARE makes a whole RE
  greedy if its first quantifier is, so it uses no `.*?`:
  `regexp_replace(content, '<hr\s*/?>\s*<p><strong>🔓 Paywall Bypass:</strong>(?:[^<]|<a\s[^>]*>[^<]*</a>)*</p>', '', 'g')`
  (Kept for the Render instance, which is where the appender's writes actually landed.)
- ✅ Rows changed reported to the product owner: 0
- ✅ Every production article renders one rail, from the template — asserted by `e2e/paywall-rail.spec.ts`
  against a live entry after deploy

**Risk:** high

### Story 1.3 — A guard so it can't come back ✅
**As a** future agent, **I want** the repo to stop me writing to `entries.content` from a script,
**so that** `AGENTS.md` rule 2 is enforced rather than merely stated.

**Acceptance:**
- ✅ `scripts/content-write-guard.mjs` fails if a file under `scripts/` (JS/TS, shell, Python) issues a
  `PUT`/`PATCH` to `/entries` with a `content` field or a whole-entry spread, or calls
  `update_entry`/`updateEntry` with content. A heuristic, and it says so
- ✅ It runs in `guards.yml` on the `scripts/**` path, and in `.githooks/pre-push` (main has no branch protection)
- ✅ Tested against the deleted appender, verbatim, in `scripts/fixtures/archive_appender.js.txt`; observed red under mutation
- ✅ `AGENTS.md` rule 2 links to this guard

**Risk:** low

## Sprint QA
- **api spec(s):** none against the deployed reader — this sprint's risk is a data write, not a
  behaviour. The real gate is the guard's own `node --test` plus the restore.
- **browser smoke owed:** yes, to the product owner — opening an article from before the cleanup and
  confirming its body is clean.
- **deterministic gate:** `node --test scripts/*.test.mjs` (including the new guard) + the restore
  verification. No Go changes in this sprint.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

1. Go to the repo's Actions tab on GitHub.
   → "Run Archive Appender" is gone. No scheduled runs pending.
2. **(auth path — owed to the product owner by name)** Sign in and open an article published **before** 2026-09-15.
   → Its body ends with the article text. **No** appended "🔓 Paywall Bypass" block inside the content.
3. Scroll to the bottom of that same article.
   → Exactly **one** rail, rendered by the template.
4. Open an article published **after** 2026-09-15.
   → Same: one rail, clean body.
5. Read the story 1.2 row-count note in this file.
   → It exists: 0 rows, and matches what the product owner was told.
6. Push a branch that adds a `PUT /entries` with a content field to a file in `scripts/` and open a PR.
   → `guards` fails. Then delete the branch.

If any step fails, note the step number + what you saw — that's the bug report.
