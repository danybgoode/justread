import { expect, test } from '@playwright/test'

/**
 * The paywall rail — told once, by the template, with the right links.
 * Roadmap/01-reading-experience/paywall-rail-single-source
 *
 * Anonymous: a shared entry (`/share/<code>`) renders the same `entry` template a signed-in reader
 * sees, so the rail can be asserted without a session. Point PANFLETO_SHARED_ENTRY at one:
 *
 *   PANFLETO_SHARED_ENTRY=/share/<code> PLAYWRIGHT_BASE_URL=http://localhost:8080 npm run test:e2e
 *
 * Skips when it is unset — a share code is per-install data, not something the spec can create.
 */
const shared = process.env.PANFLETO_SHARED_ENTRY

test.describe('paywall rail on a shared entry', () => {
  test.skip(!shared, 'PANFLETO_SHARED_ENTRY is not set')

  test('one rail: archive.ph, archive.is and unwall.app, and nothing appended into the body', async ({ request }) => {
    const res = await request.get(shared!, { headers: { Accept: 'text/html' } })
    expect(res.status()).toBe(200)
    const html = await res.text()

    // Exactly one rail — an entry the old archive appender touched would show a second one in its content.
    expect(html.match(/Paywall Bypass/g) ?? []).toHaveLength(1)
    expect(html).not.toContain('txtify.it')
    expect(html).not.toContain('web.archive.org')

    const rail = html.slice(html.indexOf('class="entry-archive-link"'))
    const hrefs = [...rail.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&'))
    const articleURL = hrefs[0].replace('https://archive.ph/newest/', '')
    expect(articleURL).toMatch(/^https?:\/\//)
    expect(hrefs.slice(0, 3)).toEqual([
      `https://archive.ph/newest/${articleURL}`,
      `https://archive.is/newest/${articleURL}`,
      `https://unwall.app/${articleURL.replace(/^https?:\/\//, '')}`,
    ])
  })
})
