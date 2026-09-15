// The ad-block rule's table test. The pattern is the whole feature, so it is asserted in both
// directions: what it must block, and the real headlines the old stem list silently dropped.
// Roadmap/01-reading-experience/adblock-rule-false-positives
import { test } from 'node:test';
import assert from 'node:assert/strict';
import enhance from './enhance_miniflux.js';

const { BLOCK_RULE, PREVIOUS_RULES, desiredBlockRule, isBlocked, feedChanges, parseArgs } = enhance;
const [OLD_RULE] = PREVIOUS_RULES;
const title = (t) => ({ title: t, url: 'https://example.com/story', author: '', tags: [] });

const BLOCKED = [
  'Sponsored: the best laptops of 2026',
  '[Sponsored] Five reasons to switch banks',
  'Contenido patrocinado por Banco X',
  'Advertisement',
  'PUBLIRREPORTAJE: conoce el nuevo fraccionamiento',
  'Why this mattress changed my life (advertorial)',
  'Paid Post: How cloud computing is changing retail',
];

const NOT_BLOCKED = [
  'Party leadership contest narrows to two',
  'The 2027 roadmap',
  'Broadcast rights sold',
  'Ahead of the vote',
  'The dealer said no',
  'Wholesale prices fall',
  'Trinidad and Tobago election results',
  'Salem witch trials museum reopens',
  'Idealism in foreign policy',
  'Sponsorship deal collapses', // a news story about sponsorship, not a sponsored post
  'Promotion for the club after a 3-1 win',
  // A word boundary is not enough: these are news about sponsorship and promotion, not ads.
  'State-sponsored hackers breach utility',
  'Leeds promoted to the Premier League',
  'What counts as sponsored content? FTC rules',
  'Evento patrocinado por el gobierno',
  'Advertisements that changed history',
];

for (const t of BLOCKED) {
  test(`blocks: ${t}`, () => assert.equal(isBlocked(BLOCK_RULE, title(t)), true));
}

for (const t of NOT_BLOCKED) {
  test(`does not block: ${t}`, () => assert.equal(isBlocked(BLOCK_RULE, title(t)), false));
}

test('the old stem list blocked real headlines — the regression this rule exists to prevent', () => {
  for (const t of NOT_BLOCKED.slice(0, 6)) assert.equal(isBlocked(OLD_RULE, title(t)), true, t);
});

test('matches the URL as well as the title, like filter.go — a whole feed is not collateral', () => {
  const jornada = { title: 'Senado aprueba reforma', url: 'https://www.jornada.com.mx/2026/09/15/politica/003n1pol', author: '', tags: [] };
  assert.equal(isBlocked(OLD_RULE, jornada), true, 'old rule: "jornada" contains "ad"');
  assert.equal(isBlocked(BLOCK_RULE, jornada), false);
  assert.equal(isBlocked(BLOCK_RULE, { ...jornada, url: 'https://example.com/sponsored/story' }), true);
  assert.equal(isBlocked(BLOCK_RULE, { ...jornada, url: 'https://example.com/news/state-sponsored-hackers' }), false);
  assert.equal(isBlocked(BLOCK_RULE, { ...jornada, tags: ['Patrocinado'] }), true);
  assert.equal(isBlocked(BLOCK_RULE, { ...jornada, author: 'Advertisement Feature' }), true);
});

test('a feed with no rule, or a rule this script wrote before, gets the new rule', () => {
  assert.equal(desiredBlockRule(''), BLOCK_RULE);
  assert.equal(desiredBlockRule(undefined), BLOCK_RULE);
  assert.equal(desiredBlockRule(OLD_RULE), BLOCK_RULE);
  assert.equal(desiredBlockRule(BLOCK_RULE), BLOCK_RULE);
  assert.equal(desiredBlockRule(`${OLD_RULE}\n`), BLOCK_RULE, 'trailing whitespace is not hand-tuning');
});

test('a hand-tuned rule is never clobbered', () => {
  assert.equal(desiredBlockRule('(?i)crossword'), null);
});

test('writes blocklist_rules — the field Miniflux reads, not the block_rules it silently ignores', () => {
  const feed = { category: { id: 1 }, blocklist_rules: '', crawler: true };
  assert.deepEqual(feedChanges(feed, { categoryId: 1, blockRule: BLOCK_RULE }), { blocklist_rules: BLOCK_RULE });
});

test('idempotent: a feed already in the desired state produces no update', () => {
  const feed = { category: { id: 3 }, blocklist_rules: BLOCK_RULE, crawler: true };
  assert.equal(feedChanges(feed, { categoryId: 3, blockRule: desiredBlockRule(feed.blocklist_rules) }), null);
});

test('a hand-tuned feed still gets its category and crawler, but not a rule', () => {
  const feed = { category: { id: 1 }, blocklist_rules: '(?i)crossword', crawler: false };
  assert.deepEqual(feedChanges(feed, { categoryId: 2, blockRule: null }), { category_id: 2, crawler: true });
});

test('--rules-only never moves a feed or flips its crawler', () => {
  const feed = { category: { id: 7 }, blocklist_rules: OLD_RULE, crawler: false };
  assert.deepEqual(feedChanges(feed, { categoryId: 1, blockRule: BLOCK_RULE, rulesOnly: true }), { blocklist_rules: BLOCK_RULE });
  assert.equal(feedChanges({ ...feed, blocklist_rules: BLOCK_RULE }, { categoryId: undefined, blockRule: BLOCK_RULE, rulesOnly: true }), null);
});

test('arguments', () => {
  assert.deepEqual(parseArgs([]), { dryRun: false, feedId: null, rulesOnly: false });
  assert.deepEqual(parseArgs(['--dry-run', '--rules-only', '--feed', '42']), { dryRun: true, feedId: 42, rulesOnly: true });
  assert.throws(() => parseArgs(['--feed', 'bbc']));
  assert.throws(() => parseArgs(['--all']));
});
