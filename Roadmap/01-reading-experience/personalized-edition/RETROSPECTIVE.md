# Your own feeds, as a newspaper — Retrospective

_Closed: 2026-09-16_

## What shipped
Wave 2 of the personalized edition is **in production, dark**. It lives in `editorial-panfleto` PR #12,
merge `84225f4`, production deployment `o3j9jzobf`.

- **S1 — the reader is recognised (`6119f5e`).** A reader pastes their panfleto token once at
  `/tu-edicion/conectar`. The token is checked against `/v1/me` and kept only inside an AES-256-GCM sealed
  `httpOnly` cookie. No Auth0 change, no Go, no server-side credential store.
- **S2 — the per-user cache (`8bc0cd0`).** A reader's day is built once into Upstash. It is served for
  10 min with no call to panfleto, then served stale while a locked refresh fetches only what was stored
  since the last build. A full rebuild runs past 6 h.
- **S3 — the edition renders (`d20f914`).** A connected reader's `/` is rewritten to their edition, which
  uses the newspaper's own classes. Each story says which signal placed it. The ranking is the spike's
  `rank.py` ported line for line, and **exact on the spike's saved day**. It is all behind
  `EDITORIAL_PERSONALIZED_ENABLED`, `false` in every environment.
- **Review fixes (`b3bc8d0`).** A revoked key is now refused at view time (D12). A proxy's 403 no longer
  signs readers out. GCM tags must be full length. Every outbound call has a timeout, and HN lookups
  share a 4 s budget.

## What went well
- **The locking pass disproved two premises before any code.** `editorial.panfleto.win` doesn't exist.
  And "map `email → Miniflux user`" can't produce a credential, because Miniflux's API only lets a user
  mint their own keys. Both scaffolded session options assumed otherwise. Asking the product owner one
  question (a token paste with zero Go, or a redirect handoff in Go) turned the HIGH-risk sprint from a
  fork change plus a VM deploy into TypeScript only.
- **Live data changed a decision.** 90 of one day's entries were published more than 6 h before Miniflux
  stored them, so the story's `published_after` delta would have missed them all. Keying the refresh on
  `after_entry_id` came from a `psql` count, not from the doc.
- **The spike's own script was still on disk.** Finding `rank.py` in an old scratchpad made "ship v1 as
  the spike ran it" a checkable claim: a parity run on the same saved day, story for story. Otherwise it
  would have been a re-derivation from prose.
- **The review found real defects, and each layer found different ones.**
  - The fresh reviewer found the three that mattered: a revoked token reading a fresh edition, a
    Cloudflare 403 signing every reader out, and Node accepting truncated GCM tags. It also caught the
    missing timeouts.
  - The external pass got both "blocking" findings wrong (stale knowledge: Next 16's `proxy.ts`, and a
    `cache: 'no-store'` that was already there), but four of its smaller findings were real.
- **Flag-on verification without touching project settings.** A `vercel deploy --env` override gave a
  real flag-on deployment for the smoke, while the project's flag stayed `false` everywhere, which is
  what "merged dark" requires.

## What we learned
Promoted to `Roadmap/LEARNINGS.md`:
- **A cache that outlives the credential check keeps serving a revoked credential.** Re-verify the key
  at view time on a TTL, not only when a refresh happens to run.
- **A 403 from the proxy in front of an API is not "your credential is wrong".** Know which status the
  origin actually uses for a bad key, and treat everything else as an outage.
- **Node's GCM decipher accepts a truncated tag** unless `authTagLength` is set.
- **An incremental feed refresh keyed on publish time misses late arrivals.** Key it on insertion
  order (the entry ID).
- **Verify stale-while-revalidate over plain HTTP, not in a browser.** This site loads every document
  twice, so the browser showed a refresh that had already landed.
- **A repo's own `.env.local` can hold an expired `VERCEL_OIDC_TOKEN` that overrides the fresh one** that
  `vc env run` supplies, which looks like protection simply not accepting the header.

## Gaps / follow-ups
- **Owed to the product owner:**
  - Turning the flag on in Production (set it, then redeploy), then the Sprint 1 and 3 walkthroughs on
    their own account. The real sign-in and the judgement on their own edition can't be automated.
  - The Production `EDITORIAL_SESSION_SECRET` is write-only; it is proven the first time a Production
    connect succeeds.
  - Delete the leftover `spike-probe` API key on user 2 (panfleto Settings → API keys).
  - `codex login`: its token is revoked, not capped.
- **Discoverability:** nothing links to `/tu-edicion/conectar` yet (no header entry, no link from the
  reader's Settings). Deliberate for a dark launch; it needs one before real readers can find it.
- **Every page on the editorial site loads its document twice** in a real browser. This predates the
  epic (production's anonymous `/` does it). On the personalized path it doubles dynamic renders per
  view. Worth a look on its own.
- **For wave 3 (`editorial-ranking-tuning`), observed while building, not changed:**
  - Quotas key on the feed *title* (as the spike did). Two feeds both titled "BBC News" share one quota.
  - Entries with an empty or shared URL merge, including within one feed.
  - A reader with 3 feeds gets 6 cards, because the quotas bind before the page fills.
- **Uncapped inline rebuilds while Upstash is down.** Every view rebuilds unlocked. Acceptable at 3
  users; add a backoff before real traffic.
- **The editorial repo still has no CI.** The gate was local plus the Vercel build.
