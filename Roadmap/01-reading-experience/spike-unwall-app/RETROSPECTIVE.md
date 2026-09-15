# How should unwall.app reach the reader? — Retrospective

_Closed: 2026-09-15_

## What shipped

A decision `article-autofetch` could build on the same day. unwall.app is a JSON API
(`api.unwall.app/fetch?url=…`) behind a client-side shell, so the chain fetches it server-side, runs
readability over the page it returns, and treats every failure as a miss. The probe also found
archive.ph unreachable from the VM, which cut a whole story from the next epic before anyone built it.

## What went well

Running from the VM was the whole value. From an agent sandbox both unwall.app and archive.ph had
403'd, and from a laptop El País looked like a paywall. From the production IP, El País and The New Yorker
scrape directly, the NYT needs unwall, FT is out of reach, and archive.ph doesn't answer at all.

## What we learned

- **A URL that "returns 200" can be an app shell.** `unwall.app/{host}{path}` answers 200 for any path. The
  fetchable resource was in the JS bundle, one `grep` away. Check what a 200 actually contains before calling
  a service usable.
- **An egress block can sit in the resolver, not the firewall.** Oracle's VCN resolver refuses
  archive.today's domains while public resolvers answer them. Probe with `getent` and `dig @8.8.8.8`
  separately, then test TCP by IP, or you misread which layer said no.

## Gaps / follow-ups

- A throttled (429) response wasn't observed, deliberately. The chain's back-off follows the published
  `RateLimit-*` headers rather than an observed throttle.
