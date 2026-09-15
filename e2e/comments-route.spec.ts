import { expect, test } from '@playwright/test'

/**
 * Inline comments, story 1.1: the comments route is behind sign-in, and it 404s (never 500s) for an
 * entry without a supported comments URL.
 *
 * The anonymous check always runs. The signed-in check needs a reader account and the id of an entry
 * that has no comments URL:
 *
 *   PANFLETO_UI_USERNAME=… PANFLETO_UI_PASSWORD=… PANFLETO_NO_COMMENTS_ENTRY=116 \
 *     PLAYWRIGHT_BASE_URL=http://localhost:8089 npm run test:e2e
 */
const username = process.env.PANFLETO_UI_USERNAME
const password = process.env.PANFLETO_UI_PASSWORD
const noCommentsEntry = process.env.PANFLETO_NO_COMMENTS_ENTRY

test('the comments route sends an anonymous visitor to sign-in', async ({ request }) => {
  const res = await request.get('/entry/1/comments', { headers: { Accept: 'text/html' }, maxRedirects: 0 })
  expect(res.status()).toBe(302)
  expect(res.headers()['location']).toContain('redirect_url=')
})

test('the comments route 404s for an entry without a supported comments URL', async ({ request }) => {
  test.skip(!username || !password || !noCommentsEntry, 'needs PANFLETO_UI_USERNAME, PANFLETO_UI_PASSWORD and PANFLETO_NO_COMMENTS_ENTRY')

  const login = await request.get('/', { headers: { Accept: 'text/html' } })
  const csrf = (await login.text()).match(/name="csrf" value="([^"]+)"/)?.[1] ?? ''
  const signedIn = await request.post('/login', { form: { csrf, username: username!, password: password! }, maxRedirects: 0 })
  expect(signedIn.status()).toBe(302)

  const res = await request.get(`/entry/${noCommentsEntry}/comments`, { headers: { Accept: 'text/html' } })
  expect(res.status()).toBe(404)
})
