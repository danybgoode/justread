// Pure-logic test for the signup summary. Node strips the .ts types; nothing here loads Next.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatOnboardingSummary } from './onboarding-summary.ts'

test('a partial provision is counted and the failures are named', () => {
  const got = formatOnboardingSummary('reader@example.com', [
    { url: 'https://a.example/feed' },
    { url: 'https://b.example/feed', reason: 'HTTP 404' },
    { url: 'https://c.example/feed' },
    { url: 'https://d.example/feed', reason: 'timed out' },
  ])

  for (const want of ['reader@example.com', '2/4', '2 failed', 'https://b.example/feed', 'https://d.example/feed']) {
    assert.ok(got.includes(want), `missing ${want} in:\n${got}`)
  }
  assert.ok(!got.includes('https://a.example/feed'), `named a feed that succeeded:\n${got}`)
})

test('a clean run says so and never mentions failures', () => {
  const got = formatOnboardingSummary('reader@example.com', [{ url: 'https://a.example/feed' }, { url: 'https://b.example/feed' }])
  assert.ok(got.includes('all 2 starter feeds'), got)
  assert.ok(!got.includes('failed'), got)
})

test('zero feeds attempted is an anomaly, not a success', () => {
  const got = formatOnboardingSummary('reader@example.com', [])
  assert.ok(got.includes('NO starter feeds were attempted'), got)
})

// The two signup paths must produce the same shape, or the channel needs a decoder ring.
test('the wording matches the Go half of the pair', () => {
  const got = formatOnboardingSummary('x', [{ url: 'u1' }, { url: 'u2', reason: 'why' }])
  assert.equal(got, '⚠️ New reader x joined Panfleto — 1/2 starter feeds added, 1 failed:\nu2')
})
