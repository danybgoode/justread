# Tell the paywall rail once, in the template, correctly — Sprint 2: One rail, told in the template

**Status:** ✅ shipped 2026-09-15 — PR #8 (`a20c21d`; merge `23813b5`), fork `37d7a7e9`, deployed 16:43 UTC

> **Build contract (locked by the architect before the builder started)**
>
> - **Links only.** This sprint does not fetch or render anything from unwall.app — that is
>   `article-autofetch` S2, and it is blocked on the spike. This one is four lines and a helper.
> - **`stripScheme` takes the parsed host and path**, not a string slice of the raw URL. Slicing a
>   string would undo the `untrustedURL` escaping the template already applies — that is how you get
>   an XSS in a template that looked safe.
> - **`entry.html` is already a fork delta file**, so editing it costs no new rebase tax. Do not add
>   a new template file.
> - **Leave the "Save Panflo" link alone.** It shares the rail's container and is not in scope.
> - **Do not restyle the rail.** Its inline `style=` attributes and the raw hex `#BD5FFF` are real
>   design-language debt, noted in the seed, and deliberately not this sprint's job.
>
> **Corrected during the build (README D5):** there is no `stripScheme` helper. `functions.go` is not a
> fork-delta file, and html/template's contextual escaping — not `untrustedURL` — is what makes the link
> safe, so the scheme is cut in `entry.html` with no Go at all.

## Stories

### Story 2.1 — A stripScheme template helper ✅ (replaced by D5)
**As a** template, **I want** a safe way to render a URL without its scheme, **so that** unwall.app's
`host/path` format can be built without string-munging in markup.

**Acceptance:**
- ➖ No helper in `functions.go` — it would have added a file to the fork's delta (D5)
- ✅ The template keeps everything after `https://`/`http://`; any other scheme gets no unwall link
- ✅ Covered through html/template, not a unit test: `http://`, `https://`, query string, port, non-`www` host,
  malformed input, `javascript:`, `https://javascript:…`, `"><script>`, spaces and non-ASCII — the origin
  stays `https://unwall.app/`, and hostile characters are percent-encoded. Nothing panics; `startsWith` guards `slice`
- ✅ Output escaped by html/template at render

**Risk:** low

### Story 2.2 — One rail, correct links ✅
**As a** reader hitting a paywall, **I want** the bypass options that actually work, **so that** I stop
clicking two links that rarely do.

**Acceptance:**
- ✅ The rail renders **archive.ph · archive.is · unwall.app** (live: a BBC article, query string intact)
- ✅ Txtify.it and Wayback are gone from the template (and from the deployed binary)
- ✅ For `https://www.nytimes.com/2026/09/14/us/politics/x.html` the unwall link is exactly
  `https://unwall.app/www.nytimes.com/2026/09/14/us/politics/x.html` (rendered by the real binary locally)
- ✅ All three links open in a new tab the same way the current rail does — hardcoded `target="_blank"`, which is
  what the rail did; it never read the setting
- ✅ At a 400px viewport the rail wraps; page `scrollWidth` stays 400 (no overflow)
- ✅ `e2e/paywall-rail.spec.ts` asserts one rail and the three hrefs against the entry's title link, on any
  shared entry (`PANFLETO_SHARED_ENTRY`); observed red on an entry carrying the appender's block

**Risk:** low

## Sprint QA
- **api spec(s):** pure-logic `go test` on `stripScheme` (story 2.1's table). A deployed-reader spec
  would only assert markup, which the smoke covers better.
- **browser smoke owed:** yes, to the product owner — clicking the unwall link on a real paywalled
  article and confirming it resolves.
- **deterministic gate:** `go build` + `go vet` + `go test` + `docker compose build`.

## Sprint 2 — Smoke walkthrough (do these in order)
Env: production · `https://app.panfleto.win`

1. **(auth path — owed to the product owner by name)** Sign in and open any **New York Times** article.
   → The rail below shows three links: Archive.ph, Archive.is, unwall.app. No Txtify.it, no Wayback.
2. Hover the unwall.app link and read the status bar URL.
   → `https://unwall.app/www.nytimes.com/…` — the scheme is stripped, the rest of the path is intact.
3. Click it.
   → unwall.app opens in a new tab and renders the article.
4. Open an article whose URL has a query string (many El País links do).
   → The unwall link preserves the query string.
5. Open the reader on a phone, or narrow the browser to ~400px, and open an article.
   → The rail wraps rather than overflowing the page sideways.
6. Confirm the "Save Panflo" link is still on the right of the rail, unchanged.
   → It is.

If any step fails, note the step number + what you saw — that's the bug report.
