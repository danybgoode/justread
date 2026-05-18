const axios = require('axios');

const MINIFLUX_URL = process.env.MINIFLUX_URL || 'https://miniflux-rss-app.onrender.com';
const API_KEY = process.env.MINIFLUX_API_KEY || '2b68a88063d70b922d8369a06c0584fc2ec0d4b3baa456572e01a9147a441693';

const api = axios.create({
  baseURL: `${MINIFLUX_URL}/v1`,
  headers: {
    'X-Auth-Token': API_KEY,
    'Content-Type': 'application/json',
  },
});

async function run() {
  const { data } = await api.get('/entries?status=unread&limit=100');
  const entries = data.entries;
  for (const entry of entries) {
    if (entry.content.includes('archive.ph')) {
      console.log(`Entry: ${entry.title} has archive.ph`);
      console.log("Content ending:", entry.content.slice(-200));
    }
  }
}
run();
