# Your own feeds, as a newspaper — Sprint 1: The reader is recognised at editorial

**Status:** ✅ shipped 2026-09-16, merged dark: `editorial-panfleto` `6119f5e` (+ review fixes `b3bc8d0`), PR #12, merge `84225f4`, production deployment `o3j9jzobf`

> **This sprint defines the contract the other two import.** It is the HIGH-risk one and the one that
> can eat the wave. The architect locks the session mechanism against live code before any builder
> starts; a builder must not invent it.

## Build contract (locked by the architect before the builder started)
- **D4** is the mechanism: token connect → `/v1/me` → sealed `httpOnly` cookie. No Auth0 app, no Go.
- Seams: `src/lib/miniflux/client.ts` gains a per-call key (`minifluxFetchAs`), and the existing env-key
  exports keep working for the anonymous importer. `src/lib/personalized/session.ts` seals and opens.
  `src/lib/personalized/resolver.ts` is the one resolver (D7).
- Story 1.1's "sign in with panfleto credentials" is met by the reader's own token (D4). There is no
  redirect, so the smoke's "you land back" becomes "you are sent to your edition".
- Story 1.3: nothing under `src/collections`, `src/access` or `payload.config.ts` changes. The proxy
  matcher covers only `/` with the session cookie, so `/admin` and `/api` never pass through it.
- Specs (`tests/int/personalized/`): seal/open/tamper/expiry; resolver anonymous → `null`; the
  identity call splits 401 from outage; a malformed token is refused before any `fetch`.

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

## Live confirmation (2026-09-16)
These ran on a preview deployment with the flag switched on **for that one deployment only**
(`vercel deploy --env`; project settings untouched), using two disposable panfleto readers (users 7 and 8,
both deleted afterwards). They were then repeated on the review-fixed commit.
- **Sign in (1.1):**
  - A malformed token and a wrong token each get their own message, and no cookie is set.
  - Each reader's real token lands on their own edition.
  - The cookie is `httpOnly`, `Secure` and `Lax`, and does not contain the key.
  - Sign-out returns to the curated page and removes the cookie.
- **Key stays server-side (1.2):**
  - The key appeared in **no** response body, none of the 12 JS chunks, and none of ~300 request URLs per reader.
  - The only place it travels is the reader's own form POST.
  - Every card on each edition came from that reader's own feeds.
- **Revocation:** a token revoked in panfleto was refused **12 s** after its edition was built (`307 → /tu-edicion/salir → reconnect`).
- **Staff unaffected (1.3):** production `/admin` login renders, and nothing under `src/collections`, `src/access` or `payload.config.ts` changed.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: production · https://editorial-panfleto.vercel.app

> Steps 2–5 need the flag **on** (Sprint 3, step 2). Until then, step 1 is all production shows, which is the point.

1. Open https://editorial-panfleto.vercel.app in a private window.
   → The curated front page, exactly as before.
2. Open https://editorial-panfleto.vercel.app/tu-edicion/conectar, and in another tab open https://app.panfleto.win/integrations. Generate (or copy) your token there and paste it here. **(auth path — owed to the product owner)**
   → You land on "Tu edición", shown as "Conectado como <your account>". No signup, no new password.
3. Open devtools → Application → Cookies.
   → `panfleto_edicion` is HttpOnly and Secure, and its value is not your token. Search the Network tab's responses for your token: it isn't there.
4. Press **Salir**.
   → The curated front page of step 1.
5. Connect with a **second** account's token. **(auth path — owed to the product owner)**
   → "Conectado como" shows the second account, and the stories come from its feeds.

If any step fails, note the step number + what you saw — that's the bug report.
