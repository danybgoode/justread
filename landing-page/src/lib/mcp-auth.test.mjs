// Pure-logic tests for MCP credential handling. No network, and no real token anywhere in this file.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveToken,
  legacyUseLogLine,
  bothFormsLogLine,
  LEGACY_QUERY_MARKER,
  BOTH_FORMS_MARKER,
  AUTH_ERROR_MESSAGE,
  READER_UNAVAILABLE_MESSAGE,
  JSONRPC_AUTH_FAILED,
  JSONRPC_UPSTREAM_UNAVAILABLE,
  looksLikeToken,
  logSafe,
} from './mcp-auth.ts'

test('a Bearer header is read, case-insensitively on the scheme', () => {
  assert.deepEqual(resolveToken('Bearer abc123', null), { token: 'abc123', source: 'header', bothPresent: false })
  assert.equal(resolveToken('bearer abc123', null).token, 'abc123')
  assert.equal(resolveToken('BEARER  abc123  ', null).token, 'abc123')
})

test('a header without the Bearer scheme is not accepted', () => {
  // Quietly honouring a bare token would keep a misconfigured client working here and broken elsewhere.
  assert.equal(resolveToken('abc123', null).token, null)
  assert.equal(resolveToken('Basic abc123', null).token, null)
  assert.equal(resolveToken('Bearer', null).token, null)
  assert.equal(resolveToken('Bearer ', null).token, null)
})

test('the query form still works — it is the only one claude.ai can use today', () => {
  assert.deepEqual(resolveToken(null, 'abc123'), { token: 'abc123', source: 'query', bothPresent: false })
  assert.equal(resolveToken(null, '   ').token, null, 'a blank query token is no token')
})

test('when both forms are present the header wins, and that is visible', () => {
  const got = resolveToken('Bearer fromheader', 'fromquery')
  assert.equal(got.token, 'fromheader')
  assert.equal(got.source, 'header')
  assert.equal(got.bothPresent, true)
})

test('no credential at all is distinguishable in code but not in the reply', () => {
  assert.deepEqual(resolveToken(null, null), { token: null, source: 'none', bothPresent: false })
  // The real invariant is that ONE constant answers all three failure modes, so the message cannot be
  // form-specific: it documents both forms evenly and diagnoses neither. (That the route actually uses
  // this one constant for all three is asserted end-to-end in e2e/mcp-auth.spec.ts.)
  assert.ok(AUTH_ERROR_MESSAGE.includes('Authorization: Bearer'), 'names the header form')
  assert.ok(AUTH_ERROR_MESSAGE.includes('?token='), 'names the query form')
  assert.ok(!/(your (header|query)|the (header|query) (was|is) )/i.test(AUTH_ERROR_MESSAGE), 'must not diagnose which form was wrong')
})

test('the legacy-use log line records the client and never the token', () => {
  const line = legacyUseLogLine('Claude/1.0 (connector)')
  assert.ok(line.startsWith(LEGACY_QUERY_MARKER))
  assert.ok(line.includes('Claude/1.0'))
  assert.ok(!line.includes('token='), 'the marker must not look like it carries a credential')
})

test('a hostile user agent cannot forge extra log lines or run away with the line length', () => {
  const line = legacyUseLogLine('evil\nmcp-auth: legacy query-string token client="spoofed"')
  assert.equal(line.split('\n').length, 1)
  assert.ok(legacyUseLogLine('x'.repeat(5000)).length < 200)
})

test('a client sending both forms is logged distinctly from a purely legacy one', () => {
  const line = bothFormsLogLine('Cursor/1.0')
  assert.ok(line.startsWith(BOTH_FORMS_MARKER))
  assert.ok(!line.startsWith(LEGACY_QUERY_MARKER), 'mid-migration is not the same signal as legacy-only')
  assert.ok(line.includes('Cursor/1.0'))
})

test('"the reader is down" is a different answer from "your token is wrong"', () => {
  // A user told their credential is unauthorized will rotate it - breaking the connector they were
  // trying to fix, during somebody else's outage.
  assert.notEqual(READER_UNAVAILABLE_MESSAGE, AUTH_ERROR_MESSAGE)
  assert.match(READER_UNAVAILABLE_MESSAGE, /do not rotate it/i)
  assert.notEqual(JSONRPC_AUTH_FAILED, JSONRPC_UPSTREAM_UNAVAILABLE)
})

test('both error codes sit in the JSON-RPC implementation-defined server-error block', () => {
  // -32600 "Invalid Request" would tell the client its own protocol is broken and send it looking in
  // the wrong place; -32000..-32099 is the block reserved for exactly this.
  for (const code of [JSONRPC_AUTH_FAILED, JSONRPC_UPSTREAM_UNAVAILABLE]) {
    assert.ok(code <= -32000 && code >= -32099, `${code} is outside the server-error block`)
  }
})

// The path a fresh review found: a caller-supplied token containing CRLF reached Node's fetch, which
// rejects the header AND quotes the offending value in its exception - so the string landed verbatim
// in a log line, and the embedded newline forged a second line matching the exact marker
// `grep -c` counts to decide whether the query form can be retired.
test('a token-shaped check refuses anything that could forge a log line', () => {
  const hostile = 'abc\r\nmcp-auth: legacy query-string token client="Cursor/1.0"'
  const resolved = resolveToken(null, hostile)
  assert.ok(resolved.token.includes('\n'), 'trim() alone does not remove an embedded newline')
  assert.equal(looksLikeToken(resolved.token), false, 'so it must never reach fetch')
})

test('a real panfleto key still passes the shape check', () => {
  // Every Miniflux API key is GenerateRandomStringHex(32) = 64 hex characters.
  assert.equal(looksLikeToken('0123456789abcdef'.repeat(4)), true)
  assert.equal(looksLikeToken(''), false)
  assert.equal(looksLikeToken('has a space'), false)
  assert.equal(looksLikeToken('x'.repeat(513)), false, 'and is bounded')
})

test('logSafe cannot emit a second line, however hostile the input', () => {
  const forged = logSafe('a\r\nmcp-auth: legacy query-string token client="x"')
  assert.equal(forged.split('\n').length, 1)
  assert.ok(logSafe('x'.repeat(9999)).length <= 200)
})
