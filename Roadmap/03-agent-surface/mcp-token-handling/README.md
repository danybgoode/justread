---
status: shipped
slug: mcp-token-handling
build_order: 10
---

# Epic: MCP tokens shouldn't travel in query strings ✅

> **Area:** 03-agent-surface · **Risk:** high · **Class:** Chore · **Archetype:** Maintainer · **Scope seed:** [`00-ideas/seeds/mcp-token-handling.md`](../../00-ideas/seeds/mcp-token-handling.md)

## Why

`internal/ui/integration_show.go` mints a per-user API key named "Panfleto MCP" **on settings page
view** and renders it into a URL:

```
https://panfleto.win/api/mcp?token=<credential>
```

Two problems, one of each kind:

- **Transport.** Query strings land in proxy logs, browser history and referrer headers. Caddy sits in
  front of this and logs requests. A credential in a URL is a credential in several places nobody is
  thinking about.
- **Consent.** The key is created *implicitly*, as a side effect of opening Settings. A user who
  looked at the page once has a live long-lived credential they never asked for, can't see the age
  of, and can't rotate.

`AGENTS.md` rule 4 already says MCP tokens are credentials. This epic makes the code agree.

## ⚠️ Research this before S2 — it may cut the sprint

Do remote-MCP clients that panfleto targets — **Claude, Cursor, Continue** — support custom headers on
a remote MCP URL? If a meaningful share don't, **story 2.1 is blocked on them** and S1 is the whole
bet, which is a perfectly good outcome for an S-appetite ask.

This is a present-day fact about third-party products that changes often. **Web-search it at the
architecture lock**; do not answer it from memory.

## Platform-first note

Slice 1 touches `integration_show.go` and `integrations.html` — both already fork delta files, so no
new rebase tax. Slice 2 is mostly `landing-page/src/app/api/mcp/route.ts`, which is TypeScript outside
the fork entirely. That split is deliberate and is the right side of `AGENTS.md` rule 1.

## ⚠️ Known defect in this exact panel — fold it in

The resync's reviews surfaced, and deliberately left alone as out of scope:

> **`/integrations` carries 4 CSP violations — the MCP panel's inline styles and its `onclick`.**

That is *this* panel, and this epic is the one that touches it. Fixing the violations while rebuilding
the panel is nearly free; doing it later means editing the same delta file twice. **Fold it into story
1.1's acceptance.** The pattern to copy is resync S3's subscribe page, which was rebuilt as a no-JS
template loop specifically so it needed no nonce and threw no violations.

Related, and **not** this epic's job but worth knowing before touching auth: `DISABLE_LOCAL_AUTH` must
not be enabled until `/api/register` uses an admin API key — see the warning in
`deploy/oauth.env.example`.

## What already exists (reuse, don't rebuild)

- `internal/ui/integration_show.go` — mints and surfaces the key today
- `internal/template/templates/views/integrations.html` — the panel, already ours
- Miniflux's own API-key model and `store.APIKeys(userID)` / `store.CreateAPIKey(...)` — creation,
  storage and auth all exist; nothing new is needed on the reader side
- `landing-page/src/app/api/mcp/route.ts` — the endpoint that reads the token

## Architecture decisions — LOCKED 2026-09-16 (D2 by research, not memory)

### D2 first, because it decides whether S2 exists

The sprint contract said to web-search this rather than answer from memory. Done, 2026-09-16:

| Client | Custom headers on a remote MCP URL? |
|---|---|
| **Cursor** | **Yes.** `headers` in `mcp.json`, with `${env:VAR}` expansion, on streamable-HTTP servers |
| **Continue** | **Yes.** `requestOptions.headers` on a `type: streamable-http` server |
| **Claude Code** | **Yes.** `--header` on a remote MCP server |
| **claude.ai custom connectors** | **Partly, and unreliably.** Request-header auth exists but is a **limited beta** — organisations without access do not see the field at all — and there is an open report (July 2026) that a configured header is **never sent**: claude.ai instead starts an OAuth flow against the server's origin, using the header's *name* as the `client_id` |

**Verdict: build story 2.1, cut story 2.2's deprecation.** Accepting the header is additive, risk-free
and immediately useful to Cursor/Continue/Claude Code users. But claude.ai is the client panfleto's
own settings panel links to, so **the query string cannot be given a removal date** — naming a date
the flagship client cannot meet is precisely what the sprint contract says not to do. What story 2.2
*can* deliver is its other half, and it is the useful half: the legacy form is **counted in the log**,
so the removal decision becomes answerable later instead of guessed.

