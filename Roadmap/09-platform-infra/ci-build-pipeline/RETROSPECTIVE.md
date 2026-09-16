# Stop compiling Go on the production VM — Retrospective

_Closed: 2026-09-16_

## What shipped

**S1 — the image is built in CI.** `.github/workflows/panfleto-image.yml` on `danybgoode/panfleto-core`,
amended into the fork's existing CI topic commit so the delta stayed at eight topic commits (27 → 28
files). It builds `linux/arm64` natively on `ubuntu-24.04-arm` in **33 s**, verifies the architecture
and the version stamp *before* publishing, and pushes `ghcr.io/danybgoode/panfleto-core` at both the
full commit SHA and a moving `:panfleto` tag. Both repos are public, so it costs nothing.

**S2 — the VM pulls.** `deploy/docker-compose.yml` takes `image:` from `MINIFLUX_IMAGE`;
`deploy/update.sh` derives that from the `panfleto-core` submodule pin, pulls, and restarts. Deployed
to production as PR #13 / `84911dc`, then **rolled back to the previous image and rolled forward
again on the live reader**.

| | Before | After |
|---|---|---|
| Reader build | 76 s of the VM's 2 OCPU, beside Postgres | 0 s (2.2 s pull) |
| Deploy, reader-only change | full rebuild | **4–5 s** |
| User-visible downtime | — | **≈ 1 s** |
| Rollback | `git revert` + another rebuild | **5 s**, proven on production |

## What went well

- **Locking the decisions against the live repos first paid immediately.** One command
  (`gh repo view --json isPrivate`) turned the epic's central risk — metered Actions minutes and a
  slow QEMU arm64 build — into a non-issue, and the native `ubuntu-24.04-arm` runner removed the
  other half. The epic's own "check this before betting" section was right to exist.
- **D7 landed for free by reading the Makefile instead of patching the Dockerfile.** `VERSION :=
  $(shell git describe --tags --exact-match)` was already there, there is no `.dockerignore`, and the
  build stage already installs git — so a local tag created in the workflow gives `/about` a version
  with **zero** change to an upstream-owned file. The resync's D9 recorded this as impossible.
- **Making the submodule pin *be* the image tag** removed a whole class of bug before it existed:
  there is no separate version to forget to bump, and `git revert` of a pin bump is automatically a
  rollback to the matching image.
- **The path filter was exercised, not assumed.** A throwaway docs-only push to the fork branch
  confirmed no build was queued, then the branch was reset.

## What we learned

- **A rollback path needs a rollback *target*.** The fresh review checked GHCR and found exactly one
  tag, while the freshly-written runbook told the operator to choose one with `git log`. Every commit
  older than the pin predates the workflow. "Rollback is proven" was one command away from being
  false in the most stressful possible moment. **The authoritative list of rollback targets is the
  registry, never the commit history.**
- **A required-variable interpolation (`${X:?}`) is not local to the service that uses it.** Compose
  interpolates the whole file for nearly every subcommand, so `image: ${MINIFLUX_IMAGE:?}` would have
  broken `backup.sh`'s nightly `pg_dump` — the only recovery path on this host — for anyone who ran a
  compose command before the first `update.sh`. Loud beats silent *except* when the loud thing is
  wired into the recovery path.
- **A script that edits a secrets file in place is handling the host's only copy of it.** The first
  draft left a 644 temp file containing every secret in `/tmp`, and could truncate `.env` on a short
  write. `.env` is git-ignored by rule 4 and `backup.sh` backs up the database, not the environment.
- **An escape hatch with no expiry is a drift mechanism.** `MINIFLUX_IMAGE_PIN` wins over the
  submodule pin on *every* subsequent run and survives `git reset --hard`, so a rollback nobody
  un-does silently ships an old reader forever. It now announces itself at the end of every deploy.
- **`cancel-in-progress: false` protects a running job, not a pending one.** GitHub keeps only the
  most recent pending run per concurrency group.
- **A change that edits the deploy script must be deployed reset-first.** Confirmed in practice —
  bash keeps reading the replaced inode, so `git reset --hard` then `./deploy/update.sh` as separate
  steps, which is what the LEARNINGS entry from 2026-09-15 already said.

## Gaps / follow-ups

- **Owed to the product owner:** signing in at `https://app.panfleto.win` after the pull-based deploy.
  Session handling across an image change is the most likely surprise and it is credential-gated; the
  anonymous `api` suite was green after the deploy, the rollback and the roll-forward.
- **The `landing` image is still built on the VM** (~20 s of a 90 s full deploy). Deliberately out of
  scope — it is a small Next.js image, it lives in this repo rather than the fork, and it needs a
  different trigger. Worth a follow-on seed if deploys get slower.
- **The commented-out `build:` block stays** in `docker-compose.yml` for one release cycle, per the
  epic's own rollback plan. Remove it once a pull-based deploy has succeeded twice — one has
  succeeded three times now (deploy, rollback, roll-forward), so the next epic's deploy retires it.
- **Local development on amd64 cannot run the reader from the registry** (the image is arm64-only).
  Documented in `AGENTS.md` and `e2e/README.md`; the workaround is the commented `build:` block.
- **The pre-merge local stack did not run** — no Docker daemon on the building workstation. Covered
  by the CI-side verification of the image and the post-deploy `api` run against production, and
  stated in the PR rather than glossed.
