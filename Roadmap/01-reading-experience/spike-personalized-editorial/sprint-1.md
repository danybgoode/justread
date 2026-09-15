# Can the newspaper read one reader's feeds? — Sprint 1: Read path and credential boundary

**Status:** 🚧 in progress — D1 and D2 landed from code; D1b's probe is owed

## Stories

### Story 1.1 — Decide where the personalized edition's content lives ✅ `D1`
**As a** product owner, **I want** the content-ownership fork decided against the live code,
**so that** the build epic cannot quietly become a multi-tenant CMS migration.
**Acceptance:** the epic README carries D1 with the files that back it, and names what it did not
decide.
**Risk:** low
**Outcome:** LOCKED — live-render, zero Payload writes. See D1.

### Story 1.2 — Decide the credential boundary and its sequencing ✅ `D2`
**As a** product owner, **I want** to know which system owns reader identity and which credential
the editorial app uses, **so that** I am not shipping a second consumer of a credential already on
the board as a defect.
**Acceptance:** the epic README carries D2, and `mcp-token-handling` is marked merge /
sequence-before / independent with a reason.
**Risk:** low
**Outcome:** LOCKED — per-user Miniflux API key; Payload stays staff-only; **#10 sequences first**.
See D2.

### Story 1.3 — Time the Miniflux read from Vercel ⬜ blocked
**As a** product owner, **I want** the real cost of a per-reader page render, **so that** the
caching decision (D1b) is made on a number instead of a guess.
**Acceptance:** D1b moves from PENDING to LOCKED, carrying a measured p50/p95 for
`GET /v1/entries?limit=100&order=published_at&direction=desc` **as called from a Vercel function**,
plus the same call's cost for 25 and 50 entries.
**Risk:** low
**Blocked by:** `app.panfleto.win/v1` is unreachable from both shells this session had — desktop VM
egress refused it (HTTP 000), cloud container proxy returned `connect_rejected` (organization
policy). The probe must run where the production call will run.

**The probe, ready to run** — a throwaway route on a Vercel preview of `editorial-panfleto`
(delete before merge; nothing from this story lands on `main`):

```ts
// app/api/_probe/route.ts — TEMPORARY. Do not merge.
export async function GET() {
  const t = (n: number) => `?limit=${n}&order=published_at&direction=desc&status=unread`
  const out: Record<string, number[]> = {}
  for (const n of [25, 50, 100]) {
    out[n] = []
    for (let i = 0; i < 5; i++) {
      const s = performance.now()
      await fetch(`${process.env.MINIFLUX_URL}/v1/entries${t(n)}`, {
        headers: { 'X-Auth-Token': process.env.MINIFLUX_API_KEY! },
        cache: 'no-store',
      }).then(r => r.json())
      out[n].push(Math.round(performance.now() - s))
    }
  }
  return Response.json(out)
}
```

Read the **outliers**, not just the median — `LEARNINGS.md` carries that rule from
`article-autofetch`, where a clean-looking median hid a 105K-character entry.

## Sprint QA
- **api spec(s):** none — a spike ships no code, so there is nothing to spec. The build epic it
  shapes owes one spec per testable story.
- **browser smoke owed:** no.
- **deterministic gate:** N/A — nothing merges from this sprint.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: documentation review · no deployment

A spike's "smoke" is reading the decisions, not clicking a page.

1. Open `Roadmap/01-reading-experience/spike-personalized-editorial/README.md`.
   → The **Decisions** block lists D1, D1b, D2, D3, each with a status of `LOCKED` or `PENDING`.
2. Read D1 and D2.
   → Each names the specific files it was decided from, and a "Not decided here" line.
3. Read D1b.
   → It is marked `PENDING`, states the unreachable-API blocker, and names Vercel as where the
   probe must run.
4. Check `Roadmap/00-ideas/seeds/mcp-token-handling.md`.
   → Its relationship to this epic is stated in D2 (sequences first), so the next betting table has
   the dependency in front of it.

If any step fails, note the step number + what you saw — that's the bug report.
