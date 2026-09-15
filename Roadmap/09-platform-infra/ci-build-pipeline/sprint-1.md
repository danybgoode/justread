# Stop compiling Go on the production VM — Sprint 1: Build the image in CI

**Status:** ⬜ not started

> **Build contract (locked by the architect before the builder started)**
>
> - **This sprint changes nothing about production.** It builds and pushes an image alongside the
>   existing flow; the VM still builds locally. Fully reversible, zero risk to the reader.
> - **Answer the private/public question first** (`gh repo view --json isPrivate`). It decides whether
>   D3 is "on every merge" or something cheaper.
> - **Reuse the existing Dockerfile.** Do not write a new one, do not "improve" it — `AGENTS.md`
>   rule 1 applies to the packaging directory too.
> - **Copy `guards.yml`'s consolidated-job shape.** One job, one checkout, one setup — that pattern
>   exists because separate workflows each bill a 1-minute minimum.
> - **The workflow belongs on `danybgoode/panfleto-core`, not this repo** (D5, decided). The resync
>   shipped; `panfleto-core` is a submodule with its own repo and its own `panfleto upstream sync`
>   workflow. This repo only moves the pin.
> - **Two inherited workflows already live on the fork** (D6): upstream's `dependabot`, which opens
>   bump PRs that should be closed since bumps arrive through the rebase, and upstream's `stale.yml`,
>   which has no owner guard. Know they are there before adding a third.

## Stories

### Story 1.1 — An image built in CI and pushed
**As a** maintainer, **I want** a linux/arm64 image built by CI and pushed to a registry, **so that**
the artifact the VM needs exists before the VM is asked to run it.

**Acceptance:**
- A workflow builds `linux/arm64` from `panfleto-core/packaging/docker/alpine/Dockerfile`
- It pushes to GHCR tagged with **both** the commit SHA and a moving `main` tag (D2)
- The VM can `docker pull` the SHA tag using credentials it already has, or the credential it needs
  is documented in `deploy/.env.example` — **verify the pull actually works from the VM**
- The workflow does not run on docs-only changes (path filters, same discipline as `guards.yml`)
- Nothing about the existing `update.sh` flow changes yet

**Risk:** low

### Story 1.2 — The build time measured and judged
**As the** product owner, **I want** to know what this costs before I depend on it, **so that** I'm
not surprised by a quota email.

**Acceptance:**
- Wall-clock build time recorded in this file, for at least three runs
- If the repo is private: minutes-per-build × expected merges-per-month written down, and compared
  against the account's remaining pool
- D4 answered: whether a native arm64 runner is worth it, with the numbers behind the answer
- If the cost is bad, **say so and propose the narrower trigger** (build on tag rather than on merge)
  rather than proceeding quietly

**Risk:** low

## Sprint QA
- **api spec(s):** none — no application behaviour changes in this sprint.
- **browser smoke owed:** none. The reader is untouched.
- **deterministic gate:** the workflow going green, plus a successful `docker pull` **from the VM** of
  the pushed SHA tag. That pull is the real check — a pushed image the VM can't fetch is worthless.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: GitHub Actions + the Oracle VM

1. Merge any change to `main` and open the repo's Actions tab.
   → The image workflow runs and goes green.
2. Open the repo's Packages / GHCR page.
   → An image exists, tagged with the commit SHA **and** `main`.
3. SSH to the VM and run `docker pull ghcr.io/danybgoode/<image>:<that SHA>`.
   → It pulls successfully. This is the step that actually matters.
4. Run `docker image inspect` on it and check the architecture.
   → `arm64`. An x86 image would pull fine and fail to run.
5. Push a docs-only change to a branch and open a PR.
   → The image workflow does **not** run.
6. Read the build-time numbers recorded in story 1.2 of this file.
   → They exist, and someone has decided whether the cost is acceptable.

If any step fails, note the step number + what you saw — that's the bug report.
