# 09 · Platform & Infra

**Who it's for:** whoever has to keep this running — and every future agent that builds on it.

Not a user-facing product domain. This is the Miniflux fork and its relationship to upstream, the
deploy pipeline and the VM, CI guards, backups, the feed-enhancement scripts, and cross-cutting
process work like this roadmap itself.

Two economics shape everything here:

1. **The whole stack must stay inside Oracle's Always Free ceiling** — 2 OCPU / 12 GB, halved from
   4 / 24 when the Ampere allowance changed in June 2026. Total cost is $0 and that is a feature.
2. **Every file added to the fork is rebase tax, paid forever.** See `AGENTS.md` rule 1. Keeping the
   delta small is the single highest-leverage habit in this domain.

## Current features
See the poster's [09 · Platform & Infra](../README.md#09--platform--infra) section.

## Where the code lives
`deploy/` · `panfleto-core/` (the fork itself) · `scripts/` · `.github/workflows/` · `.githooks/`

## Epics
_(none scaffolded yet — see `../00-ideas/BUILD-ORDER.md`)_
