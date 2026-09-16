#!/usr/bin/env node
// starter-feed-health.mjs — fetch every starter feed in feeds.json and say which ones are broken.
//
// Why this exists: panfleto's onboarding promise is "no empty screen" — a new account opens onto the
// starter feeds with articles in them. Until now a starter feed that died was discovered by a new
// user landing on an empty category, and the fix arrived as a commit called "Replace three starter
// feeds that no longer work." This is the check that gets there first.
// (Roadmap/02-onboarding-and-signup/onboarding-provisioning-reliability, story 1.2.)
//
// The list is feeds.json — panfleto-core/internal/ui/static/bin/feeds.json — the single source the Go
// onboarding, the subscribe page and the landing-page signup all read (resync S3). By default only
// `starter: true` feeds are checked, since those are the ones a signup subscribes you to.
//
// Usage:
//   node scripts/starter-feed-health.mjs                 # human-readable report; exit 1 if any feed is unhealthy
//   node scripts/starter-feed-health.mjs --all           # every feed in feeds.json, not just the starters
//   node scripts/starter-feed-health.mjs --json          # machine-readable, for a workflow
//   node scripts/starter-feed-health.mjs --telegram      # also ping TELEGRAM_BOT_TOKEN's chat (host-side)
//   node scripts/starter-feed-health.mjs --timeout 30    # seconds per feed (default 20)
//
// D3: the scheduled run is .github/workflows/starter-feed-health.yml, which opens/updates a GitHub
// issue rather than pinging Telegram — a CI Telegram ping would mean putting the bot token in a
// second credential store, and AGENTS.md rule 4 keeps that on the host. --telegram is for the host.
//
// Zero npm deps. Node 18+.

