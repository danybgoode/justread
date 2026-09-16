# MCP tokens shouldn't travel in query strings — Sprint 1: A token you can see and rotate

**Status:** ✅ shipped — the panel no longer mints a credential for looking at it, and rotation actually revokes

> **Build contract (locked by the architect before the builder started)**
>
> - **Never log, paste or commit a token** (`AGENTS.md` rule 4). That includes test fixtures, PR
>   descriptions, and screenshots in the smoke walkthrough. Check the diff before every push.
> - **Reuse Miniflux's API-key model.** `store.APIKeys(userID)` and `store.CreateAPIKey(...)` already
>   exist and already work. No new storage, no new table, no migration.
> - **This sprint is additive.** The existing `?token=` URL keeps working exactly as it does today.
>   Deprecation is S2 and is gated on D2.
> - **D4 decides what rotation does to the old key**, and the UI must say it at the moment of the
>   click — a user who rotates and then finds their assistant silently broken will not connect the two.

## Stories

### Story 1.1 — A token you can see
**As a** reader using panfleto from an assistant, **I want** to see when my MCP token was created and
last used, **so that** a long-lived credential on my account isn't invisible to me.

**Acceptance:**
- The Settings → Integrations MCP panel shows the token's **created** date and **last used**, if
  Miniflux's model carries it — and says so plainly if it doesn't, rather than showing a blank
- D1's answer is implemented: either the key is still minted on page view (documented as a deliberate
  choice), or the panel shows a "Generate MCP token" button and mints nothing until it's pressed
- The token itself is still masked until revealed, and revealing it does not put it in the URL
- No token value appears in any server log line added by this story
- **The panel's 4 CSP violations are gone** — no inline `style=`, no `onclick`. Check the browser
  console on `/integrations` and confirm it is clean, the same way resync S3 did for the subscribe page

**Risk:** low

### Story 1.2 — A token you can rotate
**As a** reader, **I want** to replace my MCP token, **so that** a credential I think may have leaked
isn't permanent.

**Acceptance:**
- A "Rotate" control in the MCP panel issues a new token
- Before rotating, the UI states D4's consequence in plain words — e.g. "Your current connector will
  stop working until you paste the new URL"
- Rotation is a POST with CSRF, not a GET — a link a browser can prefetch must not destroy a credential
- After rotating, the old token no longer authenticates against `/api/mcp` — **verify this, don't
  assume it**
- The new URL is shown ready to copy
- No token appears in the response headers or in Caddy's access log for the rotate request

**Risk:** high — this is auth surface; the product owner merges

#### What was built

- **"Rotate now" is a POST form with CSRF**, inside a `<details>` whose text states the consequence
  **before** the button: *"Rotating issues a new token and revokes the current one immediately. Every
  assistant configured with the old URL will stop working until you paste the new one in."* The button
  restates it. A prefetching browser cannot destroy a credential, because there is no link to prefetch
  — the render test asserts that too.
- **D4 as decided: the old key is deleted, then the new one created.** No grace period; a token you
  rotate is a token you believe has leaked.
- **The old token genuinely stops authenticating — and that needed a second fix.** `/api/mcp` only
  touched Miniflux on a *tool call*, so `initialize` and `tools/list` answered any string at all. A
  rotated token would have kept *looking* like it worked until the first real request. Every POST now
  authenticates against `/v1/me` first (D6). Without it, "rotation revokes" would have been true in
  the database and false in the user's experience.
- **Neither the redirect nor the URL carries the token**: both actions POST to
  `/integration/mcp/{generate,rotate}` and redirect to `/integrations`, so Caddy's access log sees two
  paths with no query string.

## Sprint QA
- **api spec(s):** `e2e/mcp-auth.spec.ts` — assert `/api/mcp` with **no** token is rejected, and with
  a **garbage** token is rejected. Both anonymous, both cheap, and they are the assertions that
  matter. Do not put a real token in a spec.
- **browser smoke owed:** yes, to the product owner — the rotate flow end to end, including
  reconnecting a real assistant with the new URL. Credential-gated; not automatable.
- **deterministic gate:** `go build ./... && go vet ./... && go test ./...` + `docker compose build miniflux` + the api spec.

## Sprint 1 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

**Do not paste your token anywhere while doing this, including into a bug report.** Refer to it as
"the token".

1. **(auth path — owed to the product owner by name)** Sign in and go to Settings → Integrations.
   → The MCP panel shows the created date and last-used (or says plainly that last-used isn't tracked).
2. If D1 chose explicit generation: confirm a brand-new test account shows a "Generate" button and **no** token until pressed.
   → It does.
3. Connect the MCP URL to a real assistant and make one request.
   → It works, and the last-used timestamp updates.
4. Click "Rotate".
   → You are told, before it happens, that the current connector will stop working.
5. Confirm, then try the **old** URL from the assistant.
   → It is rejected. The old token is genuinely dead.
6. Paste the new URL into the assistant.
   → It works again.
7. On the VM, grep Caddy's access log for the rotate request.
   → No token value in the logged URL.

If any step fails, note the step number + what you saw — that's the bug report.
