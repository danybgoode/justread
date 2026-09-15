# Read the comments without leaving the reader — Retrospective

_Closed: 2026-09-15_

## What shipped

A Hacker News reader on `app.panfleto.win` expands **Comments** under the article and reads the thread inside panfleto,
nested and timestamped, instead of leaving for a browser tab. An entry without a supported thread costs nothing, and the
outbound link is still there as the escape hatch.

| Story | What's now true | Ref |
|---|---|---|
| 1.1 | `GET /entry/{id}/comments`, a lazy `<details>` panel, one request on first expand | fork `06593003`, PR #11 |
| 1.2 | HN threads through the Algolia API, 5 deep and 300 comments at most, every body sanitized before it's cached | same |
| 2.1 | A 10-minute in-process cache. No migration | same |
| 2.2 | **Cut** by the product owner: Reddit blocks the VM's IP and its entries carry no comments URL | epic README D4 |

## What went well

- **Probing from the VM before building the second adapter** turned a sprint into a one-line product decision. Reddit
  answered 403 and 429 within three calls, and production data showed Reddit entries have no comments URL at all.
- **The fresh reviewer caught what the unit tests couldn't:** the loader inserted a login page after the session expired,
  the fragment route had no CSP, and replies under a deleted comment vanished. All three are fixed and verified in a real
  browser under the reader's CSP.
- **The browser smoke earned its place twice.** It caught a Trusted Types violation in my own fix and proved that a second
  Download press, which used to throw on a duplicate policy name, now works.

## What we learned

- **A strict Trusted Types CSP makes a policy name a singleton.** `trusted-types html url` forbids a second
  `createPolicy('html')`, and upstream's Download button already created one on every press. Share one policy, and route
  every `innerHTML` through it, including the error path.
- **A fragment endpoint needs its own CSP.** The reader's policy arrives with the page layout, so a route that returns a
  bare fragment of third-party HTML is an unprotected document when it's opened directly.
- **`fetch` follows redirects into your DOM.** A session-gated fragment route will return the login page. Use
  `redirect: "error"` and insert only the statuses you mean.

## Gaps / follow-ups

- **Owed to the product owner:** the signed-in steps in `sprint-1.md` (1–6) and `sprint-2.md` (1–3).
- The panel appears only for HN. Ars Technica and 9to5Mac threads live on their own sites, and the outbound link covers them.
- Comment images and iframes are not media-proxied (HN markup has none).
- A Reddit adapter would need a Reddit OAuth app and a production secret, which the product owner has declined for now.
