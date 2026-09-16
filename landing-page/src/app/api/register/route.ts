import { NextResponse } from "next/server";
import { formatOnboardingSummary, type FeedResult } from "@/lib/onboarding-summary";

const MINIFLUX_API_URL = process.env.MINIFLUX_API_URL || "http://localhost:8080/v1";
const ADMIN_USERNAME = process.env.MINIFLUX_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.MINIFLUX_ADMIN_PASSWORD || "admin_password";

// The one list of starter feeds is panfleto-core's feeds.json (internal/ui/static/bin/feeds.json).
// The reader embeds it and serves it with its other static assets, so signup reads it from there
// rather than keeping a copy that drifts. The checksum path segment only drives caching.
const FEEDS_JSON_URL = new URL("/icon/feeds/feeds.json", MINIFLUX_API_URL).toString();

// Signup provisioning is not allowed to hang. One unreachable starter feed used to be able to hold
// the registration request open for as long as the runtime allowed; now each call has a deadline and
// a dead feed costs the new reader that feed, not their signup.
// (Roadmap/02-onboarding-and-signup/onboarding-provisioning-reliability, D1.)
const FEED_TIMEOUT_MS = 15_000;
const NOTIFY_TIMEOUT_MS = 20_000;
// Unlike the Auth0 path, this one runs inside the request the new reader is waiting on, so the loop
// needs a wall-clock budget as well as a per-call timeout: without it, several slow feeds add up to a
// signup somebody abandons. Feeds past the budget are reported as skipped, not silently dropped.
const ONBOARDING_BUDGET_MS = 60_000;

// Both were hardcoded in this file. Defaults are the values that were here, so nothing changes
// unless the host sets them.
const TELEGRAM_CHAT_ID = process.env.PANFLETO_TELEGRAM_CHAT_ID?.trim() || "1517743559";
const EMAIL_FROM = process.env.PANFLETO_EMAIL_FROM?.trim() || "Panflo <hello@panfleto.win>";

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type SuggestedFeed = { url: string; title: string; category: string; starter: boolean };

