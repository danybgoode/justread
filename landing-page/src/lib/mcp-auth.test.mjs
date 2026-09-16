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
  assert.ok(!/query|header/i.test(AUTH_ERROR_MESSAGE.split('Send your')[0]), 'the reason must not name a form')
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
