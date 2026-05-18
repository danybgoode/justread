import { NextResponse } from "next/server";

const MINIFLUX_API_URL = process.env.MINIFLUX_API_URL || "http://localhost:8080/v1";
const ADMIN_USERNAME = process.env.MINIFLUX_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.MINIFLUX_ADMIN_PASSWORD || "admin_password";

const STARTER_FEEDS = [
  { url: "https://news.ycombinator.com/rss", category: "Tech" },
  { url: "https://www.theverge.com/rss/index.xml", category: "Tech" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", category: "News" },
  { url: "https://xkcd.com/rss.xml", category: "Comics" }
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
        await fetch(`${MINIFLUX_API_URL}/discover`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: userAuthHeader,
          },
          body: JSON.stringify({
            url: feed.url,
            category_id: categoryMap[feed.category],
          }),
        }).then(async (res) => {
          if (res.ok) {
            const subscriptions = await res.json();
            if (subscriptions.length > 0) {
              // Subscribe to the first discovered feed
               await fetch(`${MINIFLUX_API_URL}/subscriptions`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: userAuthHeader,
                },
                body: JSON.stringify({
                  url: subscriptions[0].url,
                  category_id: categoryMap[feed.category],
                }),
              });
            }
          }
        });
      }
    }

    return NextResponse.json({ success: true, userId: user.id }, { status: 200 });
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
