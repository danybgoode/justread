# MCP tokens shouldn't travel in query strings — Sprint 2: Bearer header, query string deprecated

**Status:** ◑ **2.1 shipped, 2.2 cut on D2's research** — the header is accepted; the query string keeps working with no removal date

> **Build contract (locked by the architect before the builder started)**
>
> - **This sprint does not start until D2 is answered by research**, not memory: do Claude, Cursor and
>   Continue support custom headers on a remote MCP URL today? If enough of them don't, **this sprint
>   is cut** and the epic ships as S1 only. That is a legitimate outcome, not a failure.
> - **Accept the header before deprecating the query string. Never the reverse.** Every existing user's
>   connector is configured with a `?token=` URL; breaking those first breaks a working integration for
>   the entire user base.
> - **The deprecation window is the safety mechanism** (see the epic README's Stage 6b). Do not shorten
>   it for tidiness.
> - **Mostly TypeScript.** `landing-page/src/app/api/mcp/route.ts` is outside the fork, which is the
>   right side of `AGENTS.md` rule 1. Resist moving auth logic into the Go reader.

## Stories

### Story 2.1 — Bearer header accepted
**As a** reader whose assistant supports it, **I want** my token sent as a header, **so that** it stops
appearing in proxy logs, browser history and referrer headers.

**Acceptance:**
- `/api/mcp` accepts `Authorization: Bearer <token>` and authenticates identically to `?token=`
- Both paths work simultaneously throughout D3's window
- A request with **both** a header and a query token uses the header, and that precedence is documented
- An invalid header is rejected the same way an invalid query token is — no information leak about
  which form was wrong
- The Settings panel shows the header form as the recommended setup, with the query-string form still
  available and labelled as legacy
- Verified against at least two real clients

**Risk:** high

#### What was built

`/api/mcp` accepts `Authorization: Bearer <token>` and authenticates it identically to `?token=`.

- **Precedence, documented:** when both forms are present the **header wins**, and the fact that both
  were sent is visible to the handler. Stated in `mcp-auth.ts` and asserted in its tests.
- **A bare `Authorization: <token>` with no scheme is rejected**, deliberately. Honouring it would keep
  a misconfigured client working against panfleto and broken against every other MCP server.
- **One rejection for every failure.** No credential, wrong credential, wrong form — the same
  `AUTH_ERROR_MESSAGE`, so nothing here can be used to probe which part was wrong. `e2e/mcp-auth.spec.ts`
  asserts the three messages are byte-identical.
- **The GET document leads with the header form** and keeps the query form documented as fully
  supported, not as legacy — see the panel note in 2.2 for why that wording is deliberate.
- **"Verified against at least two real clients" is OWED**, and cannot be closed by an agent: it means
  configuring Cursor/Continue with a real credential. The automated half — that a *garbage* header is
  rejected exactly like a garbage query token — is in the api spec.

### Story 2.2 — Query string deprecated, loudly
**As the** product owner, **I want** existing users moved off the query-string URL before it goes away,
**so that** nobody's assistant breaks without warning.

**Acceptance:**
- A query-string authentication is logged as deprecated — **the fact, not the token**
- The Settings panel warns users still on the legacy form, naming the date it stops working
- D3's window is stated in `deploy/README.md` and in the panel, and is the same number in both
- **The query string still works** at the end of this sprint. Removal is a separate, later decision the
  product owner makes once the deprecation log shows usage has dropped
- A count of how many requests still use the legacy form is obtainable from the log — that number is
  what makes the removal decision possible

**Risk:** high

#### ✂️ CUT, on D2's research — and the half that shipped

**The deprecation is cut. The query string keeps working, with no end date.** Cursor, Continue and
Claude Code all send custom headers; **claude.ai custom connectors do not reliably** — request-header
auth is a limited beta and there is an open report that the configured header is never sent. claude.ai
is the client this very panel links to. The sprint contract says the deprecation window is the safety
mechanism and must not be shortened for tidiness; naming a date the flagship client cannot meet is the
same mistake with the sign flipped, so no date is named and the panel does **not** label the URL form
"legacy" — for the biggest client it is not legacy, it is the only thing that works.

**What did ship is the half that makes the decision possible later:** every query-string
authentication writes one line — `mcp-auth: legacy query-string token client="<user agent>"` — the
**fact and the client, never the token**. Counting them on the VM is:

```bash
docker compose -f /opt/panfleto/deploy/docker-compose.yml logs landing \
  | grep -c 'mcp-auth: legacy query-string token'
```

Revisit when claude.ai's request headers leave beta. That is a product-owner decision with a number
behind it, which is exactly what story 2.2 was for.

## Sprint QA
- **api spec(s):** extend `e2e/mcp-auth.spec.ts` — a garbage Bearer header is rejected; a request with
  neither form is rejected. Still no real token in any spec.
- **browser smoke owed:** yes, to the product owner — reconnecting a real assistant using the header
  form, which is the only way to know a third-party client actually does what its docs claim.
- **deterministic gate:** `npx tsc --noEmit` + `npm run build` in `landing-page/`, plus the api spec.
  Note this sprint's gate is the **TypeScript** one, not the Go one.

## Sprint 2 — Smoke walkthrough (do these in order)
Env: production · `https://panfleto.win` and `https://app.panfleto.win`

**Do not paste your token anywhere, including into a bug report.**

1. **(auth path — owed to the product owner by name)** Sign in and go to Settings → Integrations.
   → The panel shows the header-based setup as recommended, and the legacy URL form still present and labelled.
2. Configure an assistant using the **header** form and make a request.
   → It works.
3. Configure a second assistant using the **legacy query-string** form.
   → It still works. Nothing has been broken.
4. Check the panel again while a legacy connector exists.
   → You see the deprecation warning, with the same date that `deploy/README.md` states.
5. On the VM, grep the log for the deprecation marker.
   → Deprecated uses are counted. **No token values in those lines.**
6. Send a request with a deliberately wrong Bearer token.
   → Rejected, with a response that doesn't reveal whether the header or the query form was the problem.

If any step fails, note the step number + what you saw — that's the bug report.