async function loadStarterFeeds(): Promise<SuggestedFeed[]> {
  try {
    const res = await fetch(FEEDS_JSON_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const feeds = (await res.json()) as SuggestedFeed[];
    const starters = feeds.filter((feed) => feed.starter);
    if (starters.length === 0) console.error(`No starter feeds in ${FEEDS_JSON_URL}`);
    return starters;
  } catch (e) {
    console.error(`Failed to load starter feeds from ${FEEDS_JSON_URL}:`, e);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    const authHeader = "Basic " + Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString("base64");

    // 1. Create User
    const userRes = await fetch(`${MINIFLUX_API_URL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        username: email,
        password: password,
        is_admin: false,
      }),
    });

    if (!userRes.ok) {
      const errorData = await userRes.json().catch(() => ({}));
      return NextResponse.json(
        { message: errorData.error_message || "Failed to create account. User may already exist." },
        { status: userRes.status }
      );
    }

    const user = await userRes.json();

    // The user's auth header (for creating their categories and feeds)
    const userAuthHeader = "Basic " + Buffer.from(`${email}:${password}`).toString("base64");

    // 2. Setup Categories & Feeds
    const categoryMap: Record<string, number> = {};
    // Per-feed outcomes, collected rather than discarded - the whole point of this epic. A partial
    // provision is still a provision (D2): the user keeps what worked, and the product owner is told
    // what didn't, because a failing starter feed is a feeds.json problem that affects everybody.
    const results: FeedResult[] = [];

    // The whole loop has a budget, not just each call: 16 feeds x a 15s timeout is a signup the
    // user would abandon. Once the budget is spent the rest are recorded, not attempted - the same
    // shape as the Go path's context deadline (D1).
    const deadline = Date.now() + ONBOARDING_BUDGET_MS;
    // A category that already failed must fail the rest of its feeds immediately rather than
    // re-attempting a call we know is broken.
    const failedCategories = new Set<string>();

    for (const feed of await loadStarterFeeds()) {
      if (Date.now() > deadline) {
        results.push({ url: feed.url, reason: "onboarding deadline reached" });
        continue;
      }

      // Create category if not exists. Every call in here is awaited inside a try: the account has
      // already been created at this point, so a throw would 500 a signup that actually succeeded
      // and take every collected result with it.
      if (!categoryMap[feed.category] && !failedCategories.has(feed.category)) {
        try {
          const catRes = await fetch(`${MINIFLUX_API_URL}/categories`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: userAuthHeader,
            },
            body: JSON.stringify({ title: feed.category }),
            signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
          });

          if (catRes.ok) {
            const cat = await catRes.json();
            categoryMap[feed.category] = cat.id;
          } else {
            // If category already exists or error, fetch it
            const catsRes = await fetch(`${MINIFLUX_API_URL}/categories`, {
              headers: { Authorization: userAuthHeader },
              signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
            });
            if (catsRes.ok) {
              const cats = await catsRes.json();
              const existingCat = cats.find((c: any) => c.title === feed.category);
              if (existingCat) {
                categoryMap[feed.category] = existingCat.id;
              }
            }
          }
        } catch (e) {
          console.error(`Failed to resolve category ${feed.category}:`, describeError(e));
        }
        if (!categoryMap[feed.category]) failedCategories.add(feed.category);
      }

      // Add feed
      if (!categoryMap[feed.category]) {
        results.push({ url: feed.url, reason: `category ${feed.category} could not be created` });
        continue;
      }

      try {
        const feedRes = await fetch(`${MINIFLUX_API_URL}/feeds`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: userAuthHeader,
          },
          body: JSON.stringify({
            feed_url: feed.url,
            category_id: categoryMap[feed.category],
          }),
          signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
        });
        if (!feedRes.ok) {
          // Miniflux answers 500 for "this feed is unreachable", so a non-2xx here is the normal way
          // a dead starter feed shows up. It was being thrown away: fetch only rejects on transport
          // errors, so the old `try/catch` never saw it.
          const detail = await feedRes.text().catch(() => "");
          results.push({ url: feed.url, reason: `HTTP ${feedRes.status} ${detail.slice(0, 200)}`.trim() });
          console.error(`Failed to add feed ${feed.url}: HTTP ${feedRes.status}`);
          continue;
        }
        results.push({ url: feed.url });
      } catch (e) {
        results.push({ url: feed.url, reason: describeError(e) });
        console.error(`Failed to add feed ${feed.url}:`, describeError(e));
      }
    }

    const summary = formatOnboardingSummary(email, results);
    console.log(`Onboarding finished: ${results.filter((r) => !r.reason).length}/${results.length} feeds added for ${email}`);

    // 3. Send Telegram Notification - now carrying the outcome, not just the fact of a signup.
    try {
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

      if (telegramToken) {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: summary,
          }),
          signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
        });
      } else {
        console.warn("TELEGRAM_BOT_TOKEN is not set in environment variables");
      }
    } catch (tgError) {
      // The bot token is in the URL, so never log the error object itself (AGENTS.md rule 4).
      console.error("Failed to send Telegram notification:", describeError(tgError).replaceAll(process.env.TELEGRAM_BOT_TOKEN ?? "\u0000", "<redacted>"));
    }

    // 4. Send Welcome Email via Resend
    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [email],
            subject: "Welcome to Panfleto! 📰",
            html: `
                <div style="font-family: sans-serif; max-w-xl; margin: 0 auto; color: #333;">
                <img src="https://panfleto.win/panflo.png" alt="Panflo Mascot" style="width: 120px; height: auto; margin-bottom: 20px; display: block;" />
                <h1 style="color: #111;">Welcome to Panfleto! 🎉</h1>
                <p>Hello there,</p>
                <p>Thank you for signing up! Your account is ready, and we've pre-loaded some starter feeds to get you going.</p>
                <p>You can check out your new feeds right away at: <a href="https://app.panfleto.win/feeds" style="color: #3b82f6; text-decoration: none; font-weight: bold;">app.panfleto.win/feeds</a></p>
                <br/>
                <p>Panfleto is built differently. Here, you get to enjoy your reading <strong>100% free of ads, tracking, and manipulative algorithms</strong>. Just pure, chronological feeds.</p>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #eaeaea;">
                  <h3 style="margin-top: 0;">⚡ Quick Cheat Sheet</h3>
                  <ul style="margin-bottom: 0; padding-left: 20px; line-height: 1.6;">
                    <li><strong>Spacebar:</strong> Scroll down (and to next article)</li>
                    <li><strong>Enter / o:</strong> Open focused article</li>
                    <li><strong>m:</strong> Toggle read/unread</li>
                    <li><strong>v:</strong> Open original site</li>
                    <li><strong>? :</strong> View all shortcuts!</li>
                  </ul>
                </div>
                
                <p><strong>A quick favor:</strong></p>
                <p>Panfleto is run entirely out of pocket by a single developer. If you enjoy the distraction-free experience, please consider chipping in to keep the servers running and the project ad-free.</p>
                <p>You can find the "Save Panflo" options at the bottom of any article or simply via our <a href="https://buymeacoffee.com/savepanflo" style="color: #BD5FFF; font-weight: bold; text-decoration: none;">Buy Me A Coffee</a>.</p>
                <br/>
                <p>Happy reading!</p>
                <p><em>— Panflo</em></p>
              </div>
            `,
          }),
          signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
        });
      } else {
         console.warn("RESEND_API_KEY is not set in environment variables");
      }
    } catch (emailError) {
      console.error("Failed to send Welcome email:", describeError(emailError));
    }

    return NextResponse.json({ success: true, userId: user.id }, { status: 200 });
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
