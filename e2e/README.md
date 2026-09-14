# e2e harness

Two Playwright projects, matching `Roadmap/WAYS-OF-WORKING.md` § *Automated QA* — coverage grows by
**one spec per new browser-/API-testable story**, not as a separate project.

- **`api` project — the deterministic gate (always-on).** `npm run test:e2e`, API-level via the
  `request` fixture, no browser binaries. CI runs this on every PR. Must be green before merge.
- **`browser` project — opt-in real-browser smoke (NOT the gate).** `npm run test:e2e:browser`,
  Chromium, `*.browser.spec.ts`. Asserts *rendered* UI an API call can't see. Kept out of the
  blocking gate (binaries are heavy/slow); run on demand.

## What this harness can and cannot confirm on panfleto's rail

panfleto has **no per-branch preview** (see WAYS-OF-WORKING § *Deploy rail*). There is no preview URL
to point the harness at, so:

- Pre-merge, the `api` project runs against **`http://localhost:8080`** (a local `docker compose up`
  of the reader) or against nothing at all for a docs-only change. That is the gate.
- Post-merge and post-`update.sh`, the same specs run against **`https://app.panfleto.win`** as the
  live confirmation. That split is stated in every PR body — it is the rail's real shape, not a gap.

```
PLAYWRIGHT_BASE_URL=http://localhost:8080 npm run test:e2e   # pre-merge gate
npm run test:e2e                                             # post-deploy prod smoke (default)
```

## Two panfleto-specific notes

1. **The reader is Go, the landing is Next.js, and they are separate origins.** A spec that needs the
   landing page or the MCP endpoint targets `https://panfleto.win`; a spec for the reader targets
   `https://app.panfleto.win`. Pass the origin explicitly in the spec rather than relying on
   `baseURL` when a spec crosses that boundary.
2. **Anything behind login is owed to the product owner** until a disposable test account exists.
   Miniflux session auth and the Auth0 SSO path can't be driven from an anonymous `request` fixture.
   Name the owed step by number in the sprint's smoke walkthrough.

## Package scripts to add once a real spec exists

```json
{
  "scripts": {
    "test:e2e": "playwright test --project=api",
    "test:e2e:browser": "playwright test --project=browser"
  }
}
```
