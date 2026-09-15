# Can the newspaper read one reader's feeds? — Retrospective

_Closed: 2026-09-15_

## What shipped
No code — a spike ships decisions. Four landed, all `LOCKED`, in the epic README:

- **D1** — the personalized edition renders live from Miniflux and writes nothing durable to Payload.
  Decided from the code: the importer runs on one global key, `access/roles.ts` has no reader concept,
  and every imported Article lands `draft` with nobody to publish it.
- **D2** — the per-user Miniflux API key (`integration_show.go`, `CreateAPIKey(user.ID, "Panfleto MCP")`)
  is the credential; Payload auth stays staff-only. **Sequences behind `mcp-token-handling` (#10)**,
  because that key is minted implicitly and travels in a query string.
- **D1b** — the edition is a per-user *derived cache* over a day of entries, never a live `limit=100`
  call. Measured from a Vercel function in `iad1` against one real reader (39 feeds, 23,201 entries).
- **D3** — v1's ranking carries the top of the page, not the whole page. Product owner's verdict:
  *worth reading with tuning*. Bet confirmed **L**; wave 3 is tuning, not an LLM.

The follow-on is bet as three waves: #10 (already scaffolded) → `personalized-edition` (M, HIGH,
scaffolded with this close-out) → `editorial-ranking-tuning` (seed, re-bet after wave 2 runs).

## What went well
- **The platform-first reframe paid for the whole spike.** Reading `editorial-panfleto` before planning
  found a complete Miniflux→Payload ingestion pipeline nobody in the ask knew was there, which turned
  "build an integration" into "decide which of the two integrations we want" — and D1 then ruled out
  the expensive one on evidence rather than taste.
- **The probe was designed around a trap instead of falling into it.** `editorial-panfleto`'s build
  command is `pnpm payload migrate && pnpm build` and its Preview env shares the production database
  URL, so a normal preview deploy would have run migrations against the live newsroom DB. The spike
  used a one-function, no-build deployment instead, scoped the key to that deployment, changed no
  project settings, and removed it the same day.
- **Measuring from the right machine changed the answer.** `limit=100` looked fine until the numbers
  showed it covers 2 h 7 min of this reader's day. The whole D1b decision turns on that, and no amount
  of desk reasoning would have produced it.
- **The verdict gate held.** The builder's read pointed at the LLM pass; the doc refused to lock D3 on
  it and waited for the product owner, who said *tuning*. That is a materially cheaper wave 3, and it
  only exists because the decision wasn't allowed to self-approve.

## What we learned
Promoted to `Roadmap/LEARNINGS.md`:

- A preview deployment is not free when the preview environment shares production's `DATABASE_URL` and
  the build command runs migrations.
- `limit=N` is a *time window*, not a page size — measure what span N covers for a real account before
  designing a daily page around it.
- Corroboration must count publishers, not feeds; duplicate feeds for one outlet make a source
  corroborate itself.
- A spike's own builder must not supply the verdict on a taste question it was hired to inform.

## Gaps / follow-ups
- **Cache location undecided.** Upstash is already a dependency (trending) and is the obvious candidate,
  but D1b did not evaluate it. First architecture task of wave 2.
- **Refresh trigger undecided** — on view vs. on Miniflux's 60-minute poll.
- **`/v1/entries` has no field selection**, so 73% of every fetch is `content` the ranker never reads.
  Worth an upstream ask to `miniflux/v2` (AGENTS rule 1's preferred path) rather than a fork patch.
- **Cross-subdomain session is unbuilt and is the HIGH-risk part of wave 2** — it was scoped by D2, not
  solved.
- **The anonymous edition and the `.com.mx` domain move stayed out of scope** and remain unplanned.
  `panfleto.com.mx` still serves an unrelated product.
