const CATEGORIES = {
  News: ['bbc', 'guardian', 'nytimes', 'independent', 'proceso', 'jornada', 'reforma'],
  Tech: ['9to5mac', 'verge', 'techcrunch', 'wired', 'techmeme', 'arstechnica', 'wwwhatsnew', 'hacker news', 'technology'],
  Business: ['economist', 'bloomberg', 'yahoo', 'financiero'],
  Science: ['science', 'new scientist', 'popsci', 'todayilearned'],
  Reddit: ['reddit', 'rhorror', 'rmexico', 'rworldnews'],
};

// The ad-block rule, applied as each feed's Miniflux "Block rules" (API field `blocklist_rules`).
//
// Do NOT shorten these words back into stems. Miniflux matches this regex anywhere in an entry's
// URL, title, author and tags (internal/reader/filter/filter.go), so a stem blocks every word that
// contains it. The previous rule, `(?i)(sponsor|sponsored|ad|promotion|deal|sale|discount|oferta)`,
// matched `ad` in *leader*, *roadmap*, *broadcast*, *ahead* — and in `jornada.com.mx` and
// `elpais.com/.../portada`, the URL of every article from two starter feeds — `deal` in *dealer* and
// `sale` in *wholesale*.
//
// Word boundaries alone are not enough either: "Leeds promoted to the Premier League", "State-sponsored
// hackers" and "Evento patrocinado por el gobierno" are news. So the rule matches only the shapes an ad
// label actually takes, in English and Spanish (roughly half the starter feeds are Spanish-language):
//   1. a field that STARTS with the label — "Sponsored: …", "[Sponsored] …", "Contenido patrocinado por…",
//      "Paid Post: …", an author or tag that is just "Advertisement";
//   2. the two words that only ever mean an ad, anywhere — advertorial, publirreportaje;
//   3. a URL path segment that is the label — /sponsored/…, /patrocinado-…
// Roadmap/01-reading-experience/adblock-rule-false-positives
const BLOCK_RULE =
  '(?i)^\\W*(sponsored|advertisement|patrocinado|contenido patrocinado|paid post)\\b' +
  '|\\b(advertorial|publirreportaje)\\b' +
  '|/(sponsored|patrocinado)[/-]';

// Rules this script itself has written in the past. A feed carrying one of these (or no rule at all)
// gets BLOCK_RULE; a feed carrying anything else was tuned by hand and is left alone.
const PREVIOUS_RULES = [
  '(?i)(sponsor|sponsored|ad|promotion|deal|sale|discount|oferta)',
  '(?i)\\b(sponsored|promoted|advertisement|advertorial|publirreportaje|patrocinado)\\b', // never deployed
];

/** The block rule a feed should carry, or null to leave a hand-tuned rule untouched. */
function desiredBlockRule(current) {
  const rule = (current || '').trim();
  if (!rule || rule === BLOCK_RULE || PREVIOUS_RULES.includes(rule)) return BLOCK_RULE;
  return null;
}

/**
 * Go's RE2 pattern as a JavaScript RegExp, for tests. Only the leading `(?i)` needs translating for the
 * patterns this script writes: `\b`, `\W` and `^` (no multiline) mean the same in both engines.
 */
function toRegExp(pattern) {
  const insensitive = pattern.startsWith('(?i)');
  return new RegExp(insensitive ? pattern.slice(4) : pattern, insensitive ? 'i' : '');
}

/** Mirrors filter.go's matchesEntryRegexRules: URL, title, author, or any tag. */
function isBlocked(pattern, entry) {
  const re = toRegExp(pattern);
  return [entry.url, entry.title, entry.author, ...(entry.tags || [])].some((v) => v && re.test(v));
}

/** The fields of a feed update that would actually change something, or null when nothing would. */
function feedChanges(feed, { categoryId, blockRule, rulesOnly = false }) {
  const changes = {};
  if (blockRule !== null && feed.blocklist_rules !== blockRule) changes.blocklist_rules = blockRule;
  if (!rulesOnly) {
    if (categoryId !== undefined && feed.category?.id !== categoryId) changes.category_id = categoryId;
    // Enabling fetch original content automatically to bypass soft paywalls
    if (!feed.crawler) changes.crawler = true;
  }
  return Object.keys(changes).length ? changes : null;
}

