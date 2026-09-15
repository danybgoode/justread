# Read the comments without leaving the reader — Sprint 1: Hacker News comments in the reader

**Status:** ✅ shipped 2026-09-15 · fork `06593003` (`panfleto: inline comments`) · PR #11 merged `f6cd9d7` · `update.sh` 19:52 UTC

> **Build contract (locked by the architect before the builder started)**
>
> - **S1 deliberately needs no cache decision.** HN's Algolia API is generous and unauthenticated, so
>   this sprint ships without touching D1. Do **not** add a table here.
> - **Locked 2026-09-15:** D2 nests to 5 levels and 300 comments. D3 answers 502 with a fragment holding the
>   outbound link. D5 shows the panel only for HN item URLs, to signed-in readers. D6 renders with the package's
>   own template, uses existing classes, and inserts through one shared Trusted Types policy.
> - **`internal/reader/sanitizer` is not optional.** Every comment body, every time.
> - **Copy the enclosures pattern** in `entry.html` for the lazy `<details>` panel rather than
>   inventing a new one — it already handles the "entry doesn't have this" case for free.
> - **New Go files here grow the fork delta** (`AGENTS.md` rule 1). `internal/reader/comments/` is
>   justified — it is a genuinely new capability with no upstream equivalent — but say so in the PR
>   body and keep it to the adapter plus the route.

## Stories

### Story 1.1 — A comments route and a lazy panel
**As a** reader, **I want** a collapsed comments section under an article that loads when I open it,
**so that** articles without comments cost me nothing and articles with them are one click away.

**Acceptance:**
- `GET /entry/{id}/comments` returns rendered HTML for an entry that has a comments URL
- It returns 404, not 500, for an entry that doesn't
- `entry.html` renders a collapsed `<details>` **only** when `.entry.CommentsURL` is set
- `app.js` fetches the route on first expand, not on page load
- The existing outbound comments link stays — this adds a panel, it doesn't remove the escape hatch
- An entry with no comments URL renders exactly as it does today, with no extra request

**Risk:** low

### Story 1.2 — Hacker News threads, sanitized
**As a** reader of Hacker News, **I want** the thread rendered inside panfleto, **so that** I can read
the discussion without leaving the reader.

**Acceptance:**
- An HN comments URL is recognised and its item id extracted
- `hn.algolia.com/api/v1/items/{id}` is fetched through `internal/reader/fetcher`, not a bare client
- Comments render nested to the D2 depth, with author and relative time
- **Every comment body passes through `internal/reader/sanitizer`** — verify with a unit test that
  feeds it a `<script>` tag and asserts it does not survive
- A dead or slow API degrades per D3; the reader never sees a broken page
- Deleted and empty comments are skipped rather than rendering as blanks

**Risk:** high — untrusted third-party HTML rendered in an authenticated session

## Sprint QA
- **api spec(s):** `e2e/comments-route.spec.ts` — assert the route 404s for an entry with no comments
  URL. Plus **pure-logic `go test`** on the HN id extractor and the sanitizer pass (the `<script>`
  test above). The sanitizer test is the one that matters.
- **browser smoke owed:** yes, to the product owner — expanding the panel and seeing a real thread.
- **deterministic gate:** `go build` + `go vet` + `go test` + `docker compose build` + the api spec.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

**Already confirmed by the agent** (2026-09-15, after deploy): `e2e/comments-route.spec.ts` passes against production
(an anonymous request to `/entry/1/comments` redirects to sign-in). `hn.algolia.com` is reachable from inside the production
container. The log is clean. 132 HN entries from the last day carry a supported comments URL. Locally, against the same
binary, headless Chromium rendered an 87-comment thread nested 5 deep, made no request before expanding, and inserted
no login page after an expired session.

1. **(auth path — owed to the product owner by name)** Sign in and open any **Hacker News** article (Feeds → Hacker News).
   → Below the article, after the paywall rail, there is a collapsed **Comments** section.
2. Expand it.
   → "Loading…" and then the HN thread, with author and "N hours ago" on each comment, and replies indented.
3. Open an article from a feed with **no** comments (e.g. Daring Fireball), and one from **Ars Technica** (its comments are on its own site).
   → No Comments section on either. The toolbar's outbound **Comments** link is still there on Ars.
4. Open the browser network tab, load another HN article, and do **not** expand the panel.
   → No request to `/entry/…/comments`. Expand it: exactly one request.
5. In a long thread, find a comment containing a link and click it.
   → It opens in a new tab. The page isn't broken.
6. Reload and expand the same thread again within 10 minutes.
   → It appears at once (served from the in-process cache).

If any step fails, note the step number + what you saw — that's the bug report.
