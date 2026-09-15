import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findContentWrites, scan } from './content-write-guard.mjs';

const fixture = readFileSync(new URL('./fixtures/archive_appender.js', import.meta.url), 'utf8');

test("catches the deleted archive appender's exact write", () => {
  const found = findContentWrites(fixture);
  assert.equal(found.length, 1);
  assert.match(found[0].snippet, /api\.put\(`\/entries\/\$\{entry\.id\}`/);
});

test('catches fetch-style and shorthand writes', () => {
  const fetchPut = `await fetch(\`\${url}/v1/entries/\${id}\`, { method: 'PATCH', body: JSON.stringify({ content }) });`;
  assert.equal(findContentWrites(fetchPut).length, 1);
  const quoted = `client.patch('/v1/entries/' + id, { "content": html })`;
  assert.equal(findContentWrites(quoted).length, 1);
});

test('allows feed updates, reads, and writes to entries without a content field', () => {
  assert.deepEqual(findContentWrites(`await api.put(\`/feeds/\${feed.id}\`, { blocklist_rules: rule, crawler: true });`), []);
  assert.deepEqual(findContentWrites(`const { data } = await api.get('/entries?status=unread'); console.log(data.entries[0].content);`), []);
  assert.deepEqual(findContentWrites(`await api.put('/entries', { entry_ids: ids, status: 'read' });`), []);
});

test('scan walks a tree, skips fixtures/ and test files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-guard-'));
  mkdirSync(join(dir, 'fixtures'));
  mkdirSync(join(dir, 'lib'));
  writeFileSync(join(dir, 'fixtures', 'old.js'), fixture);
  writeFileSync(join(dir, 'x.test.mjs'), fixture);
  assert.deepEqual(scan(dir), []);
  writeFileSync(join(dir, 'lib', 'sneaky.mjs'), fixture);
  assert.equal(scan(dir).length, 1);
});

test('the real scripts/ tree is clean', () => {
  assert.deepEqual(scan(new URL('.', import.meta.url).pathname), []);
});
