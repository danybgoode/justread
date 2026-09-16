# MCP tokens shouldn't travel in query strings — Retrospective

_Closed: 2026-09-16_

## What shipped

**S1 — consent, visibility, rotation.** The reader no longer mints a credential as a side effect of
opening Settings. A reader with no token sees a "Generate MCP token" button; one with a token sees
when it was created and last used, can reveal it deliberately, and can rotate it. Rotation deletes
the old key before creating the new one, as a POST with CSRF, behind text that states the consequence
before the button. The panel's four CSP violations are gone with the inline styles and the `onclick`.

**S2.1 — the header form.** `/api/mcp` accepts `Authorization: Bearer <token>`, prefers it when both
forms are sent, refuses a bare token with no scheme, and answers every authentication failure with one
message and one code.

**S2.2 — cut, deliberately.** See *What we learned*.

**The fix nothing asked for, without which S1 was a lie.** `/api/mcp` only contacted Miniflux on a
*tool call*, so `initialize` and `tools/list` answered any string at all — meaning a rotated token
kept *looking* valid until the first real request. Story 1.2's acceptance ("after rotating, the old
token no longer authenticates — verify this, don't assume it") is only satisfiable because every POST
now authenticates first.

Deployed as pin `c7d18f88`; 20 of 20 live checks passed on production, on two disposable accounts,
both deleted.

## What went well

- **D2 was researched, not remembered — and it cut a story.** Cursor, Continue and Claude Code all
  send custom headers on a remote MCP URL; claude.ai's custom-connector request headers are a limited
  beta with an open report that the header is never sent. claude.ai is the client the panel links to,
  so the query string got **no removal date** and is not labelled "legacy".
- **Capturing the "before" state on a live account was worth the ten minutes.** Opening
  `/integrations` really did mint a 64-character credential, and the inline `style=`/`onclick` really
  were there. The epic's claims stopped being inherited and became observed.
- **Reusing Miniflux's own API-key model meant no migration**, so the fork still has zero custom
  migrations (`AGENTS.md` rule 3 intact) and `last_used_at` was already being stamped.
- **The review layers each caught something the other could not.** The external family found a
  protocol bug (rejections carrying `id: null`, which MCP clients drop on the floor — the carefully
  worded error was unreachable). The fresh reviewer found a rule-4 violation and a log-forgery path.
  Neither would have found the other's.

## What we learned

- **A `<details>` is not masking.** The first attempt hid the token behind a disclosure triangle and
  called it "masked until revealed". The credential was in the DOM on every visit regardless — an
  extension, a screenshot or a shared screen sees it. Revealing had to become a **POST** for the claim
  to be true. *If a control only changes what is painted, it is hygiene, not a control.*
- **Node puts a rejected header's VALUE in its exception message.** A caller-supplied `?token=`
  containing CRLF reached `fetch`, and the catch wrote it verbatim into the log — where the embedded
  newline forged a second line matching the exact marker `grep -c` counts to decide whether the query
  form can be retired. Fixed at source: a string that cannot be a 64-hex key never reaches the
  network. **Sanitise at the boundary, not at the log line** — and note the file already stripped
  newlines from the user agent thirty feet away, with a comment explaining why.
- **A test that asserts "an error came back" goes green during an outage.** Four e2e assertions would
  have passed while the reader was unreachable, proving nothing about the token. Assert the *specific*
  error code.
- **"The upstream is down" must never be reported as "your credential is wrong"** — and that matters
  more once there is a Rotate button, because the user will press it and destroy a working token
  during someone else's outage.
- **A unique constraint turns a double-click into a 500 unless you decide otherwise.** Two tabs both
  see "no key" and both insert; the loser's outcome is still "you now have exactly one token", which
  is what the user asked for. That race is ours, not theirs.
- **`gh pr diff` renders a submodule change as one line.** Every review in this run had to be handed
  `git -C panfleto-core diff <old> <new>` explicitly. Already in `LEARNINGS.md`; it cost nothing here
  only because it was remembered.

## Gaps / follow-ups

- **OWED TO THE PRODUCT OWNER — connect a real assistant.** Story 2.1's "verified against at least two
  real clients" cannot be closed by an agent: it means configuring Cursor or Continue with a real
  credential and watching a third-party client do what its docs claim. The automated half (a garbage
  header is rejected exactly like a garbage query token) is in `e2e/mcp-auth.spec.ts`.
- **The query string has no removal date, on purpose.** Revisit when claude.ai's request headers leave
  beta. The number to base that on is already being counted:
  `docker compose -f /opt/panfleto/deploy/docker-compose.yml logs landing | grep -c 'mcp-auth: legacy query-string token'`.
- **`/api/mcp` now calls Miniflux `/v1/me` on every POST.** One extra internal round trip per request,
  over the compose network. Correct, and cheap at panfleto's scale; if the MCP surface ever gets busy,
  a short-lived cache keyed on the token is the obvious next move.
- **Rotation's delete-then-create window** is forced by `unique (user_id, description)`. It retries
  once and fails visibly onto the Generate button; it is not transactional.
- **The pre-merge run of `e2e/mcp-auth.spec.ts` is red by design** — it targets the landing origin and
  ignores `PLAYWRIGHT_BASE_URL`, so it asserts deployed behaviour. Documented in `e2e/README.md`.
- **The fork's delta grew 29 → 30** (`internal/template/panfleto_integrations_test.go`), deliberately:
  the CSP criterion is otherwise only checkable by opening devtools on a page behind a session.
