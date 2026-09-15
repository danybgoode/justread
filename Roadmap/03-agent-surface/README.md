# 03 · Agent surface

**Who it's for:** a reader who would rather ask their assistant than open a tab — and the assistant
itself.

The MCP endpoint, the tools it exposes, how a user's token is provisioned and presented, and the
connector setup path into Claude, Cursor and friends.

This domain's job is to make panfleto **readable without panfleto being open**. It is also the one
surface that handles a long-lived per-user credential, so its security posture is part of the
product, not a footnote.

## Current features
See the poster's [03 · Agent surface](../README.md#03--agent-surface) section.

## Where the code lives
`landing-page/src/app/api/mcp/route.ts` · `panfleto-core/internal/ui/integration_show.go` ·
`internal/template/templates/views/integrations.html`

## Epics

| # | Epic | Status | Risk | Appetite |
|---|---|---|---|---|
| 10 | [`mcp-token-handling`](mcp-token-handling/README.md) — MCP tokens shouldn't travel in query strings | 📋 scaffolded | high | S |

**Open question that may halve it:** sprint 2 depends on whether Claude, Cursor and Continue support
custom headers on a remote MCP URL. Research that at the architecture lock — if they mostly don't,
sprint 1 is the whole bet.
