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

## First deploy

```bash
# 1. From your workstation - creates every OCI resource. Safe to re-run.
./deploy/provision.sh

# 2. On the VM.
ssh -i ~/.ssh/panfleto_oci ubuntu@<reserved-ip>
cd /opt/panfleto/deploy
cp .env.example .env && vi .env        # fill in every value
sudo ./install-host.sh                 # permissions + nightly backup timer
docker compose up -d
```

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
/opt/panfleto/deploy/update.sh     # pull main, rebuild, restart
/opt/panfleto/deploy/backup.sh     # manual backup (also runs nightly 04:30 UTC)
./deploy/allow-my-ip.sh            # from your workstation, when your IP rotates
docker compose logs -f miniflux
```

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
