---
status: scaffolded
slug: mcp-token-handling
build_order: 10
---

# Epic: MCP tokens shouldn't travel in query strings

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

## Architecture decisions — to be LOCKED before any builder starts

| # | Decision | State |
|---|---|---|
| **D1** | Stop minting implicitly, or keep it and just expose management | **To lock** — implicit creation is convenient and is also the consent problem. A "Generate MCP token" button is one more click and a much clearer contract |
| **D2** | Client header support | **To lock** — the research question above. Decides whether S2 exists |
| **D3** | Deprecation window for `?token=` | **To lock** — existing connectors are configured with query-string URLs. Breaking them without warning breaks a working integration for every current user |
| **D4** | Whether rotation revokes the old key immediately | **To lock** — immediate is safer, and it breaks the user's connector until they repaste. Say which, in the UI, at the moment they click |

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

## Definition of Done (epic)
- [ ] Sprints merged to `main` + deployed + smoke-tested (gaps stated)
- [ ] Each `sprint-N.md` has its smoke walkthrough (real URLs)
- [ ] This README marked ✅; every sprint status ticked with commit refs
- [ ] `RETROSPECTIVE.md` written
- [ ] Product poster updated — 03's "Token handling" 🚧 line is corrected
- [ ] Durable learnings promoted to `Roadmap/LEARNINGS.md`
- [ ] **No token appears in any doc, log fixture or commit** — check the diff before every push (rule 4)
- [ ] Feature branch deleted; frontmatter `status: shipped`; `node scripts/build-order.mjs`
