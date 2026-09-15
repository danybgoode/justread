# How should unwall.app reach the reader? — Sprint 1: Probe unwall.app from the VM and write the decision

**Status:** ⬜ not started

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
_(paste the observed `curl` output here — all four publishers)_

## Decision
_(not yet made — this is the deliverable)_

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
