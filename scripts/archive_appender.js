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

// Feeds that frequently have hard paywalls where native Miniflux 'fetch original content' might fail
const PAYWALLED_FEEDS = ['economist', 'bloomberg', 'nytimes', 'wired', 'the atlantic', 'business'];

async function run() {
  try {
    console.log("Fetching unread entries...");
    const { data } = await api.get('/entries?status=unread&limit=100');
    const entries = data.entries;
    
    let updatedCount = 0;

    for (const entry of entries) {
      const feedTitle = entry.feed.title.toLowerCase();
      
      // Check if it's from a notoriously paywalled feed
      const isPaywalled = PAYWALLED_FEEDS.some(kw => feedTitle.includes(kw));
      
      if (isPaywalled) {
        // Ensure we haven't already appended the link
        if (!entry.content.includes("archive.ph")) {
          const archiveUrl = `https://archive.ph/newest/${entry.url}`;
          const appendHtml = `<hr/><p><strong>Paywall Bypass:</strong> <a href="${archiveUrl}" target="_blank" rel="noopener noreferrer">Read on Archive.ph</a></p>`;
          
          const newContent = entry.content + appendHtml;

          console.log(`Appending archive link to: ${entry.title} (${feedTitle})`);
          
          await api.put(`/entries/${entry.id}`, {
            content: newContent
          });
          
          updatedCount++;
        }
      }
    }

    console.log(`✅ Process complete. Appended archive.ph links to ${updatedCount} paywalled entries.`);

  } catch (error) {
    console.error("Error appending archive links:", error.response ? error.response.data : error.message);
  }
}

run();
