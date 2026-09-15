import { expect, test } from '@playwright/test'

/**
 * Article autofetch, story 1.1: a feed created through the API arrives with "Fetch original content"
 * on, because FORCE_CRAWLER defaults to on in deploy/docker-compose.yml. It's the regression that would
 * quietly undo the whole epic.
 *
 * It needs an account that may create a feed, so it runs only with credentials:
 *
 *   PANFLETO_API_USERNAME=admin PANFLETO_API_PASSWORD=… PLAYWRIGHT_BASE_URL=http://localhost:8080 npm run test:e2e
 *
 * Without them it skips. It creates one feed and always deletes it.
 */
const username = process.env.PANFLETO_API_USERNAME
const password = process.env.PANFLETO_API_PASSWORD
const feedURL = process.env.PANFLETO_AUTOFETCH_FEED_URL ?? 'https://daringfireball.net/feeds/main'

test('a feed created through the API has the crawler on', async ({ request }) => {
  test.skip(!username || !password, 'needs PANFLETO_API_USERNAME and PANFLETO_API_PASSWORD')

  const headers = { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` }

  const categories = await request.get('/v1/categories', { headers })
  expect(categories.status()).toBe(200)
  const [category] = await categories.json()

  // The API default for `crawler` is false; FORCE_CRAWLER is what must turn it on.
  const created = await request.post('/v1/feeds', {
    headers,
    data: { feed_url: feedURL, category_id: category.id, crawler: false },
  })
  expect(created.status(), await created.text()).toBe(201)
  const { feed_id: feedID } = await created.json()

  try {
    const feed = await request.get(`/v1/feeds/${feedID}`, { headers })
    expect(feed.status()).toBe(200)
    expect((await feed.json()).crawler).toBe(true)
  } finally {
    await request.delete(`/v1/feeds/${feedID}`, { headers })
  }
})