function parseArgs(argv) {
  const args = { dryRun: false, feedId: null, rulesOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--rules-only') args.rulesOnly = true;
    else if (argv[i] === '--feed') args.feedId = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]} (usage: [--dry-run] [--rules-only] [--feed <id>])`);
  }
  if (args.feedId !== null && !Number.isInteger(args.feedId)) throw new Error('--feed needs a numeric feed id');
  return args;
}

// --rules-only touches nothing but the block rule: no categories created or reassigned, crawler left as
// the reader set it. That is the mode for rolling out a new rule across feeds people have already sorted.
async function run({ dryRun, feedId, rulesOnly }) {
  const axios = require('axios'); // loaded here so the test can import the pure helpers without node_modules
  const MINIFLUX_URL = process.env.MINIFLUX_URL;
  const API_KEY = process.env.MINIFLUX_API_KEY;
  if (!MINIFLUX_URL || !API_KEY) {
    throw new Error('Missing MINIFLUX_URL or MINIFLUX_API_KEY environment variables.');
  }

  const api = axios.create({
    baseURL: `${MINIFLUX_URL}/v1`,
    headers: {
      'X-Auth-Token': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  // Feeds panfleto recommends are categorised by feeds.json, the one list the reader serves with its
  // static assets (panfleto-core internal/ui/static/bin/feeds.json). The keyword map below only
  // covers feeds that are not on that list.
  const suggestedCategory = new Map();
  const categoryMap = {};
  if (!rulesOnly) {
    const { data: suggested } = await axios.get(`${MINIFLUX_URL}/icon/feeds/feeds.json`);
    for (const f of suggested) suggestedCategory.set(f.url, f.category);

    console.log("Fetching existing categories...");
    const { data: existingCategories } = await api.get('/categories');
    for (const cat of existingCategories) {
      categoryMap[cat.title.toLowerCase()] = cat.id;
    }

    console.log("Creating missing categories...");
    for (const catName of new Set([...Object.keys(CATEGORIES), ...suggestedCategory.values()])) {
      if (!categoryMap[catName.toLowerCase()]) {
        console.log(`Creating category: ${catName}${dryRun ? ' (dry run, skipped)' : ''}`);
        if (!dryRun) {
          const { data: newCat } = await api.post('/categories', { title: catName });
          categoryMap[catName.toLowerCase()] = newCat.id;
        }
      }
    }
  }

  console.log("Fetching feeds...");
  const { data: allFeeds } = await api.get('/feeds');
  const feeds = feedId === null ? allFeeds : allFeeds.filter((f) => f.id === feedId);
  if (feedId !== null && feeds.length === 0) throw new Error(`No feed with id ${feedId}`);

  console.log(`Found ${feeds.length} feeds. Applying enhancements${dryRun ? ' (dry run)' : ''}...`);

  let changed = 0;
  const handTuned = [];
  const failed = [];
  for (const feed of feeds) {
    let targetCategoryId = categoryMap['news']; // default to news
    const titleLower = feed.title.toLowerCase();

    // Determine category
    if (suggestedCategory.has(feed.feed_url)) {
      targetCategoryId = categoryMap[suggestedCategory.get(feed.feed_url).toLowerCase()];
    } else for (const [catName, keywords] of Object.entries(CATEGORIES)) {
      if (keywords.some(kw => titleLower.includes(kw))) {
        targetCategoryId = categoryMap[catName.toLowerCase()];
        break;
      }
    }

    const blockRule = desiredBlockRule(feed.blocklist_rules);
    if (blockRule === null) handTuned.push(feed);
    const changes = feedChanges(feed, { categoryId: targetCategoryId, blockRule, rulesOnly });
    if (!changes) continue;

    console.log(`Updating Feed #${feed.id}: "${feed.title}"`);
    if (changes.category_id !== undefined) {
      console.log(` -> Category: ${Object.keys(categoryMap).find(k => categoryMap[k] === targetCategoryId)}`);
    }
    if (changes.blocklist_rules !== undefined) {
      console.log(` -> Block rule: ${JSON.stringify(feed.blocklist_rules || '')} => ${JSON.stringify(changes.blocklist_rules)}`);
    }
    if (changes.crawler) console.log(' -> Fetch original content: on');

    if (!dryRun) {
      try {
        await api.put(`/feeds/${feed.id}`, changes);
      } catch (error) {
        failed.push(feed);
        console.error(` !! feed #${feed.id} not updated:`, error.response ? error.response.data : error.message);
        continue;
      }
    }
    changed++;
  }

  for (const feed of handTuned) {
    console.log(`Left hand-tuned block rule alone on feed #${feed.id} "${feed.title}": ${JSON.stringify(feed.blocklist_rules)}`);
  }
  console.log(`✅ ${changed} of ${feeds.length} feeds ${dryRun ? 'would change' : 'changed'}; ${handTuned.length} hand-tuned block rules left alone; ${failed.length} failed.`);
  if (failed.length) throw new Error(`${failed.length} feed update(s) failed: ${failed.map((f) => `#${f.id}`).join(', ')}`);
}

module.exports = { BLOCK_RULE, PREVIOUS_RULES, desiredBlockRule, toRegExp, isBlocked, feedChanges, parseArgs };

if (require.main === module) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  run(args).catch((error) => {
    console.error("Error updating Miniflux:", error.response ? error.response.data : error.message);
    process.exit(1);
  });
}
