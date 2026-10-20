# Deploying panfleto on Oracle Cloud

Everything runs on a single Always Free Ampere VM in `mx-queretaro-1`. No
paid resources are used, and nothing is sized above the Always Free ceiling,
so nothing is reclaimed when the 30-day trial expires.

## What is provisioned

| Resource | Sizing | Always Free ceiling |
|---|---|---|
| `panfleto-prod` compute | VM.Standard.A1.Flex, 2 OCPU / 12 GB | 2 OCPU / 12 GB |
| Boot volume | 50 GB | 200 GB total block |
| `panfleto-data` block volume, `/data` | 50 GB | (same 200 GB pool) |
| `panfleto-ip` reserved public IP | 1 | — |
| `panfleto-vcn` + public subnet | 1 VCN | 2 VCNs |
| `panfleto-backups` bucket | ~1 GB in practice | 20 GB |

> **Ampere was halved in June 2026.** The Always Free allowance is now 1,500
> OCPU-hours and 9,000 GB-hours per month — 2 OCPU / 12 GB run continuously,
> not the 4 / 24 most guides still quote. Do not raise `OCPUS` or `MEMORY_GB`
> in `provision.sh` unless you intend to pay.

## Layout

```
Cloudflare (proxied, SSL mode: Full (Strict))
   │  panfleto.win, www.panfleto.win   →  landing
   │  app.panfleto.win                 →  miniflux
   ▼
reserved public IP ─► VM ─► caddy :80/:443 (Let's Encrypt)
                              ├── landing   :3000   Next.js, unmodified
                              ├── miniflux  :8080   built from ../panfleto-core
                              └── postgres          /data/panfleto/postgres
```

Only Caddy publishes ports. Postgres and both apps are reachable solely on the
internal compose network.

## Other tenants on this VM

This VM is shared, and **this repo's Caddy is the only public entrypoint for all of it**. Restarting or
breaking `deploy-caddy-1` takes every tenant offline, not just panfleto.

