# Stop compiling Go on the production VM — Sprint 1: Build the image in CI

**Status:** ✅ shipped — `panfleto-image.yml` amended into the fork's CI topic commit (`danybgoode/panfleto-core@9cd35eef`), pin moved here

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

#### Results — measured 2026-09-16 (three runs)

| Run | Trigger | Build step | Whole job |
|---|---|---|---|
| [35049301731](https://github.com/danybgoode/panfleto-core/actions/runs/35049301731) | push | **35 s** | 43 s |
| [35049677945](https://github.com/danybgoode/panfleto-core/actions/runs/35049677945) | dispatch | **32 s** | 42 s |
| [35049763832](https://github.com/danybgoode/panfleto-core/actions/runs/35049763832) | dispatch | **34 s** | 45 s |

**Cost: free.** Both repos are public (`gh repo view danybgoode/justread --json isPrivate` → `false`),
so Actions minutes are unmetered and the minutes-per-month arithmetic the story asks for is **N/A**.
No narrower trigger is needed; D3 stays "build on every push to `panfleto`".

**D4 answered: the native arm64 runner is worth it and costs nothing.** `ubuntu-24.04-arm` is free for
public repos and builds the Go binary in ~34 s with **no QEMU at all**. Nobody had to measure the
QEMU alternative to reject it: emulated arm64 Go builds run several times slower, and the native
runner was available for the asking.

**The number that actually matters is the comparison, not the CI time.** On the production VM, with a
cold builder, `docker compose build miniflux` took **76 s** of its 2 OCPU — shared with the Postgres
serving readers. The same artifact now reaches the VM as a **2.2 s `docker pull`**. CI spends 34 s of
somebody else's CPU so production spends two seconds of its own.

#### Verification log

- **GHCR push** — `ghcr.io/danybgoode/panfleto-core`, tagged `:9cd35eef…` (full SHA) **and**
  `:panfleto` (moving), per D2.
- **The package is public, so the pull is anonymous.** Proven without the VM's credentials: an
  anonymous `ghcr.io/token` grant fetches the manifest with HTTP 200. **No registry credential exists
  on the production host, and `.env.example` therefore documents none** — the best possible answer to
  the story's "or the credential it needs is documented".
- **The VM really pulls it** — `docker pull …:9cd35eef…` on `159.54.158.4` completed in **2.2 s**, and
  `docker image inspect` reports `arm64 / linux`, label `org.opencontainers.image.version=panfleto-9cd35eef`.
- **Docs-only pushes really are skipped** — exercised rather than assumed: a throwaway commit touching
  only a `.md` file was pushed to `panfleto`, **no `panfleto image` run was queued**, and the branch was
  reset. (PRs cannot trigger it at all — the workflow has no `pull_request` trigger.)
- **D7 is proven, with no fork delta**: the workflow tags the commit locally, the existing
  `Makefile`'s `git describe` picks it up, and `miniflux -version` inside the built image prints
  `panfleto-9cd35eef`. `packaging/docker/alpine/Dockerfile` is untouched.
- **D6 in practice**: Dependabot's inherited config had already opened
  [danybgoode/panfleto-core#14](https://github.com/danybgoode/panfleto-core/pull/14); closed
  unreviewed, since gomod bumps arrive through the weekly rebase. `docker.yml` and
  `codeberg_mirror.yml` stay inert on the fork (owner guard / skipped).

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
