# How should unwall.app reach the reader? — Sprint 1: Probe unwall.app from the VM and write the decision

**Status:** ✅ done — findings + decision written 2026-09-15 (probed from `panfleto-prod`)

> **Build contract (locked by the architect before the builder started)**
>
> - **Run it from the Oracle VM.** Per-IP rate limits mean results from anywhere else are not the
>   results that matter.
> - **No code. No branch.** The deliverable is the Decision section at the bottom of this file.
> - **Four publishers, not one.** A service that only works on the NYT is not a fallback.
> - **If unwall.app is unreachable or unusable, that is a complete and valuable answer.** Write it
>   down, cut `article-autofetch` story 2.2, and stop. Do not spend the appetite looking for a
>   workaround.

## Stories

### Story 1.1 — Probe it from the VM
**As the** architect of `article-autofetch`, **I want** real observed behaviour from unwall.app,
**so that** the fallback chain is designed against facts rather than a guess.

```bash
U="https://unwall.app/www.nytimes.com/2026/09/14/us/politics/donald-trump-jr-wedding-russian-businessman.html"

curl -sSI -L "$U"                # status chain, X-Frame-Options, CSP, content-type
curl -sS  -L "$U" | head -c 4000 # rendered article HTML, or a shell?
curl -sS  -L "$U" | wc -c        # enough body to be the article?
for i in $(seq 1 12); do curl -sS -o /dev/null -w "%{http_code} " -L "$U"; sleep 2; done   # throttling
```

Then repeat against three more publishers from the real starter feeds: **ft.com**, **elpais.com**,
**newyorker.com**.

**Acceptance:**
- Observed output for all four publishers is pasted into the Findings section below
- The status chain, `X-Frame-Options`/CSP headers and content-type are recorded verbatim
- The throttling loop's result is recorded — including what a throttled response actually looks like
- A URL with a **query string** and a **non-`www` host** are both tried

**Risk:** low

### Story 1.2 — Write the decision
**As** whoever builds `article-autofetch` S2, **I want** a decision I can cite, **so that** I don't
re-derive it and drift from it.

**Acceptance — the decision states all five:**
1. **(A) or (B)**, and why
2. Whether the output needs readability extraction or is already clean enough to store
3. The **failure mode**: what the chain does when unwall.app 403s, throttles or disappears. A
   fallback that hard-fails the fetch is worse than no fallback
4. Whether it earns a **cache**, and with what TTL, before autofetch calls it at polling volume
5. The exact URL-construction rule, including query strings and non-`www` hosts

**Risk:** low

## Sprint QA
- **api spec(s):** none. This sprint produces a document.
- **browser smoke owed:** none — though opening one unwall.app URL in a normal browser is a useful
  sanity check alongside the `curl` output.
- **deterministic gate:** n/a. The gate is the five points above being answered.

## Findings

Run from `panfleto-prod` (the Oracle VM, its own egress IP) on 2026-09-15, 18:30–18:45 UTC. Article bodies are
recorded by size and paragraph count only, so none of the publishers' text is reproduced here.

**1. `unwall.app/{host}{path}` is a client-side app, and the article comes from a JSON API.** The page
is a 15.8 KB HTML shell (`<script src="/assets/index-5KYFSNyB.js">`) that returns `HTTP/2 200` for
any path. Reading the bundle shows how it builds the fetch:

```
function bk(n){const o=new URLSearchParams({url:n});…return `${xr}/fetch?${o}`}   // xr = "https://api.unwall.app"
```

So the fetchable resource is `GET https://api.unwall.app/fetch?url=<url-encoded absolute URL>`.

**2. Response headers (VM, New Yorker URL), verbatim, minus Cloudflare's NEL/report-to noise:**

```
HTTP/2 200
content-type: application/json; charset=utf-8
server: cloudflare
x-powered-by: Express
access-control-allow-origin: *
ratelimit-policy: 120;w=60
ratelimit-limit: 120
ratelimit-remaining: 117
ratelimit-reset: 57
cache-control: public, max-age=0, s-maxage=300, stale-while-revalidate=86400
server-timing: safe_input;dur=61.5, cache_lookup;dur=0.3, inflight_wait;dur=0.0, upstream_fetch;dur=311.9, rewrite_html;dur=4.9, total;dur=381.4
cf-cache-status: HIT
```

Neither `api.unwall.app` nor `unwall.app/` sends `X-Frame-Options` or `Content-Security-Policy`.

**3. Body shape.** It's always a JSON object: `{"html": "<!DOCTYPE html>…", "finalUrl": "…", "challenge": false, "browserRendered": false}`.
`html` is the publisher's **whole page** (25–46 `<script>` tags, full chrome), not a reader view.

**4. Four publishers from the real starter feeds.** "Paragraph text" means the characters in `<p>`
elements longer than 80 characters, with scripts and styles removed.

| Publisher | URL shape | Direct fetch from VM | Via api.unwall.app | Verdict |
|---|---|---|---|---|
| nytimes.com | `www.nytimes.com/2026/09/14/us/politics/…html` | **403**, 0 chars | 200 · 292,811 B JSON · 27 ¶ · **5,998 chars** · `challenge:false` | unwall **adds the article** |
| ft.com | `www.ft.com/content/e14542d9-…?syn-25a6b1a6=1` | **403**, 0 chars | 200 · 156,497 B · 4 ¶ · **476 chars** | unwall returns the **teaser only** |
| elpais.com | `elpais.com/sociedad/2026-09-15/…html` (no `www`) | 200 · 14 ¶ · 4,984 chars | 200 · 14 ¶ · 4,984 chars | direct already works |
| newyorker.com | `www.newyorker.com/news/the-lede/mail-in-voting-survives` | 200 · 12 ¶ · 8,086 chars | 200 · 12 ¶ · 8,086 chars | direct already works |

