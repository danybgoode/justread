<div align="center">

<img src="landing-page/public/panflo.png" alt="Panflo" width="120">

# panfleto

**A minimalist, distraction-free RSS reader.**
Zero algorithms. Zero ads. Zero distractions. Just your feeds, in the order they happened.

[panfleto.win](https://panfleto.win) · [app.panfleto.win](https://app.panfleto.win)

</div>

---

## What this is

panfleto is a hosted [Miniflux](https://miniflux.app) fork with a landing page, a
one-click signup flow, and an MCP server that puts your feeds inside any AI
assistant. It runs entirely on Oracle Cloud's Always Free tier — one small ARM
VM, no monthly bill, no cold starts.

| | |
|---|---|
| **Reader** | `app.panfleto.win` — Miniflux, built from `panfleto-core` |
| **Landing & signup** | `panfleto.win` — Next.js 16, Auth0 SSO or email registration |
| **MCP endpoint** | `panfleto.win/api/mcp?token=…` — feeds in Claude, Cursor, and friends |

### What it does beyond stock Miniflux

- **Auto-categorisation** — new feeds are sorted into News, Tech, Business,
  Science and Reddit rather than landing in one flat list.
- **Ad filtering** — a per-feed block rule keeps posts labelled as sponsored out of
  Unread, without matching ordinary words like *leader* or *promoted*.
- **The article is already there** — feeds fetch the full article in the background
  (directly, or through unwall.app when a site refuses panfleto), so a teaser feed reads like a full-text one.
- **Hacker News comments inline** — the thread opens under the article, no second tab.
- **Paywall handling** — every article carries a bypass rail (archive.ph ·
  archive.is · unwall.app), rendered by the entry template.
- **Starter feeds on signup** — a new account arrives with 16 curated feeds
  already categorised, not an empty screen.

## Architecture

```
Cloudflare (proxied, Full Strict)
   │  panfleto.win, www  →  landing
   │  app.panfleto.win   →  miniflux
   ▼
VM.Standard.A1.Flex · 2 OCPU / 12 GB · Ubuntu 24.04 ARM · mx-queretaro-1
   │
   └── Docker Compose
       ├── caddy      :80/:443   automatic Let's Encrypt
       ├── landing    :3000      Next.js 16
       ├── miniflux   :8080      built from ./panfleto-core
       └── postgres              /data block volume
                │
                └── nightly pg_dump → OCI Object Storage
```

Only Caddy publishes ports; everything else lives on the internal compose
network. State sits on a separate block volume, so the VM itself is disposable.

Everything is sized to the Always Free ceiling — **2 OCPU / 12 GB**, halved from
4 / 24 when Oracle changed the Ampere allowance in June 2026 — so the stack
keeps running unchanged once the introductory trial expires. **Total cost: $0.**

## Repository layout

`panfleto-core` is a **git submodule**. Clone with `git clone --recurse-submodules`, or run
`git submodule update --init --recursive` after a plain clone — otherwise `panfleto-core/` is empty
and the reader image fails to build.

```
deploy/           Oracle Cloud provisioning + the running stack (see deploy/README.md)
panfleto-core/    Miniflux fork — the reader itself (git submodule → danybgoode/panfleto-core)
landing-page/     Next.js landing page, signup API, and MCP server
scripts/          Feed enhancement utilities
```

## How we work

Planning, cadence and the rules an agent must not violate live in three files — read them before
touching anything:

| File | What it is |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Orientation for any agent, and the five cannot-be-violated rules |
| [`Roadmap/README.md`](Roadmap/README.md) | The product poster — every feature by domain, with status |
| [`Roadmap/WAYS-OF-WORKING.md`](Roadmap/WAYS-OF-WORKING.md) | The cadence, risk tiers, review policy, Definition of Done |

The idea funnel and the generated build order are under
[`Roadmap/00-ideas/`](Roadmap/00-ideas/README.md). This operating system comes from
[`dobby-foundation`](https://github.com/danybgoode/dobby-foundation) via the `ways-of-work` plugin —
the plugin is pull-based and versioned, the `Roadmap/` skeleton was copied once.

## Deploying

Infrastructure and the full runbook live in **[`deploy/README.md`](deploy/README.md)**.
The short version:

```bash
./deploy/provision.sh                    # creates every OCI resource; idempotent

ssh -i ~/.ssh/panfleto_oci ubuntu@<ip>
cd /opt/panfleto/deploy
cp .env.example .env && vi .env          # secrets; never committed
sudo ./install-host.sh                   # permissions + nightly backup timer
docker compose up -d
```

Auth0 SSO is opt-in via `deploy/oauth.env` — see `oauth.env.example`. Without
it, panfleto runs on password login.

## Operating

```bash
/opt/panfleto/deploy/update.sh     # pull main, rebuild, restart
/opt/panfleto/deploy/backup.sh     # manual backup (also nightly at 04:30 UTC)
./deploy/allow-my-ip.sh            # re-point the SSH rule when your IP rotates
```

Backups land in the `panfleto-backups` bucket under `db/`, authenticated by the
instance principal — no API keys on the host — and expire after 30 days.

## Feed enhancement scripts

```bash
node scripts/enhance_miniflux.js    # re-run categorisation and ad-block rules
```

It reads `MINIFLUX_URL` and `MINIFLUX_API_KEY` from the environment. Generate
a key at **app.panfleto.win → Settings → API Keys**.

## Credentials

No secrets live in this repository. Runtime configuration is read from
`deploy/.env` and `deploy/oauth.env` on the host — both `600`, both git-ignored.
`deploy/.env.example` documents every value.

## License

`panfleto-core` is derived from Miniflux and remains under the Apache 2.0
license. See `panfleto-core/LICENSE`.
