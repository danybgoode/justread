#!/usr/bin/env node
// content-write-guard.mjs — AGENTS.md rule 2, enforced: nothing under scripts/ may write entries.content.
//
// The reader owns article content. For months `scripts/archive_appender.js` fetched unread entries and
// PUT `content + appendHtml` back over the Miniflux API every three hours — an irreversible,
// unattributable edit to the reader's own data (Roadmap/01-reading-experience/paywall-rail-single-source).
// This check fails when a script issues a PUT or PATCH to an `/entries` endpoint with a `content` field
// nearby. It is a deliberately simple text heuristic: a false positive is loud and cheap to fix, a
// false negative is the thing it exists to prevent. Presentation belongs in a template, enrichment in
// the processor — never in a script.
//
// Usage: node scripts/content-write-guard.mjs [dir]   (default: scripts/; exits 1 on a violation)

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = /\.(?:[cm]?js|[cm]?ts)$/;
const SKIP_DIRS = new Set(['node_modules', 'fixtures']);
/** How far either side of a PUT/PATCH to look for the endpoint and the field (a call spans lines). */
const WINDOW = 400;

const WRITE_METHOD = /\.(?:put|patch)\s*\(|\bmethod\s*:\s*['"`](?:PUT|PATCH)['"`]|-X\s*(?:PUT|PATCH)\b/gi;
const ENTRIES_ENDPOINT = /\/entries\b/;
// `content: x`, `"content": x`, `'content': x`, or the `{ content }` / `{ id, content }` shorthand.
const CONTENT_FIELD = /["'`]?\bcontent["'`]?\s*:|[{,]\s*content\s*[,}]/;

/** Violations in one file's source text: `{ line, snippet }` per offending write. */
export function findContentWrites(source) {
  const violations = [];
  for (const m of source.matchAll(WRITE_METHOD)) {
    const around = source.slice(Math.max(0, m.index - WINDOW), m.index + WINDOW);
    if (ENTRIES_ENDPOINT.test(around) && CONTENT_FIELD.test(around)) {
      const line = source.slice(0, m.index).split('\n').length;
      violations.push({ line, snippet: source.split('\n')[line - 1].trim() });
    }
  }
  return violations;
}

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* sourceFiles(join(dir, entry.name));
    } else if (SOURCE.test(entry.name) && !entry.name.includes('.test.')) {
      yield join(dir, entry.name);
    }
  }
}

export function scan(dir) {
  const found = [];
  for (const file of sourceFiles(dir)) {
    for (const v of findContentWrites(readFileSync(file, 'utf8'))) found.push({ file, ...v });
  }
  return found;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)));
  const found = scan(dir);
  for (const v of found) {
    console.error(`${relative(process.cwd(), v.file)}:${v.line}: writes entries.content — ${v.snippet}`);
  }
  if (found.length) {
    console.error(
      '\ncontent-write-guard: scripts must not write article content (AGENTS.md rule 2). ' +
        'Presentation belongs in a template, enrichment in internal/reader/processor/.',
    );
    process.exit(1);
  }
  console.log('content-write-guard: no script writes entries.content.');
}
