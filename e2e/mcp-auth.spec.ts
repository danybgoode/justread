import { expect, test } from '@playwright/test'

/**
 * MCP credential handling — anonymous, API-level, no real token anywhere in this file.
 *
 * panfleto's MCP server lives on the LANDING origin (panfleto.win), not the reader's
 * (app.panfleto.win), so every request here names its origin explicitly rather than using baseURL.
 *
 * What these assert is the property that makes rotation mean anything: an unauthenticated caller gets
 * nothing — not the tool list, not a hint about which credential form was wrong. Before
 * Roadmap/03-agent-surface/mcp-token-handling, `initialize` and `tools/list` answered happily to any
 * string at all, so a revoked token still looked like it worked until the first tool call.
 *
 * Deliberately NOT tested here: that a VALID token works. That needs a real credential, and
 * AGENTS.md rule 4 says one never goes in a fixture. It is the product owner's smoke step.
 */
const MCP_URL = process.env.PANFLETO_MCP_URL ?? 'https://panfleto.win/api/mcp'

const rpc = (method: string, id: number | string = 1) => ({ jsonrpc: '2.0', id, method })

/**
 * `JSONRPC_AUTH_FAILED` from landing-page/src/lib/mcp-auth.ts, repeated here rather than imported
 * across project boundaries. Asserting the exact code matters: if the reader is simply unreachable the
 * endpoint answers -32002 with a different message, and a spec that only checked "some error came
 * back" would go green during an outage without ever proving a token was checked.
 */
const AUTH_FAILED = -32001
const UPSTREAM_UNAVAILABLE = -32002

test('a request with no credential is rejected', async ({ request }) => {
  const res = await request.post(MCP_URL, { data: rpc('initialize') })
  // MCP puts the error in the body with a 200; the assertion is on the envelope, not the status.
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.error, JSON.stringify(body)).toBeTruthy()
  expect(body.error.code, 'a missing credential is an auth failure, not an outage').toBe(AUTH_FAILED)
  expect(body.result).toBeUndefined()
})

test('a garbage token in the query string is rejected, including for initialize', async ({ request }) => {
  const res = await request.post(`${MCP_URL}?token=not-a-real-token`, { data: rpc('initialize') })
  const body = await res.json()
  expect(body.error, JSON.stringify(body)).toBeTruthy()
  expect(body.error.code, 'must be an auth failure — not the reader being down').toBe(AUTH_FAILED)
  expect(body.result).toBeUndefined()
})

test('a garbage Bearer header is rejected too, and tools stay hidden', async ({ request }) => {
  const res = await request.post(MCP_URL, {
    headers: { Authorization: 'Bearer not-a-real-token' },
    data: rpc('tools/list'),
  })
  const body = await res.json()
  expect(body.error, JSON.stringify(body)).toBeTruthy()
  expect(body.error.code).toBe(AUTH_FAILED)
  expect(JSON.stringify(body)).not.toContain('get_unread_entries')
})

test('a rejection echoes the request id, so the client can match it to its request', async ({ request }) => {
  // An MCP client correlates responses by id. An error carrying `id: null` is a response the client
  // drops on the floor, so the user sees a hang instead of the reason their token was refused.
  const res = await request.post(`${MCP_URL}?token=not-a-real-token`, { data: rpc('initialize', 'req-42') })
  const body = await res.json()
  expect(body.id).toBe('req-42')
  expect(body.error).toBeTruthy()
})

test('an auth failure uses a server-error code, not "Invalid Request"', async ({ request }) => {
  // -32600 would tell the client its own payload was malformed and send it looking in the wrong place.
  const res = await request.post(`${MCP_URL}?token=not-a-real-token`, { data: rpc('initialize') })
  const { error } = await res.json()
  expect(error.code).toBeLessThanOrEqual(-32000)
  expect(error.code).toBeGreaterThanOrEqual(-32099)
  expect(error.code).not.toBe(UPSTREAM_UNAVAILABLE)
})

test('the rejection does not reveal which credential form was wrong', async ({ request }) => {
  const [noneRes, queryRes, headerRes] = await Promise.all([
    request.post(MCP_URL, { data: rpc('initialize') }),
    request.post(`${MCP_URL}?token=not-a-real-token`, { data: rpc('initialize') }),
    request.post(MCP_URL, { headers: { Authorization: 'Bearer not-a-real-token' }, data: rpc('initialize') }),
  ])
  const [none, query, header] = await Promise.all([noneRes.json(), queryRes.json(), headerRes.json()])
  expect(query.error.message).toBe(none.error.message)
  expect(header.error.message).toBe(none.error.message)
})

test('a malformed Authorization header is not quietly treated as a bare token', async ({ request }) => {
  // Honouring `Authorization: <token>` would keep a misconfigured client working here and broken
  // against every other MCP server.
  const res = await request.post(MCP_URL, {
    headers: { Authorization: 'not-a-real-token' },
    data: rpc('initialize'),
  })
  const { error } = await res.json()
  expect(error).toBeTruthy()
  expect(error.code).toBe(AUTH_FAILED)
})

test('a token carrying a newline is refused as invalid, not reported as an outage', async ({ request }) => {
  // It must never reach the upstream fetch: Node rejects such a header and quotes the value in its
  // exception, which would write a caller-controlled string — and a forged second log line — into the
  // log that the legacy-use count is read from.
  const forged = encodeURIComponent('abc\r\nmcp-auth: legacy query-string token client="forged"')
  const res = await request.post(`${MCP_URL}?token=${forged}`, { data: rpc('initialize') })
  const { error } = await res.json()
  expect(error.code, 'a malformed token is invalid, not "the reader is down"').toBe(AUTH_FAILED)
})

test('the GET landing document recommends the header form and keeps the query form documented', async ({ request }) => {
  const res = await request.get(MCP_URL)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.usage.recommended.header).toContain('Authorization: Bearer')
  expect(body.usage.also_supported.url).toContain('?token=')
  // No removal date: claude.ai's custom-connector request headers are a limited beta with an open bug,
  // and it is the client the settings panel links to.
  expect(JSON.stringify(body.usage.also_supported)).toContain('no removal date')
})
