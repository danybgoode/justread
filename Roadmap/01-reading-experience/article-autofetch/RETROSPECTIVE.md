# Click an article and the content is already there — Retrospective

_Closed: 2026-09-15_

## What shipped

**Most articles now arrive with their full text.** After the first poll, the 26 teaser feeds' new entries had a median
of 2,623 characters of text. That includes the NYT, which blocks panfleto's IP and now comes through unwall.app, and
El País, The Guardian and Ars. The scraping runs off the poll path, one request per host, and every piece of it switches
off with a line in `deploy/.env`.

| Sprint | What's now true | Ref |
|---|---|---|
| S1 | New feeds crawl by default. 27 teaser feeds backfilled by recorded SQL (26 after Techmeme). First poll: 135 crawled entries, load 0.18 | PR #10 `0825cd5`, fork `fa8e46a2` |
| S2 | Direct → unwall.app, one seam for the poll path and Download, a miss is never an error. **archive.ph cut** as unreachable. A4 is 111 unwall.app articles in 7 min of backlog with 0 rate limits | same |
| S3 | A bounded 2-worker queue, 1 request per host, recovery on restart (215 → 215), derived fetch state, no migration | same |

## What went well

- **The spike ran from the VM, and that settled the scope.** The same afternoon it showed unwall.app works as an API
  and archive.ph can't be reached, which cut story 2.3 before anyone built it.
- **Staged rollout by env var.** It deployed with everything off and matched today's behaviour. Then S1, then S2 and
  S3, then a restart and a kill-switch test, all in about 90 minutes with no rebuild between stages.
- **The fresh reviewer earned its slot.** A forced refresh would have silently reverted every fetched article to its
  teaser. Filter rules, private-feed tokens and a lock that could stall the Download button behind workers were all
  caught before merge.

## What we learned

- **Look at the stored result of a scrape, not just its length.** Techmeme's "full text" was 100K characters because its
  item links are anchors into its front page. A median jump that looks like success can be a whole page stored per entry.
  Watch for outliers in the first poll.
- **Moving work off a hot path breaks whatever relied on it running inline.** Forced refresh, the after-scrape filter
  pass and integrations all assumed the scrape happened inside the poll.
- **An in-memory derived state has a restart cost.** A3 bought zero migrations. The price is that every restart retries
  the last 6 hours' thin entries. Write that cost down with the decision.

## Gaps / follow-ups

- **Owed to the product owner:** the signed-in steps in `sprint-1.md` (1–6), `sprint-2.md` (1–4, 6) and `sprint-3.md` (2–4).
- **BBC and FT stay teasers.** BBC refuses the VM and unwall.app, and FT is paywalled even through unwall.app. The rail covers them.
- **Integrations** get the feed's content, not the fetched article. There are 0 configured today.
- **Prefetched content doesn't update `changed_at`**, so "recently changed" queries undercount fetched articles.
- **A burst from one host can hold both workers** in its 2 s spacing. Nothing observed so far calls for a per-host queue.
- Named exposure, a product decision from 2026-09-14: paywalled articles fetched through a third-party bypass service are stored in a multi-user reader.
