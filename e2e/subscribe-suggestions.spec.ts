import { expect, test } from '@playwright/test'

/**
 * Subscribe-page suggestions come from feeds.json, and nothing drops a feed on the way.
 *
 * The anonymous half runs everywhere: the reader serves feeds.json (the landing page's signup and
 * scripts/enhance_miniflux.js read it from there), and it parses to the same list the repo holds.
 *
 * The signed-in half needs a password account and skips without one — production signs in through
 * Auth0, so it runs against a local stack:
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:8080 PANFLETO_E2E_USERNAME=admin PANFLETO_E2E_PASSWORD=… \
 *     npx playwright test --project=api e2e/subscribe-suggestions.spec.ts
 */

type SuggestedFeed = { url: string; title: string; category: string; starter: boolean }

const username = process.env.PANFLETO_E2E_USERNAME
const password = process.env.PANFLETO_E2E_PASSWORD

async function servedFeeds(request: import('@playwright/test').APIRequestContext): Promise<SuggestedFeed[]> {
  const res = await request.get('/icon/feeds/feeds.json')
  expect(res.status()).toBe(200)
  return JSON.parse(await res.text())
}

test('the reader serves feeds.json with at least one starter feed', async ({ request }) => {
  const feeds = await servedFeeds(request)
  expect(feeds.length).toBeGreaterThan(0)
  expect(feeds.some((f) => f.starter)).toBe(true)
  for (const f of feeds) expect(f.url).toMatch(/^https:\/\//)
})

test('the subscribe page offers Quick Add and Review for every feed in feeds.json', async ({ request }) => {
  test.skip(!username || !password, 'needs PANFLETO_E2E_USERNAME / PANFLETO_E2E_PASSWORD (a password account)')

  const feeds = await servedFeeds(request)
  const signIn = await (await request.get('/', { headers: { Accept: 'text/html' } })).text()
  const csrf = signIn.match(/name="csrf" value="([^"]+)"/)?.[1]
  expect(csrf).toBeTruthy()
  const login = await request.post('/login', {
    form: { csrf: csrf!, username: username!, password: password! },
    maxRedirects: 0,
  })
  expect(login.status()).toBe(302)

  const page = await (await request.get('/subscribe', { headers: { Accept: 'text/html' } })).text()
  const decode = (s: string) => decodeURIComponent(s.replaceAll('&amp;', '&'))
  const quickAdd = [...page.matchAll(/name="url" value="([^"]+)"/g)].map((m) => decode(m[1]))
  const review = [...page.matchAll(/\/bookmarklet\?uri=([^"]+)"/g)].map((m) => decode(m[1]))
  const expected = feeds.map((f) => f.url)
  expect(quickAdd).toEqual(expected)
  expect(review).toEqual(expected)
  expect(page.match(/class="suggested-feed"/g)?.length).toBe(feeds.length)
})
