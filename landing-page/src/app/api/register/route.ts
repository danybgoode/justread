import { NextResponse } from "next/server";

const MINIFLUX_API_URL = process.env.MINIFLUX_API_URL || "http://localhost:8080/v1";
const ADMIN_USERNAME = process.env.MINIFLUX_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.MINIFLUX_ADMIN_PASSWORD || "admin_password";

const STARTER_FEEDS = [
  { url: "https://news.ycombinator.com/rss", category: "Tech" },
  { url: "https://www.theverge.com/rss/index.xml", category: "Tech" },
  { url: "https://wwwhatsnew.com/feed/", category: "Tech" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", category: "Tech" },
  { url: "https://daringfireball.net/feeds/main", category: "Tech" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", category: "News" },
  { url: "https://www.jornada.com.mx/rss/edicion.xml", category: "News" },
  { url: "https://www.proceso.com.mx/rss/", category: "News" },
  { url: "https://feeds.bbci.co.uk/news/rss.xml", category: "News" },
  { url: "https://www.economist.com/printedition/covers.xml", category: "Business" },
  { url: "https://www.bloomberg.com/feeds/bview/rss", category: "Business" },
  { url: "https://xkcd.com/rss.xml", category: "Comics" },
  { url: "https://www.newyorker.com/feed/everything", category: "Culture" },
  { url: "https://feeds.simplecast.com/dCXMIpJz", category: "Podcasts" },
  { url: "https://feeds.simplecast.com/Y1jH5rQ1", category: "Podcasts" },
  { url: "https://feeds.simplecast.com/71234937-2384-4809-906f-71280872652e", category: "Podcasts" },
];

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

    for (const feed of STARTER_FEEDS) {
      // Create category if not exists
      if (!categoryMap[feed.category]) {
        const catRes = await fetch(`${MINIFLUX_API_URL}/categories`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: userAuthHeader,
          },
          body: JSON.stringify({ title: feed.category }),
        });
        
        if (catRes.ok) {
          const cat = await catRes.json();
          categoryMap[feed.category] = cat.id;
        } else {
          // If category already exists or error, fetch it
          const catsRes = await fetch(`${MINIFLUX_API_URL}/categories`, {
            headers: { Authorization: userAuthHeader },
          });
          if (catsRes.ok) {
            const cats = await catsRes.json();
            const existingCat = cats.find((c: any) => c.title === feed.category);
            if (existingCat) {
              categoryMap[feed.category] = existingCat.id;
            }
          }
        }
      }

      // Add feed
      if (categoryMap[feed.category]) {
        try {
          await fetch(`${MINIFLUX_API_URL}/feeds`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: userAuthHeader,
            },
            body: JSON.stringify({
              feed_url: feed.url,
              category_id: categoryMap[feed.category],
            }),
          });
        } catch (e) {
          console.error(`Failed to add feed ${feed.url}:`, e);
        }
      }
    }

    // 3. Send Telegram Notification
    try {
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = "1517743559";
      const message = `🎉 YEEHAW! A new reader just joined Panfleto! 🎉\n\nEmail: ${email}\n\nKeep on pushing, Panflo! 🚀`;

      if (telegramToken) {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
          }),
        });
      } else {
        console.warn("TELEGRAM_BOT_TOKEN is not set in environment variables");
      }
    } catch (tgError) {
      console.error("Failed to send Telegram notification:", tgError);
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
            from: "Panflo <hello@panfleto.win>",
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
        });
      } else {
         console.warn("RESEND_API_KEY is not set in environment variables");
      }
    } catch (emailError) {
      console.error("Failed to send Welcome email:", emailError);
    }

    return NextResponse.json({ success: true, userId: user.id }, { status: 200 });
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
