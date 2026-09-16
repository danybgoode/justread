# Stop compiling Go on the production VM — Sprint 2: update.sh becomes a pull

**Status:** ✅ shipped — deployed 2026-09-16, rollback performed on production and rolled forward again (PR #13, `84911dc`)

> **Build contract (locked by the architect before the builder started)**
>
> - **Do not start until S1's story 1.1 acceptance is green**, specifically the `docker pull` from
>   the VM. Everything here assumes the VM can fetch the image.
> - **Keep the `build:` block, commented out, for one release cycle.** If the registry path fails at
>   3am the recovery is uncommenting two lines, not debugging a registry.
> - **This sprint touches production deploy.** HIGH tier, product owner merges, and the first
>   pull-based deploy happens with someone watching.
> - **Prove the rollback before declaring done.** A rollback path that has never been exercised is a
>   rollback path that doesn't exist — that is the entire point of story 2.2.

## Stories

### Story 2.1 — The VM pulls instead of building
**As the** product owner, **I want** `update.sh` to fetch a prebuilt image, **so that** a deploy stops
compiling Go on the host serving readers.

**Acceptance:**
- `deploy/docker-compose.yml`'s miniflux service uses `image:` (the `build:` block commented out, not
  deleted — see the contract)
- `update.sh` is `docker compose pull && docker compose up -d`, plus whatever the submodule state
  needs
- A deploy completes in a small fraction of the previous time — record before and after in this file
- `docker stats` during a deploy shows no Go build; Postgres is not starved
- The reader's downtime during a deploy is measured and recorded
- `deploy/README.md` describes the new flow

**Risk:** high

#### Results — production, 2026-09-16

| | Before | After |
|---|---|---|
| Reader build | **76 s** compiling Go on the VM's 2 OCPU, beside Postgres | **0 s** — the image is built in CI and pulled |
| Whole `update.sh` | compile reader + compile landing + restart | **90 s** first run, **4–5 s** when only the reader changes |
| Reader downtime, user-visible | — | **≈ 1 s** (13 consecutive 502s at ~13 Hz through Cloudflare, 03:22:55.261 → 03:22:56.133) |
| Rollback | `git revert` + another 76 s rebuild | **5 s** |

- **No Go compilation in the deploy output** — the only build step left is the `landing` Next.js
  image (~20 s of the 90), which is this repo's, not the fork's, and was deliberately left in scope
  for a later epic. The reader's line is `Container deploy-miniflux-1 Recreated`, nothing more.
- Postgres was never starved: it stayed `Up (healthy)` untouched through all three deploys, and the
  host's 1-minute load average peaked at **1.09** on 2 OCPU — that peak is the landing build, not the
  reader.
- `docker compose ps` reports the reader running
  `ghcr.io/danybgoode/panfleto-core:fdf2916d…`, and `update.sh`'s closing line reports
  `panfleto-fdf2916d` — the version stamp D7 bought, matching the pin.
- `deploy/.env` and the new `.env.bak` are both `600` on the host after the rewrite.

### Story 2.2 — Rollback by tag, proven
**As the** product owner, **I want** to have actually rolled back once, **so that** I know the
mechanism works before I need it at speed.

**Acceptance:**
- Rolling back is documented as a concrete command sequence in `deploy/README.md` — pin the previous
  SHA tag, re-run `update.sh`
- **It has been performed on production at least once**, deliberately, and the reader came back on the
  previous version
- The time it took is recorded here
- Then roll forward again and confirm the current version is live
- `AGENTS.md` rule 5 and `WAYS-OF-WORKING.md` § *Deploy rail* are updated — both currently describe a
  rail that compiles on the host, and after this sprint that is no longer true

**Risk:** high

#### The rollback, performed on production — 2026-09-16

Not a rehearsal on a copy. The live reader was deliberately rolled back and rolled forward again:

1. `echo 'MINIFLUX_IMAGE_PIN=ghcr.io/danybgoode/panfleto-core:9cd35eef…' >> deploy/.env` → `./update.sh`
   → the reader came back on the **previous** image in **5 s**, reporting `panfleto-9cd35eef`,
   healthcheck 200.
2. `update.sh` then printed the drift banner by design — a rollback pin that nobody removes would
   otherwise silently ship an old reader forever, and now it announces itself at the end of every
   deploy along with the command to clear it.
3. `sed -i '/^MINIFLUX_IMAGE_PIN=/d' deploy/.env` → `./update.sh` → back on `panfleto-fdf2916d` in
   **4 s**, with **≈1 s** of user-visible 502s in between.
4. The `api` Playwright project (8 specs) was green against `https://app.panfleto.win` after the
   deploy, after the rollback and after the roll-forward.

**What the drill taught, and it was not in the plan:** *rollback-by-tag only exists once a second
image exists*. When the fresh reviewer checked GHCR it held exactly one tag, while `deploy/README.md`
was telling the operator to pick a target with `git log` — every commit older than the pin predates
the workflow and has no image. The review hardening produced a genuine second image, which is what
made this drill real rather than deferred. The docs now name the **registry tag list** as the
authoritative set of rollback targets.

## Sprint QA
- **api spec(s):** `e2e/reader-health.spec.ts` (from the resync epic, if it exists by now) run against
  production after each deploy and each rollback. If it doesn't exist yet, write it here — it is four
  lines and it is the thing that tells you a deploy landed.
- **browser smoke owed:** yes, to the product owner — signing in after the pull-based deploy, and
  again after the rollback, since session handling is the most likely thing to surprise you across an
  image change.
- **deterministic gate:** the image workflow green + a successful pull + the health spec green against
  the deployed reader.

## Sprint 2 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

> Steps 1–2 and 4–7 were executed on 2026-09-16 and are recorded above. **Step 3 (sign-in) is owed to
> the product owner** — it is credential-gated and an API smoke cannot cover it.

1. Merge a small visible change, wait for the image workflow, then run `update.sh` on the VM.
   → It pulls and restarts. **No Go compilation in the output.** Time it.
2. Go to `https://app.panfleto.win/healthcheck`.
   → OK, within seconds of the restart.
3. **(auth path — owed to the product owner by name)** Sign in.
   → You land in the reader, signed in. Your existing session either survived or you can sign in cleanly.
4. Confirm the small visible change from step 1 is live.
   → It is. The pull deployed the right image.
5. Now roll back: pin the previous SHA tag and re-run `update.sh`.
   → The reader comes back on the previous version. Check `/about` or the visible change is gone. Time it.
6. Roll forward again.
   → Current version live, reader healthy, sign-in works.
7. Read the recorded times in stories 2.1 and 2.2.
   → Deploy time, downtime and rollback time are all written down.

If any step fails, note the step number + what you saw — that's the bug report.