| Tenant | Lives in | Joins Caddy via | Notes |
|---|---|---|---|
| panfleto | `/opt/panfleto` (this repo) | the compose network | owns Caddy and its `Caddyfile` |
| aomx | its own compose project | the `aomx_proxy` network | `/v1/match/*` reaches the separate invite-gated match host; ingest routes retain the operator allowlist. The aomx match service must be healthy before a Caddy reload or this path returns 502. |
| **Miyagi Sánchez** (since 2026-10-16) | `/opt/miyagi/infra/oci` ([miyagi-product-management](https://github.com/danybgoode/miyagi-product-management/tree/main/infra/oci)) | the `edge` network plus `/opt/edge/sites/miyagi.caddy`, which the Caddyfile imports | Medusa, the storefront, Postgres and Redis; capped at ≤ 5 GB RAM and ≤ 1.75 CPU in total. TLS uses the Cloudflare Origin certs in `/opt/edge/certs`. Deploy with `/opt/miyagi/infra/oci/update.sh` |

Rules that keep tenants from hurting each other:

- **A tenant's site file names every host it serves.** A catch-all (`https://`, `:443`, `*`) becomes a TLS
  policy with no host matcher and serves that tenant's certificate for *every* host on the box. This was
  reproduced: panfleto.win was served `CN=miyagisanchez.com`.
- `update.sh` here creates the `edge` network if it is missing. Do not remove it from the Caddy service.
- Nightly jobs are staggered: panfleto's backup runs at 04:30 UTC and Miyagi's at 04:45 UTC, and Miyagi's
  `miyagi-cron-*` timers run at 06:00–10:00 UTC.

## First deploy

```bash
# 1. From your workstation - creates every OCI resource. Safe to re-run.
./deploy/provision.sh

# 2. On the VM.
ssh -i ~/.ssh/panfleto_oci ubuntu@<reserved-ip>
cd /opt/panfleto/deploy
cp .env.example .env && vi .env        # fill in every value
sudo ./install-host.sh                 # permissions + nightly backup timer
../deploy/update.sh                    # pulls the reader image and starts everything
```

`update.sh` is the entry point even on a first install: it is what writes `MINIFLUX_IMAGE` into
`.env`. A bare `docker compose up -d` also works (compose falls back to the moving `:panfleto` tag),
but it does not pin the commit.

Optional Auth0 SSO: `cp oauth.env.example oauth.env`, fill it in, then
`docker compose up -d miniflux`. Skip the file entirely for password login.

## Cutting DNS over

Caddy obtains certificates over HTTP-01. **Cloudflare's proxy must be off
(grey cloud) for the first issuance** — a proxied record makes Let's Encrypt
validate against Cloudflare's edge rather than this host.

1. In Cloudflare, point `panfleto.win`, `www`, and `app` at the reserved IP as
   **DNS-only** A records.
2. `docker compose logs -f caddy` until all three certificates are issued.
3. Switch the records to proxied and set SSL/TLS mode to **Full (Strict)**.

Let's Encrypt allows 5 failed validations per hostname per hour. If you get
rate-limited, wait it out rather than restarting Caddy in a loop.

## Operations

```bash
/opt/panfleto/deploy/update.sh     # pull main, pull the reader image, restart
/opt/panfleto/deploy/backup.sh     # manual backup (also runs nightly 04:30 UTC)
./deploy/allow-my-ip.sh            # from your workstation, when your IP rotates
docker compose logs -f miniflux
```

### How a deploy works now — the reader is pulled, not compiled

The reader used to be compiled **on this VM**, next to the Postgres it shares 2 OCPU with: a broken
commit took the reader down, and a rollback was another slow rebuild. Since
`Roadmap/09-platform-infra/ci-build-pipeline`, the image is built for `linux/arm64` by the
`panfleto image` workflow on `danybgoode/panfleto-core` and pushed to GHCR before it ever reaches
here.

- **The submodule pin is the version.** `update.sh` reads `git -C panfleto-core rev-parse HEAD` and
  deploys `ghcr.io/danybgoode/panfleto-core:<that sha>`. The running container therefore cannot be a
  different commit from the one `main` says to run.
- **The package is public**, so the VM pulls anonymously — there is no registry credential on this
  host, and there must not be one.
- **`landing` is still built here.** It is a small Next.js image and it lives in this repo, not in
  the fork.
- **The reader image is arm64-only** — the VM is Ampere, and the workflow builds one architecture on
  purpose. An amd64 workstation cannot run the reader from the registry; uncomment the `build:` block
  in `docker-compose.yml` to build it locally instead.
- **`update.sh` keeps one `.env.bak`** next to `.env`, written just before it rewrites the managed
  `MINIFLUX_IMAGE` line. It is the only copy of this host's secrets other than `.env` itself —
  `backup.sh` backs up the database, not the environment.
- **`/about` now reports a version** (`panfleto-<short-sha>`), stamped by the workflow.
- **When a commit changes `update.sh` itself**, bash keeps reading the replaced inode and you get the
  *old* script. Reset first, then invoke the new one:

  ```bash
  cd /opt/panfleto && git fetch origin && git reset --hard origin/main \
    && git submodule update --init --recursive --force && ./deploy/update.sh
  ```

### Rolling back the reader

Every commit CI built has an immutable image tag, so a rollback is a restart, not a rebuild.

**Find the target in the registry, not in `git log`.** Not every commit has an image: the workflow
only exists from the ci-build-pipeline commit onwards, and it skips docs-only pushes. `git log` will
happily show you a commit that was never built, and the deploy will abort on `manifest unknown`.

```bash
# 1. List the images that actually exist.
#    https://github.com/danybgoode/panfleto-core/pkgs/container/panfleto-core
#    or the green runs at https://github.com/danybgoode/panfleto-core/actions

# 2. Pin it, in deploy/.env (the line wins over the submodule pin).
echo 'MINIFLUX_IMAGE_PIN=ghcr.io/danybgoode/panfleto-core:<previous-sha>' >> /opt/panfleto/deploy/.env

# 3. Deploy it.
/opt/panfleto/deploy/update.sh

# 4. Confirm what is actually running.
curl -s https://app.panfleto.win/healthcheck
docker compose -f /opt/panfleto/deploy/docker-compose.yml exec -T miniflux miniflux -version

# 5. To roll forward again: delete the MINIFLUX_IMAGE_PIN line and re-run update.sh.
sed -i '/^MINIFLUX_IMAGE_PIN=/d' /opt/panfleto/deploy/.env && /opt/panfleto/deploy/update.sh
```

A rollback across an **upstream sync** is not just an image swap, and **nothing stops you**:
`IsSchemaUpToDate` only errors when the database is *behind* the binary, and `Migrate` no-ops when the
database is ahead — so an older image boots happily on a migrated database and can then fail on
writes (a rebuilt unique index makes `ON CONFLICT` fail while the healthcheck stays green). See
`Roadmap/LEARNINGS.md` § *Working with a vendored fork* before rolling back over a sync, and judge it
by the log after the next real write cycle, not by a 200.

**If GHCR itself is unreachable**, `deploy/docker-compose.yml` still carries the old `build:` block,
commented out directly under `image:`. Uncomment it, comment out `image:`, and
`docker compose build miniflux && docker compose up -d miniflux` compiles here exactly as before.

**Article autofetch kill switches** (`Roadmap/01-reading-experience/article-autofetch`, D4). Add the line to
`deploy/.env`, then run `docker compose up -d miniflux`. That's a restart, not a rebuild:

```bash
FORCE_CRAWLER=0          # new feeds stop defaulting to "Fetch original content"
FETCH_FALLBACK_CHAIN=    # never call unwall.app; scrape directly only
PREFETCH_WORKERS=0       # scrape inline during the poll again (upstream behaviour)
docker compose logs miniflux | grep -E "Prefetch|Fetch fallback" | tail   # what it is doing
```

### Wallhop fallback

The reader can try Wallhop after the existing unwall fallback. This is opt in because its public
`/api/` endpoint returns HTML from another host and no service capacity is guaranteed. Before enabling
it, test from the VM with a public, non-sensitive article URL:

```bash
curl --fail --max-time 15 --silent --show-error \
  'https://wallhop.io/api/https://example.com/' | head -c 300
```

If the VM gets a valid JSON response with a `body` field, set
`FETCH_FALLBACK_CHAIN=unwall,wallhop` in `deploy/.env` and run
`docker compose up -d miniflux`. The reader extracts and sanitizes that body before storing it,
caches successful fallback results for one hour, spaces requests, and backs off after errors.
Set `FETCH_FALLBACK_CHAIN=unwall` and restart to disable Wallhop immediately. Never send private
feed URLs or articles containing credentials to an external fallback.

The `panfleto core pin` workflow checks for a successful arm64 image at the accepted fork tip,
opens a pin-only PR, runs the feed guard, and merges the pin into `main`. Its repository Actions
setting **Allow GitHub Actions to create and approve pull requests** must stay enabled; default
workflow permissions can remain read-only because this workflow requests its own three scopes.
The workflow does not run `update.sh` on the VM.

Backups go to the `panfleto-backups` bucket under `db/`, authenticated by the
instance principal — there are no API keys on the host. Objects expire after 30
days via a bucket lifecycle policy.

Restore:

```bash
oci os object get --auth instance_principal -ns <ns> -bn panfleto-backups \
  --name db/miniflux-<stamp>.sql.gz --file - | gunzip \
  | docker compose exec -T postgres psql -U miniflux miniflux
```

## Gotchas encountered while building this

- Oracle's Ubuntu images ship iptables rules that reject 80/443 regardless of
  the OCI security list. `cloud-init.yaml` inserts ACCEPT rules above the
  REJECT and persists them.
- The block volume attaches after the instance reaches RUNNING, so cloud-init's
  `disk_setup` runs too early to see it. `/data` is set up in `runcmd` instead.
- Miniflux refuses to start when `OAUTH2_PROVIDER` is set but empty, not only
  when it is invalid. The variable must be genuinely absent, which is why OAuth
  lives in an optional `env_file` rather than in `environment:`.
- Object Storage lifecycle rules need `Allow service objectstorage-<region> to
  manage object-family` before the bucket will accept a policy.
- Always Free instances can be reclaimed after 7 days below 20% CPU *and*
  memory *and* network. Postgres `shared_buffers` is set to 3 GB to hold the
  memory figure clear of that trigger.
