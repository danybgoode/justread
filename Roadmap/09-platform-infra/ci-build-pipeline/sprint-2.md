# Stop compiling Go on the production VM — Sprint 2: update.sh becomes a pull

**Status:** ⬜ not started

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