import { existsSync, readFileSync, writeSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const FEEDS_JSON = join(ROOT, 'panfleto-core/internal/ui/static/bin/feeds.json')

const FEED_CONTENT_TYPES = ['xml', 'rss', 'atom', 'json']
const FEED_ROOTS = ['<rss', '<feed', '<rdf:rdf', '{']

/**
 * The root element, with everything that legally precedes it removed: a BOM, whitespace, the XML
 * declaration and any other processing instruction, comments, and a DOCTYPE. Getting this wrong is
 * the easy way to build a checker that calls every healthy feed broken - the first draft did exactly
 * that, because real feeds start `<?xml version="1.0"?>`, not `<rss`.
 */
export function feedRoot(body) {
  let head = String(body).replace(/^\uFEFF/, '')
  for (;;) {
    const before = head
    head = head.trimStart()
    if (head.startsWith('<?')) head = head.slice(head.indexOf('?>') + 2)
    else if (head.startsWith('<!--')) head = head.slice(head.indexOf('-->') + 3)
    else if (/^<!doctype/i.test(head)) head = head.slice(head.indexOf('>') + 1)
    if (head === before) break
  }
  return head.trimStart().slice(0, 400)
}

/**
 * Decide whether one fetched response is a usable feed. Pure, so the interesting cases (a 200 that is
 * really an HTML error page, a feed served as text/plain) can be tested without the network — they
 * are exactly the ones a naive `res.ok` check gets wrong.
 */
export function classify({ status, contentType = '', body = '', error = null }) {
  if (error) return { healthy: false, reason: error }
  if (status >= 400 || status === 0) return { healthy: false, reason: `HTTP ${status}` }
  if (status >= 300) return { healthy: false, reason: `HTTP ${status} (unresolved redirect)` }

  const type = contentType.toLowerCase().split(';')[0].trim()
  const looksLikeFeedType = FEED_CONTENT_TYPES.some((t) => type.includes(t))
  const head = feedRoot(body)
  const lowered = head.toLowerCase()
  const looksLikeFeedBody = FEED_ROOTS.some((r) => lowered.startsWith(r))

  if (!looksLikeFeedBody) {
    // A parked domain or a login wall answers 200 with HTML. That is the failure this catches.
    return { healthy: false, reason: `not a feed (content-type ${type || 'unset'}, body starts "${head.slice(0, 60).replace(/\s+/g, ' ').trim()}")` }
  }
  if (!looksLikeFeedType) {
    // Parseable, just mislabelled. Miniflux copes; say so without failing the run.
    return { healthy: true, warning: `served as ${type || 'no content-type'}` }
  }
  return { healthy: true }
}

export function readFeeds(path = FEEDS_JSON, { all = false } = {}) {
  if (!existsSync(path)) {
    throw new Error(`feeds.json not found at ${path} — is the panfleto-core submodule checked out?`)
  }
  const feeds = JSON.parse(readFileSync(path, 'utf8'))
  return all ? feeds : feeds.filter((f) => f.starter)
}

async function check(feed, timeoutMs) {
  const started = Date.now()
  try {
    const res = await fetch(feed.url, {
      redirect: 'follow',
      headers: { 'user-agent': 'panfleto-starter-feed-health/1.0 (+https://panfleto.win)' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const body = (await res.text()).slice(0, 2000)
    return { ...feed, ms: Date.now() - started, status: res.status, ...classify({ status: res.status, contentType: res.headers.get('content-type') ?? '', body }) }
  } catch (e) {
    const reason = e?.name === 'TimeoutError' ? `no response in ${timeoutMs / 1000}s` : String(e?.message ?? e)
    return { ...feed, ms: Date.now() - started, status: 0, ...classify({ status: 0, error: reason }) }
  }
}

/** The report body, as markdown. Pure, so the workflow's issue text is testable. */
export function formatReport(checked) {
  const bad = checked.filter((c) => !c.healthy)
  const warned = checked.filter((c) => c.healthy && c.warning)
  const lines = []
  lines.push(bad.length === 0
    ? `✅ All ${checked.length} starter feeds are alive.`
    : `⚠️ ${bad.length} of ${checked.length} starter feeds are broken.`)
  if (bad.length) {
    lines.push('', '| Feed | Category | Why |', '|---|---|---|')
    for (const f of bad) lines.push(`| [${f.title}](${f.url}) | ${f.category} | ${f.reason} |`)
    lines.push('', 'A broken starter feed lands in every new signup as an empty category. Replace it in',
      '`panfleto-core/internal/ui/static/bin/feeds.json` — the single list the Go onboarding, the subscribe',
      'page and `/api/register` all read.')
  }
  if (warned.length) {
    lines.push('', 'Parseable but mislabelled (not a failure):')
    for (const f of warned) lines.push(`- ${f.title} — ${f.warning}`)
  }
  return lines.join('\n')
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set — skipping the Telegram report.')
    return
  }
  const chatId = process.env.PANFLETO_TELEGRAM_CHAT_ID?.trim() || '1517743559'
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    // The token is in the URL; never print the raw error (AGENTS.md rule 4).
    console.error('Failed to send the Telegram report:', String(e?.message ?? e).replaceAll(token, '<redacted>'))
  }
}

async function main(argv) {
  const all = argv.includes('--all')
  const asJson = argv.includes('--json')
  const telegram = argv.includes('--telegram')
  const ti = argv.indexOf('--timeout')
  const timeoutMs = (ti === -1 ? 20 : Number(argv[ti + 1] || 20)) * 1000

  const feeds = readFeeds(FEEDS_JSON, { all })
  const checked = []
  // Sequential on purpose: this is a courtesy crawl of other people's servers, not a load test.
  for (const feed of feeds) checked.push(await check(feed, timeoutMs))

  const report = formatReport(checked)
  const out = asJson
    ? JSON.stringify({ checked, healthy: checked.every((c) => c.healthy), report }, null, 2)
    : [report, '', ...checked.map((c) => `${c.healthy ? '  ok' : 'FAIL'}  ${String(c.ms).padStart(5)}ms  ${c.url}${c.healthy ? (c.warning ? `  (${c.warning})` : '') : `  — ${c.reason}`}`)].join('\n')

  // An async stdout write can be truncated down a pipe; write synchronously (LEARNINGS, Tooling gotchas).
  writeSync(1, out + '\n')
  if (telegram) await sendTelegram(report)
  return checked.every((c) => c.healthy) ? 0 : 1
}

// Guard main() so the co-located test file can import the pure helpers without running a crawl.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code })
}