**5. URL edge cases (VM):**

```
query string   https://www.ft.com/content/e14542d9-…?syn-25a6b1a6=1   → 200, finalUrl keeps ?syn-25a6b1a6=1
no query       https://www.ft.com/content/e14542d9-…                  → 200, same article
non-www host   https://nytimes.com/2026/09/14/…html                   → 200, finalUrl https://www.nytimes.com/…
bad host       https://example.invalid/nope                           → 400 {"error":"Could not resolve hostname"}
no scheme      not-a-url                                              → 400 {"error":"Invalid URL"}
```

**6. Throttling loop, 12 calls 2 s apart (the El País URL):**

```
200/118 200/118 200/118 200/118 200/118 200/118 200/118 200/118 200/118 200/118 200/118 200/118
```

`ratelimit-remaining` didn't move, because Cloudflare served every call from its edge cache
(`s-maxage=300`), so cached calls don't count against the limit. Across ~20 uncached calls it counted
down from 119 to 112. **A throttled response wasn't observed.** Forcing one would take 120 uncached calls
inside a minute against a one-person side project, and the spike didn't do that. The published policy
is `120;w=60` in IETF `RateLimit-*` headers, and the `x-powered-by: Express` stack's standard limiter answers
**429**.

**7. The same session also probed archive.ph from the VM, for `article-autofetch` story 2.3:**

```
$ getent hosts archive.ph           → (nothing; the VCN resolver 169.254.169.254 refuses archive.ph/.is/.today/.md)
$ dig +short @8.8.8.8 archive.ph    → 151.80.18.153
$ curl --resolve archive.ph:443:151.80.18.153 …   → curl: (28) Connection timed out after 40002 milliseconds
$ curl --resolve archive.ph:443:185.195.236.97 …  → 000
$ curl --resolve archive.ph:443:107.189.8.227 …   → 000
```

archive.ph can't be reached from panfleto's IP at all.

## Decision

1. **(A) Server-side fetch.** The output is plain JSON from an API with an open CORS header and no framing
   policy, so either shape would work. (B) would still hand a third party the reader's viewport and
   widen panfleto's CSP, and (A) keeps panfleto's typography and puts the article there on click.
   `unwall.app` becomes step two of the chain, called as `GET https://api.unwall.app/fetch?url=…` through
   `internal/reader/fetcher`.
2. **It needs readability extraction.** `html` is the publisher's full page with its chrome and
   scripts. The chain takes `html`, runs it through `internal/reader/readability` with `finalUrl` as
   the base URL, and the result goes through the same sanitizer as every other scrape.
3. **Failure mode: a miss, never an error.** Any non-200, unparseable JSON, empty `html`,
   `challenge: true`, or extracted text still under the thin threshold makes the step return
   nothing, and the chain keeps whatever step one produced. On **429**, or when `ratelimit-remaining`
   drops to 10 or below, the step stops calling for `ratelimit-reset` seconds (60 if absent).
   Consecutive transport or 5xx failures back off exponentially from 1 minute to a 30-minute cap.
   While the step is cooling down, the chain skips it and never waits on it. If unwall.app disappears
   the chain degrades to step one alone, which is today's behaviour.
4. **A small cache, not a durable one.** unwall.app already caches at its edge for 5 minutes, and
   panfleto stores the result in the entry, so reopening an article never calls it again. The only
   duplicate traffic is the same article arriving through two users' copies of one feed: 13 feed URLs
   are shared by both production users. An in-process cache keyed by article URL, **1-hour TTL,
   256 entries**, removes that. Autofetch's projected volume is **47.6 thin entries/hour** (see
   `article-autofetch` A4) against a limit of 7,200/hour, so no more than that is justified.
5. **URL rule: pass the entry's URL whole, as one URL-encoded `url` query parameter.** The scheme is
   required (`not-a-url` gets a 400), so only `http://` and `https://` entry URLs are sent. The query
   string is kept verbatim, because FT's `?syn-…` works and stripping it is Miniflux's tracking-parameter
   cleaner's job, not the chain's. Non-`www` hosts need no rewriting, since unwall follows the publisher's
   own redirect and reports it as `finalUrl`. **The `unwall.app/{host}{path}` link format the rail uses
   is unaffected.** It's the web app's route, and it still resolves.

**What unwall.app buys, honestly:** from this IP, direct scraping already works for El País and The
New Yorker. unwall.app adds the NYT and doesn't help with FT. It's a real step two for the publishers that
block datacenter IPs, not a paywall solution for all of them.

**What this spike changes in `article-autofetch`:** A1 is resolved as above. **Story 2.3 (archive.ph) is
cut**, because finding 7 shows the service can't be reached from production, so the chain is two steps:
direct, then unwall.app.

## Sprint 1 — Smoke walkthrough
Env: the Oracle VM (this sprint does not deploy)

1. Read the Findings section above.
   → It contains real pasted output for four publishers, not a summary.
2. Read the Decision section.
   → It answers all five required points, each in a sentence or two.
3. Open `Roadmap/01-reading-experience/article-autofetch/README.md`.
   → Assumption **A1** now records the answer instead of "to lock".
4. If the decision was "unwall.app is not usable", open that epic's `sprint-2.md`.
   → Story 2.2 is struck through or removed, and the chain is described as two steps.

If any step fails, note the step number + what you saw — that's the bug report.
