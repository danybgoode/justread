# Your own feeds, as a newspaper — Sprint 1: The reader is recognised at editorial

**Status:** ⬜ not started

> **This sprint defines the contract the other two import.** It is the HIGH-risk one and the one that
> can eat the wave. The architect locks the session mechanism against live code before any builder
> starts; a builder must not invent it.

## Stories

### Story 1.1 — A reader can sign in at the editorial app
**As a** panfleto reader, **I want** to sign in at `editorial.panfleto.win` with the same account I use
for the reader, **so that** the newspaper can know whose feeds to show.
**Acceptance:**
- Signing in at the editorial app with panfleto credentials succeeds and shows me as signed in.
- It is the **same account** — no second password, no second signup.
- Signing out works, and afterwards the anonymous edition is what I see.
**Risk:** high (auth)

### Story 1.2 — The app resolves that reader's Miniflux key server-side
**As a** reader, **I want** the editorial app to read my feeds on my behalf without my credential ever
reaching my browser, **so that** using the newspaper doesn't expose my account.
**Acceptance:**
- With a signed-in session, a server-side call returns entries belonging to **that** reader.
- Two different signed-in readers resolve to two different sets of entries.
- `grep` of the client bundle finds no API key; no key appears in any URL, log line, or network
  response visible in devtools.
- An anonymous request resolves to no key at all and falls through to the anonymous edition.
**Risk:** high (auth)

### Story 1.3 — Staff accounts are unaffected
**As an** editor, **I want** the Payload admin to keep working exactly as it does, **so that** the
newsroom isn't disrupted by a reader-facing feature.
**Acceptance:** `/admin` login, article editing, and the Miniflux mappings UI all behave as before;
no Payload role, collection or access rule changed.
**Risk:** high (shared auth surface)

## Sprint QA
- **api spec(s):** one spec asserting that an anonymous request to the personalized path gets the
  anonymous edition, and that a session-bearing request resolves to a reader-scoped result.
- **browser smoke owed:** **yes, to the product owner by name** — the real sign-in round trip on a real
  Auth0 account. An automated smoke cannot fully cover an auth path (WAYS-OF-WORKING → QA).
- **deterministic gate:** `pnpm typecheck` + `pnpm build` (editorial), `go build/vet/test` if anything
  in `panfleto-core` moved, Playwright `api` green before merge.
- **Merge:** HIGH tier ⇒ **the product owner merges**, and the fresh reviewer subagent is mandatory on
  top of the two cross-family passes (`node scripts/review-route.mjs --builder claude --tier high <PR#>`).

## Sprint 1 — Smoke walkthrough (do these in order)
Env: production · https://editorial.panfleto.win (preview URL while pre-merge)

> ⚠️ Do **not** use an ordinary Vercel preview deploy for this project without reading the spike's D1b
> note: Preview shares production's `DATABASE_URL` and the build command runs `pnpm payload migrate`.

1. Open https://editorial.panfleto.win in a private window, signed out.
   → The current curated front page loads, exactly as it does today.
2. Sign in with your panfleto account. **(auth path — owed to the product owner)**
   → You land back on the editorial site, shown as signed in, with no second signup and no second password.
3. Open devtools → Network, reload, and search the responses and the JS bundle for your API key.
   → It appears nowhere. No request URL contains a token.
4. Sign out.
   → You are back to the anonymous edition of step 1.
5. Sign in as a **second** test reader with different feeds. **(auth path — owed to the product owner)**
   → The session resolves to that reader, not the first one.

If any step fails, note the step number + what you saw — that's the bug report.
