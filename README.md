# Miniflux Deployment & Enhancements

This directory contains the deployment configurations and scripts for hosting a Miniflux personal RSS service permanently using the free tiers of Render and Neon PostgreSQL. It also contains scripts to programmatically enhance your feeds.

## Public Deployment
- **URL:** [https://miniflux-rss-app.onrender.com](https://miniflux-rss-app.onrender.com)
- **Admin Username:** `admin`
- **Admin Password:** `X2PVcPa2Q7SW3TMQ` (Please change this after your first login)

## Enhancements Implemented
We have implemented several quality-of-life enhancements via the Miniflux API:

1. **Auto-Categorization:** 
   Feeds are automatically mapped to logical categories (News, Tech, Business, Science, Reddit) using `scripts/enhance_miniflux.js`.
2. **Ad-Blocking:**
   A global regex block rule `(?i)(sponsor|sponsored|ad|promotion|deal|sale|discount|oferta)` is applied to all feeds to keep your Unread tab clean.
3. **Paywall Bypass & Archive.is Fallback:**
   - Soft paywalls: The native "Fetch original content" option is enabled automatically for all feeds.
   - Hard paywalls: The script `scripts/archive_appender.js` searches for notorious paywall feeds (NYT, Economist, Bloomberg, etc.) and injects a clickable `Archive.ph` link at the bottom of the article body. This preserves the original URL at the top but gives you a quick fallback link if the native fetch fails.

### Running the Enhancement Scripts
To run the categorizer/ad-blocker again (if you add new feeds):
```bash
node scripts/enhance_miniflux.js
```

To run the Archive.is link injector for new unread articles:
```bash
node scripts/archive_appender.js
```
*(Note: Because you are on a free tier, you can run this script manually from your computer whenever you open Miniflux and hit a paywall, or you can set it up on a free GitHub Action cron job to run hourly.)*

## Architecture Overview
- **Hosting:** Render Web Service (Free Tier)
- **Database:** Neon Serverless PostgreSQL (Free Tier)
- **Image:** `miniflux/miniflux:latest` (Official Upstream Docker Image)

## Required Environment Variables

The Render deployment depends on the following environment variables. If you ever need to recreate or modify the deployment, ensure these are set:

- `DATABASE_URL`: Connection string from your Neon Dashboard. Note that `sslmode=require` is appended to ensure a secure connection.
- `RUN_MIGRATIONS`: Set to `1` so Miniflux automatically applies database schemas when booting.
- `CREATE_ADMIN`: Set to `1` so it creates an admin user if none exists.
- `ADMIN_USERNAME`: Your chosen admin username.
- `ADMIN_PASSWORD`: Your chosen admin password.
- `PORT`: Set to `8080`.

## Deployment Scripts

A script `scripts/deploy-miniflux.sh` has been provided which uses the Render CLI to create the web service.

To run it manually in the future:
```bash
render workspace set <your-workspace-id>
./scripts/deploy-miniflux.sh
```

## Future Maintenance

### Updating Miniflux
Since we use the official `miniflux/miniflux:latest` Docker image, your Render service will not automatically deploy on new Miniflux releases. To pull the latest update:
1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Select your `miniflux-rss-app` Web Service.
3. Click **Manual Deploy** -> **Deploy latest commit** (or "Clear build cache & deploy" if Render supports pulling the latest `miniflux:latest` image).
   
Alternatively, you can trigger a restart using the CLI:
```bash
render restart --resources srv-d84uobh9rddc739u0g90
```

### Cold Starts
Since this is running on Render's free tier, the service will go to sleep after 15 minutes of inactivity. When you visit the app or a background sync happens while asleep, the first request will take ~50 seconds as the container spins up. 

If this becomes a problem, you can either:
1. Upgrade to a paid Render tier ($7/month).
2. Set up a free cron job via a service like cron-job.org to ping the health endpoint every 14 minutes:
   `https://miniflux-rss-app.onrender.com/healthcheck`

### Custom Domains & HTTPS
Render automatically provides HTTPS for the `.onrender.com` subdomain. If you want a custom domain:
1. Go to your Render Dashboard -> `miniflux-rss-app` -> **Settings**.
2. Scroll to **Custom Domains** and add your domain (e.g., `rss.yourdomain.com`).
3. Render will provide you with a CNAME record.
4. Go to your DNS provider (e.g., Cloudflare) and add the CNAME record pointing to `miniflux-rss-app.onrender.com`. If using Cloudflare, make sure the proxy status is **DNS Only** (grey cloud) during the certificate issuance, or strictly **Full (Strict)** if you proxy it, to avoid redirect loops.
5. Once DNS propagates, Render will automatically issue a free Let's Encrypt SSL certificate for your custom domain.
