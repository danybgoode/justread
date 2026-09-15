// One list of recommended feeds — panfleto-core/internal/ui/static/bin/feeds.json.
//
// Guards the miniflux-upstream-resync S3 contract: feeds.json is well-formed, and none of the places
// that used to carry their own copy (the onboarding Go code, the subscribe page's table, the landing
// page signup) has grown one back. Reads files only; needs the panfleto-core submodule checked out.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const core = join(root, 'panfleto-core')
const FEEDS_JSON = join(core, 'internal/ui/static/bin/feeds.json')
const coreCheckedOut = existsSync(join(core, 'go.mod'))
const read = (p) => readFileSync(p, 'utf8')
if (!coreCheckedOut && process.env.CI) throw new Error('panfleto-core submodule not checked out in CI — a skip here would read as a pass')
const skip = coreCheckedOut ? false : 'panfleto-core submodule not checked out'

test('feeds.json is a list of well-formed, unique https feeds', { skip }, () => {
  const feeds = JSON.parse(read(FEEDS_JSON))
  assert.ok(Array.isArray(feeds) && feeds.length > 0)
  const urls = new Set()
  for (const f of feeds) {
    assert.deepEqual(Object.keys(f).sort(), ['category', 'starter', 'title', 'url'], JSON.stringify(f))
    assert.match(f.url, /^https:\/\/\S+$/, f.url)
    assert.ok(f.title.trim() && f.category.trim(), f.url)
    assert.equal(typeof f.starter, 'boolean', f.url)
    assert.ok(!urls.has(f.url), `duplicate ${f.url}`)
    urls.add(f.url)
  }
  assert.ok(feeds.some((f) => f.starter), 'at least one starter feed')
})

test('no other file carries its own copy of a feed on the list', { skip }, () => {
  const urls = JSON.parse(read(FEEDS_JSON)).map((f) => f.url)
  const copies = [
    join(core, 'internal/ui/user_onboarding.go'),
    join(core, 'internal/template/templates/views/add_subscription.html'),
    join(root, 'landing-page/src/app/api/register/route.ts'),
    join(root, 'scripts/enhance_miniflux.js'),
  ]
  for (const file of copies) {
    const body = read(file)
    for (const url of urls) assert.ok(!body.includes(url), `${file} hardcodes ${url}`)
  }
})

test('the subscribe page needs no inline script, so the fork carries no CSP nonce patch', { skip }, () => {
  const subscribe = read(join(core, 'internal/template/templates/views/add_subscription.html'))
  assert.ok(!/<script/i.test(subscribe), 'add_subscription.html has an inline <script>')
  assert.ok(!/\sstyle=/i.test(subscribe), 'add_subscription.html has an inline style attribute')
  assert.ok(subscribe.includes('range $feed := .suggestedFeeds'), 'suggestions are rendered from feeds.json')
  assert.ok(!read(join(core, 'internal/ui/view/view.go')).includes('cspNonce'))
  assert.ok(read(join(core, 'internal/template/templates/common/layout.html')).includes('{{ $cspNonce := nonce }}'))
})