| # | Decision | Locked answer |
|---|---|---|
| **D1** | Stop minting implicitly, or just expose management | **Stop minting implicitly.** The panel shows a **"Generate MCP token"** button and creates nothing until it is pressed. Implicit creation *is* the consent problem: a reader who opened Settings once had a long-lived credential they never asked for. Existing tokens are untouched and keep working — this changes what happens for people who do not have one |
| **D2** | Client header support | **Header accepted, query string kept with no removal date.** See the table above |
| **D3** | Deprecation window for `?token=` | **No window, deliberately.** A window implies an end date, and setting one now would break claude.ai users. The panel labels the header form *recommended where your client supports it* rather than calling the URL form legacy, because for the biggest client it is not legacy — it is the only one that works. Revisit when claude.ai's request headers leave beta |
| **D4** | Does rotation revoke the old key immediately | **Yes, immediately** — delete, then create. A token you rotate is a token you think has leaked, and a grace period is a window for whoever leaked it. The consequence is stated in plain words *above* the button, not after the click |
| **D5** | *(new)* How the panel avoids JS entirely | **Native `<details>` disclosures and real POST forms.** No `onclick`, no inline `style`, so the four CSP violations go and no nonce is needed — the same shape resync S3 used for the subscribe page. Revealing the URL is a `<details>`, not a script, so the token never enters the URL bar or a JS path. The cost, stated: the old click-to-select convenience is gone |
| **D6** | *(new)* Authenticating before doing anything | **`/api/mcp` validates the credential on every POST**, against Miniflux `/v1/me`. It did not before: `initialize` and `tools/list` answered any string at all, which handed the tool schema to anonymous callers and — the reason it matters here — made a **rotated token look like it still worked** until the first tool call. Rotation is meaningless without this |
| **D7** | *(new)* The fork's delta grows by one | **29 → 30 files**, for `internal/template/panfleto_integrations_test.go`. The CSP acceptance criterion ("the panel's 4 violations are gone") is otherwise only checkable by opening devtools, and the panel is behind a session so no anonymous smoke can reach it. The test renders all three panel states and fails on any inline `style=`/`onclick` — which is also what stops a future upstream rebase reintroducing one quietly |

## Scope — stories

| Sprint | Story | Risk |
|---|---|---|
| 1 | 1.1 — A token you can see | low |
| 1 | 1.2 — A token you can rotate | high |
| 2 | 2.1 — Bearer header accepted | high |
| 2 | 2.2 — Query string deprecated, loudly | high |

## Deploy order

S1 is additive and ships alone — it is most of the value. S2 only starts if D2 says clients support
headers, and its two stories deploy together: accepting the header before deprecating the query string,
never the reverse.

## Kill-switch (risk:high — Stage 6b)

**Carve-out for S1** (additive UI on an existing credential; rollback is `git revert` + `update.sh`).

**For S2, the deprecation window is the kill-switch**: the query-string path keeps working throughout
D3's window, so if header auth turns out to be broken for some client, the fallback is already live
and nothing needs flipping. Do not shorten that window to "ship it faster" — it is the safety
mechanism, not politeness.

## Definition of Done (epic) — ✅ complete 2026-09-16
- [x] S1 and S2.1 merged to `main` (PR #17, `fadf787`) + deployed (pin `c7d18f88`) + smoke-tested live,
      20/20, on two disposable accounts. **S2.2 cut on D2's research**, recorded above. Gap stated:
      connecting a real third-party assistant is owed to the product owner
- [x] Each `sprint-N.md` has its walkthrough, with the executed live confirmation recorded against
      real URLs and a before/after table from a real account
- [x] This README marked ✅; both sprint statuses ticked
- [x] `RETROSPECTIVE.md` written
- [x] Product poster updated — 03's "Token handling" 🚧 line is now ✅
- [x] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [x] **No token appears in any doc, log fixture or commit.** Checked on the diff before every push,
      and verified on the host afterwards: Caddy's access log carries zero lines containing the test
      token, and the landing log carries zero forged lines despite the spec firing a CRLF payload at
      production. Fixtures use the synthetic literals `not-a-real-token` and `TOKENVALUEFORTHISTESTONLY`
- [x] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
