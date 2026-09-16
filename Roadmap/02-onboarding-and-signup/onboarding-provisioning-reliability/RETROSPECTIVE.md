# A new signup should not be a coin flip — Retrospective

_Closed: 2026-09-16_

## What shipped

**Story 1.1 — onboarding that reports itself, on both signup paths.** The epic was scoped around one
goroutine in the Go reader. The path its own smoke walkthrough exercises turned out to be a different
one — the landing page's `/api/register` — with the same disease. Both now collect per-feed results
and send the same message: `⚠️ New reader x@y joined Panfleto — 14/16 starter feeds added, 2 failed:`
followed by the URLs, in place of `🎉 YEEHAW! A new reader just joined Panfleto!`.

Also in 1.1: a `context` deadline so provisioning cannot run forever; a wall-clock budget on the
password path, which runs inside the request the reader is waiting on; the hardcoded Telegram chat id
and Resend from-address moved to `PANFLETO_TELEGRAM_CHAT_ID` / `PANFLETO_EMAIL_FROM`; and
`TELEGRAM_BOT_TOKEN` / `RESEND_API_KEY` wired into the `miniflux` container, which is where
`provisionUserOnboarding` actually runs.

**Story 1.2 — `scripts/starter-feed-health.mjs`** fetches every feed in `feeds.json` and classifies
it three ways (broken / mislabelled-but-parseable / healthy), retrying once on weather but never on a
4xx. **Today's answer: all 16 starter feeds are alive.** A weekly Action opens one GitHub issue when
that stops being true and closes it when they recover.

Deployed as pin `4e012f63`; confirmed with a real disposable signup — 16/16 feeds, all six categories
populated, 30.7 s, account deleted afterwards.

## What went well

- **Reading the live system before believing the doc changed the shape of the epic.** Three
  corrections came out of ten minutes of looking: 16 starter feeds across six categories rather than
  13 across five; Auth0 SSO genuinely live (so the Go path genuinely runs); and the smoke
  walkthrough's own path being the *other*, unmentioned implementation.
- **The deterministic gate caught the checker before the checker caught anything.** The health script's
  first run reported 15 of 16 feeds broken, because real RSS starts with an XML declaration. Running
  it for real — rather than shipping it because the tests passed — is what found that.
- **Mutation-checking every new spec was cheap and worth it.** Nine deliberate breakages, nine
  specs that went red exactly where intended. The one that mattered most was the token-scrubbing test.

## What we learned

- **`fetch` rejects on transport errors only, so a non-2xx response is silence unless you check it.**
  This was the bug (`/api/register` treated Miniflux's 500-for-a-dead-feed as success for months) —
  and then we *reintroduced it* two functions later in the same file, on the Telegram and Resend
  calls, where a review caught it. The pattern is sticky: fixing it once in a file does not fix it.
- **A notification path has two failure modes and the interesting one is "configured to nowhere".**
  The code was right and the container wiring was right and the ping still went nowhere, because
  `TELEGRAM_BOT_TOKEN=` is empty on the host. **A silent channel and an unused channel look identical
  from the outside** — which is exactly the epic's own thesis, one layer further out than the epic
  looked. The fix is the product owner's (see *Gaps*).
- **A documentation table can be load-bearing in the wrong direction.** `AGENTS.md` listed
  `RESEND_API_KEY / TELEGRAM_BOT_TOKEN` as reaching `landing`, which read as a statement that the
  credentials lived where the code expected them. Nobody looked, for months.
- **A health checker that cries wolf is worse than no checker**, because the next genuine failure gets
  ignored. Two versions of that were found here — the XML prolog, and a single network blip opening an
  issue against a healthy feed — and both are now specs.
- **Two implementations of one message drift unless something pins them together.** The Go and TS
  summaries are character-identical and each has its own test, but editing one will not turn the other
  red. Recorded as a known limitation rather than papered over.

## Gaps / follow-ups

- **OWED TO THE PRODUCT OWNER — set `TELEGRAM_BOT_TOKEN` in `/opt/panfleto/deploy/.env`.** It is
  present but empty, so no signup ping fires on either path. Everything up to that HTTP call is
  shipped and exercised; the credential is the last inch, and an agent cannot supply it. Steps are in
  `sprint-1.md`. Until then, story 1.1's acceptance "the notification fires at all — verified, not
  assumed" is **unverified, by design of the check rather than by oversight**.
- **The Auth0 half of the smoke is owed too** — registering through "Sign in with Auth0" needs a real
  SSO identity. It is the path that was silently broken, so it is worth doing by hand once, and it is
  gated on the token above anyway.
- **Signup on the password path takes ~31 s** and always has: Miniflux subscribes each feed
  synchronously. It is now bounded (15 s/call, 60 s total) rather than unbounded, but it is not fast.
  Moving that loop off the request is a real improvement and a real behaviour change — a seed, not a
  smuggled-in fix.
- **The fork's delta grew 28 → 29 files** (`internal/ui/user_onboarding_test.go`). The epic's DoD
  expected no growth; this is the deliberate exception, and a `_test.go` beside a file panfleto
  already owns is the cheapest kind.
- **No local Docker daemon on the building workstation**, so the pre-merge gate could not run the
  stack locally. Covered by the post-deploy live signup.
