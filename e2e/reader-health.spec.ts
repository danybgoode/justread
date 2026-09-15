import { expect, test } from '@playwright/test'

/**
 * Reader health — anonymous, API-level, no login.
 *
 * The spec that would have caught a failed migration, a half-started container or a rebase that
 * quietly dropped panfleto's branding. It runs against both rails:
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:8080 npm run test:e2e   # pre-merge, local stack
 *   npm run test:e2e                                             # post-deploy, app.panfleto.win
 *
 * What it cannot see: anything behind Miniflux session auth or Auth0 (/about's version string, the
 * reader, the MCP panel). Those steps are owed to the product owner by name in sprint-2.md.
 */

// Upstream Miniflux's own favicon path data. If a rebase ever takes upstream's icon.svg, this shows up.
const UPSTREAM_MINIFLUX_LOGO = 'M178.24,117'

test('the healthcheck answers OK', async ({ request }) => {
  const res = await request.get('/healthcheck')
  expect(res.status()).toBe(200)
  expect((await res.text()).trim()).toBe('OK')
})

test('the front door renders the panfleto sign-in page, not an error', async ({ request }) => {
  const res = await request.get('/', { headers: { Accept: 'text/html' } })
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain('<title>Sign In - panfleto</title>')
})

test('an authenticated page redirects to sign-in rather than failing', async ({ request }) => {
  const res = await request.get('/about', { headers: { Accept: 'text/html' }, maxRedirects: 0 })
  expect(res.status()).toBe(302)
  expect(res.headers()['location']).toContain('redirect_url=%2Fabout')
})

test('the API layer is up and refuses anonymous callers', async ({ request }) => {
  const res = await request.get('/v1/version')
  expect(res.status()).toBe(401)
  expect(await res.json()).toHaveProperty('error_message')
})

test('the web manifest carries the panfleto identity', async ({ request }) => {
  const res = await request.get('/manifest.json')
  expect(res.status()).toBe(200)
  const manifest = await res.json()
  expect(manifest.name).toBe('panfleto')
  expect(manifest.short_name).toBe('panfleto')
})

test('every favicon the page links resolves, and none is upstream Miniflux logo', async ({ request }) => {
  const html = await (await request.get('/', { headers: { Accept: 'text/html' } })).text()
  const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1])
  expect(hrefs.length).toBeGreaterThan(0)
  for (const href of hrefs) {
    const res = await request.get(href)
    expect(res.status(), href).toBe(200)
    if (href.endsWith('.svg')) expect(await res.text(), href).not.toContain(UPSTREAM_MINIFLUX_LOGO)
  }
})
