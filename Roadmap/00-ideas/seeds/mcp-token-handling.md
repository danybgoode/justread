---
title: "MCP tokens shouldn't travel in query strings"
slug: mcp-token-handling
status: raw
area: "03"
type: chore
priority: null
appetite: S
underwritten_by: null
risk: high
epic: null
build_order: 10
updated: 2026-09-14
---

# Seed — MCP tokens shouldn't travel in query strings

> **Portfolio pass only — not Definition of Ready.**

## Problem
`internal/ui/integration_show.go` mints a per-user API key named "Panfleto MCP" **on settings page
view** and renders it into a URL:

```
https://panfleto.win/api/mcp?token=<credential>
```

Two issues, one of each kind:

- **Transport.** Query strings land in proxy logs, browser history and referrer headers. Caddy sits
  in front of this and logs requests. A credential in a URL is a credential in several places nobody
  is thinking about.
- **Consent.** The key is created *implicitly*, as a side effect of opening Settings. A user who
  looked at the page once has a live long-lived credential they never asked for, and no way to see
  when it was last used or to rotate it.

## Appetite
**S** — one builder session for a rotate control; more if the transport changes.

## Lane
**Fixed scope**, but **HIGH risk tier** — it is auth surface, so the product owner merges.

## Rough shape
Two slices, and the first is most of the value:

1. **A visible rotate control** in the Settings panel, plus a "created / last used" line. Cheap,
   entirely additive, and it converts an invisible credential into a managed one.
2. **Header-based handshake** for the MCP endpoint (`Authorization: Bearer`), with the query-string
   form kept as a deprecated fallback while existing connectors migrate. This touches
   `landing-page/src/app/api/mcp/route.ts`, so it is mostly TypeScript rather than fork delta —
   which is the right side of `AGENTS.md` rule 1.

## Open question
Do MCP clients that panfleto targets (Claude, Cursor, Continue) all support custom headers on a
remote MCP URL? If a meaningful share don't, slice 2 is blocked on them and slice 1 is the whole
bet. **Research present-day client support before shaping this** — it changes the answer entirely.
