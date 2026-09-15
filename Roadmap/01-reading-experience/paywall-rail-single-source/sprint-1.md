# Tell the paywall rail once, in the template, correctly — Sprint 1: Stop the mutation and clean up after it

**Status:** ⬜ not started

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

## Stories

### Story 1.1 — Stop the mutation
**As the** product owner, **I want** nothing outside Miniflux writing to article content, **so that**
the reader's own data stops being edited by a cron job.

**Acceptance:**
- `scripts/archive_appender.js` is deleted
- `.github/workflows/archive_appender.yml` is deleted
- The workflow no longer appears under the repo's Actions tab
- `MINIFLUX_API_KEY` / `MINIFLUX_URL` repo secrets are reviewed — if nothing else uses them, say so
  and let the product owner decide whether to revoke the key

**Risk:** low

### Story 1.2 — Clean up what it left behind
**As a** reader, **I want** old articles to stop showing a duplicate block of dead links, **so that**
articles read the same whether they were published before or after this fix.

**Acceptance:**
- D4's count is recorded in this file before anything is written
- A `pg_dump` has been restored into a throwaway Postgres and verified **before** the pass runs
- The first batch is `LIMIT`ed and its matches printed and eyeballed before committing
- All occurrences of the injected block are removed, not just the first
- Article text itself is untouched — verify by diffing a sample before/after
- A count of rows changed is reported to the product owner
- An article the appender touched now renders one rail, from the template, and nothing in its body

**Risk:** high

### Story 1.3 — A guard so it can't come back
**As a** future agent, **I want** the repo to stop me writing to `entries.content` from a script,
**so that** `AGENTS.md` rule 2 is enforced rather than merely stated.

**Acceptance:**
- A check fails if any file under `scripts/` issues a `PUT`/`PATCH` to `/entries` with a `content` field
- It runs in `guards.yml` on the `scripts/**` path that already triggers there
- It has a test proving it catches the deleted appender's exact pattern — copy the old line into a fixture
- `AGENTS.md` rule 2 links to this guard

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
2. **(auth path — owed to the product owner by name)** Sign in and open an article published **before** today.
   → Its body ends with the article text. **No** appended "🔓 Paywall Bypass" block inside the content.
3. Scroll to the bottom of that same article.
   → Exactly **one** rail, rendered by the template.
4. Open an article published **after** the cleanup.
   → Same: one rail, clean body.
5. Read the story 1.2 row-count note in this file.
   → It exists, and matches what the product owner was told.
6. Push a branch that adds a `PUT /entries` with a content field to a file in `scripts/` and open a PR.
   → `guards` fails. Then delete the branch.

If any step fails, note the step number + what you saw — that's the bug report.
