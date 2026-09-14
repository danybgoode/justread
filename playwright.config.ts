import { defineConfig, devices } from '@playwright/test'

/**
 * panfleto e2e harness — see Roadmap/WAYS-OF-WORKING.md § Automated QA and e2e/README.md.
 *
 * TWO projects:
 *   - `api`     — the deterministic gate. API-level specs (`*.spec.ts`, excluding
 *                 `*.browser.spec.ts`) via the `request` fixture. No browser binaries → fast,
 *                 cheap, green before every merge.
 *   - `browser` — opt-in real-browser smoke (`*.browser.spec.ts`, Chromium). Asserts *rendered*
 *                 UI an API call can't see. NOT in the blocking gate.
 *
 *   npm run test:e2e           # api only — the gate
 *   npm run test:e2e:browser   # browser only (run `npx playwright install chromium` first)
 *
 * panfleto has NO per-branch preview rail, so there is no preview URL and no SSO-bypass header.
 * Point PLAYWRIGHT_BASE_URL at a local `docker compose up` pre-merge, and let it default to the
 * live reader for the post-deploy smoke — that split is the rail's real shape, not a gap.
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:8080 npm run test:e2e   # pre-merge gate
 *   npm run test:e2e                                             # post-deploy prod smoke
 *
 * The reader and the landing page are separate origins (app.panfleto.win vs panfleto.win); a spec
 * that crosses that boundary names its origin explicitly rather than relying on baseURL.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://app.panfleto.win'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json' },
  },
  projects: [
    {
      name: 'api',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*\.browser\.spec\.ts/,
    },
    {
      name: 'browser',
      testMatch: /.*\.browser\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
