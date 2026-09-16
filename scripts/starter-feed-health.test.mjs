// Pure-logic tests for the starter-feed health check. No network.
//
// The case that matters most is the one the first draft got wrong: every real RSS feed starts with an
// XML declaration, not with `<rss`, so a naive root-element check calls all 16 starter feeds broken.
// A checker that cries wolf is worse than no checker, because the next dead feed gets ignored.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify, feedRoot, formatReport, readFeeds, FEEDS_JSON } from './starter-feed-health.mjs'
import { existsSync } from 'node:fs'

const skip = existsSync(FEEDS_JSON) ? false : 'panfleto-core submodule not checked out'
if (!existsSync(FEEDS_JSON) && process.env.CI) throw new Error('panfleto-core submodule not checked out in CI — a skip here would read as a pass')

test('feedRoot skips the XML declaration, comments and a doctype', () => {
  assert.ok(feedRoot('<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0">').startsWith('<rss'))
  assert.ok(feedRoot('﻿<?xml version="1.0"?><!-- built by a CMS --><feed xmlns="x">').startsWith('<feed'))
  assert.ok(feedRoot('<?xml version="1.0"?>\n<?xml-stylesheet href="x"?>\n<rss>').startsWith('<rss'))
  assert.ok(feedRoot('<!DOCTYPE html>\n<html>').startsWith('<html'))
})

test('a real feed behind an XML declaration is healthy', () => {
  const body = '<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0"><channel><title>x</title></channel></rss>'
  assert.deepEqual(classify({ status: 200, contentType: 'application/rss+xml', body }), { healthy: true })
})

test('an HTML page served with 200 is not a feed', () => {
  const got = classify({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!DOCTYPE html><html><body>This domain is for sale</body></html>' })
  assert.equal(got.healthy, false)
  assert.match(got.reason, /not a feed/)
})

test('a parseable feed with the wrong content-type is a warning, not a failure', () => {
  const got = classify({ status: 200, contentType: 'text/plain', body: '<?xml version="1.0"?><rss><channel/></rss>' })
  assert.equal(got.healthy, true)
  assert.match(got.warning, /text\/plain/)
})

test('HTTP errors, unresolved redirects and transport errors all fail', () => {
  assert.equal(classify({ status: 404, body: '' }).healthy, false)
  assert.equal(classify({ status: 500, body: '' }).healthy, false)
  assert.equal(classify({ status: 301, body: '' }).healthy, false)
  assert.equal(classify({ status: 0, error: 'no response in 20s' }).reason, 'no response in 20s')
})

test('a JSON feed is a feed', () => {
  assert.equal(classify({ status: 200, contentType: 'application/json', body: '{"version":"https://jsonfeed.org/version/1.1"}' }).healthy, true)
})

test('the report names every broken feed and stays quiet when all are alive', () => {
  const healthy = formatReport([{ title: 'A', url: 'https://a', category: 'Tech', healthy: true }])
  assert.match(healthy, /All 1 starter feeds are alive/)
  assert.ok(!healthy.includes('|'), 'a clean report needs no table')

  const broken = formatReport([
    { title: 'A', url: 'https://a', category: 'Tech', healthy: true },
    { title: 'B', url: 'https://b', category: 'News', healthy: false, reason: 'HTTP 404' },
  ])
  assert.match(broken, /1 of 2 starter feeds are broken/)
  assert.ok(broken.includes('https://b') && broken.includes('HTTP 404'))
  assert.ok(!broken.includes('| [A]'), 'a healthy feed must not appear in the broken table')
})

test('readFeeds reads only the starters by default, and every one of them has a url', { skip }, () => {
  const starters = readFeeds(FEEDS_JSON)
  const all = readFeeds(FEEDS_JSON, { all: true })
  assert.ok(starters.length > 0 && starters.length <= all.length)
  assert.ok(starters.every((f) => f.starter === true))
  assert.ok(starters.every((f) => /^https:\/\//.test(f.url)))
})
