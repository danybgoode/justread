# The ad-block rule is silently dropping real articles — Sprint 1: Anchor the rule and measure the loss

**Status:** ✅ shipped 2026-09-15 — PR #7 (`4122dba`, `fc72b8c`; merge `4b125ef`), rule live on all 52 production feeds

> **Build contract (locked by the architect before the builder started)**
>
> - **No Go, no fork delta.** Script plus API only (`AGENTS.md` rule 1).
> - **Applying the rule writes to every feed's configuration** with an admin API key. Run against one
>   feed and diff the result before looping — D3.
> - **`enhance_miniflux.js` has no tests today**, and a pattern like this one is precisely what a
>   table test catches. Adding tests is part of the story, not a nice-to-have.
> - **Block rules are not retroactive.** Fixing the pattern does not resurrect anything already
>   filtered — those entries were never stored. D2 decides how the loss gets measured.
> - **Leave the categorisation half of the script alone.** Different concern, different day.
>
> **Corrected during the build (see README D1–D4):** the API field is `blocklist_rules` (the script's
> `block_rules` was silently ignored); no production feed had ever carried a rule; there is no API key
> in production, so the rule was applied in SQL by product-owner decision, not by the script.

## Stories

### Story 1.1 — A pattern that means what it says ✅
**As a** reader, **I want** the ad filter to block ads and not news, **so that** I stop losing
articles I never knew existed.

**Acceptance:**
- ✅ The pattern is D1's — **as revised at review**: label-shaped, not merely word-boundaried, ambiguous stems gone, Spanish terms in
- ✅ A `node --test` file asserts **both directions** (`scripts/enhance_miniflux.test.mjs`, 32 tests):
  - blocked: "Sponsored: the best laptops of 2026", "Contenido patrocinado por…", "Advertisement", plus "[Sponsored] …", "Paid Post: …", "PUBLIRREPORTAJE: …"
  - **not** blocked: "Party leadership contest narrows to two", "The 2027 roadmap", "Broadcast rights sold", "Ahead of the vote", "The dealer said no", "Wholesale prices fall", plus "State-sponsored hackers breach utility", "Leeds promoted to the Premier League", "Evento patrocinado por el gobierno"
  - URL matching like `filter.go`: a `jornada.com.mx` article is not blocked; `/sponsored/` is
  - Observed red: the old rule fails 14 tests, the scaffolded D1 pattern fails 6, writing `block_rules` fails 1
- ✅ A comment in `scripts/enhance_miniflux.js` explains **why** the stems are gone, so nobody
  "helpfully" shortens them again
- ✅ `node --test scripts/*.test.mjs` passes and runs in `guards.yml` — without `node_modules` (axios loads inside `run()`)

Also shipped: the real API field `blocklist_rules`; `--dry-run`, `--feed <id>`, `--rules-only` (touches
nothing but the block rule); only changed fields are PUT, so a second run changes nothing; per-feed
failures are counted and exit non-zero.

**Risk:** low

### Story 1.2 — Applied everywhere, measured honestly ✅
**As the** product owner, **I want** to know how much was being lost, **so that** I can judge whether
the filter is worth having at all.

**Acceptance:**
- ✅ D3 answered: **no hand-tuned feed rule existed** — 0 of 52 production feeds (3 users) had any block, keep or entry-filter rule
- ✅ Applied to **one** feed first (#52, 9to5Mac); the stored value was checked byte-for-byte against the script's constant (md5 `faa1bca81ece4de8a76b9324180c10bf`) before looping
- ✅ Every feed carries the new rule: **52 of 52** (51 in the loop + the first), one distinct rule per user
- ✅ **The number** (production, 2026-09-15, 32,499 stored entries, fields URL/title/author/tags):
  - **Lost so far: 0.** The old rule never reached a feed — the script wrote a field the API ignores, and never ran against this database.
  - **Would have been lost:** the old rule matches **13,869** entries (43%), including every La Jornada (3,756) and Freakonomics Radio (1,872) entry.
  - **Blocked by the new rule: 4** — all 9to5Mac sponsored deal posts ("Save up to $1600 on Roborock products…", "iMazing … now with 20% discount", …). No false positives found.
- ✅ Idempotent: `desiredBlockRule` + `feedChanges` return no update for a feed already carrying the rule (tested), and every production feed carries exactly that byte string

**Deviation, decided by the product owner (README D4):** the rule was applied with one reversible SQL
`UPDATE` on the VM, not by the script — production has no API key, and the feeds belong to two
non-admin users. Revert: `UPDATE feeds SET blocklist_rules='' WHERE md5(blocklist_rules)='faa1bca81ece4de8a76b9324180c10bf'`.

**Risk:** low

## Sprint QA
- **api spec(s):** none against the deployed reader — the behaviour lives in Miniflux's filter
  engine, which isn't changing. The real gate is the `node --test` table in 1.1.
- **browser smoke owed:** yes, to the product owner — confirming a previously-blocked headline shape
  now appears in Unread.
- **deterministic gate:** `node --test scripts/*.test.mjs scripts/lib/*.test.mjs`. No Go, no Docker
  build needed for this sprint.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

1. **(auth path — owed to the product owner by name)** Sign in and open a feed's settings page (e.g. BBC News).
   → The "Block rules" field shows `(?i)^\W*(sponsored|advertisement|patrocinado|contenido patrocinado|paid post)\b|…`, not the old stem list.
2. Check a second feed.
   → Same pattern. It was applied everywhere, not just to one.
3. Wait for a poll cycle, then scan Unread for La Jornada articles and headlines containing "leader", "roadmap", "ahead" or "deal".
   → They are there.
4. Scan 9to5Mac for a sponsored deal post published after 2026-09-15.
   → It is not there.
5. Read the measurement in story 1.2 of this file.
   → 0 lost so far; 13,869 would have been; the new rule blocks 4.
6. On the VM: `docker exec deploy-postgres-1 psql -U miniflux miniflux -Atc "select count(*), count(distinct blocklist_rules) from feeds"`.
   → `52|1` (grows with new feeds — see the retro's gap on feeds added later).

If any step fails, note the step number + what you saw — that's the bug report.
