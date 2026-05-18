const axios = require('axios');

const MINIFLUX_URL = process.env.MINIFLUX_URL;
const API_KEY = process.env.MINIFLUX_API_KEY;

if (!MINIFLUX_URL || !API_KEY) {
  console.error("Missing MINIFLUX_URL or MINIFLUX_API_KEY environment variables.");
  process.exit(1);
}

const api = axios.create({
  baseURL: `${MINIFLUX_URL}/v1`,
  headers: {
    'X-Auth-Token': API_KEY,
    'Content-Type': 'application/json',
  },
});

const CATEGORIES = {
  News: ['bbc', 'guardian', 'nytimes', 'independent', 'proceso', 'jornada', 'reforma'],
  Tech: ['9to5mac', 'verge', 'techcrunch', 'wired', 'techmeme', 'arstechnica', 'wwwhatsnew', 'hacker news', 'technology'],
  Business: ['economist', 'bloomberg', 'yahoo', 'financiero'],
  Science: ['science', 'new scientist', 'popsci', 'todayilearned'],
  Reddit: ['reddit', 'rhorror', 'rmexico', 'rworldnews'],
};

// Regex to block ads
const BLOCK_RULE = "(?i)(sponsor|sponsored|ad|promotion|deal|sale|discount|oferta)";

async function run() {
  try {
    console.log("Fetching existing categories...");
    const { data: existingCategories } = await api.get('/categories');
    const categoryMap = {};
    for (const cat of existingCategories) {
      categoryMap[cat.title.toLowerCase()] = cat.id;
    }

    console.log("Creating missing categories...");
    for (const catName of Object.keys(CATEGORIES)) {
      if (!categoryMap[catName.toLowerCase()]) {
        console.log(`Creating category: ${catName}`);
        const { data: newCat } = await api.post('/categories', { title: catName });
        categoryMap[catName.toLowerCase()] = newCat.id;
      }
    }

    console.log("Fetching feeds...");
    const { data: feeds } = await api.get('/feeds');
    
    console.log(`Found ${feeds.length} feeds. Applying enhancements...`);
    
    for (const feed of feeds) {
      let targetCategoryId = categoryMap['news']; // default to news
      const titleLower = feed.title.toLowerCase();
      
      // Determine category
      for (const [catName, keywords] of Object.entries(CATEGORIES)) {
        if (keywords.some(kw => titleLower.includes(kw))) {
          targetCategoryId = categoryMap[catName.toLowerCase()];
          break;
        }
      }

      console.log(`Updating Feed: "${feed.title}"`);
      console.log(` -> Category: ${Object.keys(categoryMap).find(k => categoryMap[k] === targetCategoryId)}`);
      console.log(` -> Applying Ad-Block Rule`);
      
      // Update the feed
      await api.put(`/feeds/${feed.id}`, {
        category_id: targetCategoryId,
        block_rules: BLOCK_RULE,
        // Enabling fetch original content automatically to bypass soft paywalls
        crawler: true
      });
    }

    console.log("✅ All feeds categorized and ad-block rules applied successfully.");
    console.log("Original content fetching (crawler) enabled for all feeds to help bypass soft paywalls natively.");

  } catch (error) {
    console.error("Error updating Miniflux:", error.response ? error.response.data : error.message);
  }
}

run();
