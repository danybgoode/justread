import { NextRequest, NextResponse } from "next/server";

const MINIFLUX_URL = "https://app.panfleto.win/v1";

// ─── Miniflux API helper ────────────────────────────────────────────────────

async function miniflux(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`${MINIFLUX_URL}${path}`, {
    ...options,
    headers: {
      "X-Auth-Token": token,
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Miniflux API error ${res.status}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_categories",
    description: "Lists all feed categories with their IDs and titles.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "manage_categories",
    description: "Create, update, or delete a feed category.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "update", "delete"] },
        category_id: { type: "number", description: "Required for update and delete" },
        title: { type: "string", description: "Required for create and update" },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    name: "add_feed",
    description: "Subscribes the user to a new RSS feed. Requires a feed_url and a category_id (use get_categories first).",
    inputSchema: {
      type: "object",
      properties: {
        feed_url: { type: "string" },
        category_id: { type: "number" },
      },
      required: ["feed_url", "category_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_unread_summary",
    description:
      "Returns the total number of unread entries and a breakdown by feed category. Use this first to understand what's waiting to be read.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_unread_entries",
    description:
      "Fetches the most recent unread articles across all subscribed feeds. Returns title, URL, feed name, category, and published date. Perfect for a quick news brief.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of entries to return (1–50, default 20)",
        },
        category_id: {
          type: "number",
          description: "Optional: filter entries to a specific category ID",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_entry_content",
    description:
      "Fetches the full content of a specific article by its entry ID. Use this after get_unread_entries to read the body of an article.",
    inputSchema: {
      type: "object",
      properties: {
        entry_id: {
          type: "number",
          description: "The numeric ID of the entry to fetch",
        },
      },
      required: ["entry_id"],
      additionalProperties: false,
    },
  },
  {
    name: "search_entries",
    description:
      "Searches all feed entries (read and unread) by keyword. Returns matching articles with title, URL, feed, and a snippet.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query string",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (1–50, default 15)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_feeds",
    description:
      "Lists all RSS feeds the user is subscribed to, grouped by category. Includes feed ID, title, URL, and unread count.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_daily_digest",
    description:
      "Generates a curated daily digest of today's articles across all feeds. Groups entries by category and returns a formatted summary with titles and links — ideal for a morning briefing.",
    inputSchema: {
      type: "object",
      properties: {
        limit_per_category: {
          type: "number",
          description: "Max articles per category (1–10, default 5)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mark_entries_read",
    description:
      "Marks one or more entries as read by their IDs. Use this after summarising articles for the user.",
    inputSchema: {
      type: "object",
      properties: {
        entry_ids: {
          type: "array",
          items: { type: "number" },
          description: "Array of entry IDs to mark as read",
        },
      },
      required: ["entry_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "get_starred_entries",
    description:
      "Returns all bookmarked (starred) articles. These are articles the user explicitly saved for later reading.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum entries to return (1–50, default 20)",
        },
      },
      additionalProperties: false,
    },
  },
];

// ─── Tool implementations ────────────────────────────────────────────────────

async function callTool(
  token: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case "get_categories": {
      const categories: any[] = await miniflux(token, "/categories");
      if (!categories || !categories.length) return "No categories found.";
      return categories.map((c: any) => `[ID: ${c.id}] ${c.title}`).join("\n");
    }

    case "manage_categories": {
      const { action, category_id, title } = args;
      if (action === "create") {
        if (!title) throw new Error("title is required for create");
        const res = await miniflux(token, "/categories", {
          method: "POST",
          body: JSON.stringify({ title }),
        });
        return `Category created with ID ${res.id}`;
      } else if (action === "update") {
        if (!category_id || !title) throw new Error("category_id and title required for update");
        await miniflux(token, `/categories/${category_id}`, {
          method: "PUT",
          body: JSON.stringify({ title }),
        });
        return `Category ${category_id} updated`;
      } else if (action === "delete") {
        if (!category_id) throw new Error("category_id required for delete");
        await miniflux(token, `/categories/${category_id}`, { method: "DELETE" });
        return `Category ${category_id} deleted`;
      }
      throw new Error(`Unknown action: ${action}`);
    }

    case "add_feed": {
      const { feed_url, category_id } = args;
      if (!feed_url || !category_id) throw new Error("feed_url and category_id are required");
      const res = await miniflux(token, "/feeds", {
        method: "POST",
        body: JSON.stringify({ feed_url, category_id }),
      });
      return `Feed added successfully! Feed ID: ${res.feed_id}`;
    }

    case "get_unread_summary": {
      const counters = await miniflux(token, "/feeds/counters");
      const feeds: any[] = await miniflux(token, "/feeds");
      const totalUnread = Object.values(counters?.unreads ?? {}).reduce(
        (s: number, v) => s + (v as number),
        0
      );
      // Group by category
      const byCategory: Record<string, number> = {};
      for (const feed of feeds) {
        const cat = feed.category?.title ?? "Uncategorized";
        const unread = counters?.unreads?.[feed.id] ?? 0;
        byCategory[cat] = (byCategory[cat] ?? 0) + unread;
      }
      const breakdown = Object.entries(byCategory)
        .filter(([, n]) => n > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, n]) => `  • ${cat}: ${n}`)
        .join("\n");
      return `Total unread: ${totalUnread}\n\nBy category:\n${breakdown || "  (none)"}`;
    }

    case "get_unread_entries": {
      const limit = Math.min(50, Math.max(1, Number(args.limit ?? 20)));
      const params = new URLSearchParams({
        status: "unread",
        limit: String(limit),
        order: "published_at",
        direction: "desc",
      });
      if (args.category_id) params.set("category_id", String(args.category_id));
      const data = await miniflux(token, `/entries?${params}`);
      const entries: any[] = data?.entries ?? [];
      if (!entries.length) return "No unread entries found.";
      return entries
        .map(
          (e: any) =>
            `[${e.id}] ${e.title}\n  Feed: ${e.feed?.title ?? "?"} (${e.feed?.category?.title ?? "?"})\n  Published: ${new Date(e.published_at).toLocaleDateString()}\n  URL: ${e.url}`
        )
        .join("\n\n");
    }

    case "get_entry_content": {
      const id = Number(args.entry_id);
      if (!id) return "Error: entry_id is required.";
      const entry: any = await miniflux(token, `/entries/${id}`);
      // Strip HTML tags for clean text
      const content = (entry.content ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return `Title: ${entry.title}\nFeed: ${entry.feed?.title}\nURL: ${entry.url}\nPublished: ${new Date(entry.published_at).toLocaleDateString()}\n\n${content || "(No content available — open the URL to read)"}`;
    }

    case "search_entries": {
      const query = String(args.query ?? "").trim();
      if (!query) return "Error: query is required.";
      const limit = Math.min(50, Math.max(1, Number(args.limit ?? 15)));
      const params = new URLSearchParams({
        search: query,
        limit: String(limit),
      });
      const data = await miniflux(token, `/entries?${params}`);
      const entries: any[] = data?.entries ?? [];
      if (!entries.length) return `No entries found matching "${query}".`;
      return entries
        .map(
          (e: any) =>
            `[${e.id}] ${e.title}\n  Feed: ${e.feed?.title ?? "?"}\n  URL: ${e.url}`
        )
        .join("\n\n");
    }

    case "get_feeds": {
      const feeds: any[] = await miniflux(token, "/feeds");
      const counters = await miniflux(token, "/feeds/counters");
      // Group by category
      const grouped: Record<string, any[]> = {};
      for (const feed of feeds) {
        const cat = feed.category?.title ?? "Uncategorized";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
          id: feed.id,
          title: feed.title,
          url: feed.feed_url,
          unread: counters?.unreads?.[feed.id] ?? 0,
        });
      }
      return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cat, items]) => {
          const lines = items.map(
            (f) => `  [${f.id}] ${f.title} — ${f.unread} unread`
          );
          return `${cat}:\n${lines.join("\n")}`;
        })
        .join("\n\n");
    }

    case "get_daily_digest": {
      const limitPerCat = Math.min(10, Math.max(1, Number(args.limit_per_category ?? 5)));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Fetch recent unread entries (more than we need, then filter by today)
      const params = new URLSearchParams({
        status: "unread",
        limit: "200",
        order: "published_at",
        direction: "desc",
      });
      const data = await miniflux(token, `/entries?${params}`);
      const entries: any[] = data?.entries ?? [];
      // Group by category, keep only today's articles
      const grouped: Record<string, any[]> = {};
      for (const e of entries) {
        const pub = new Date(e.published_at);
        const cat = e.feed?.category?.title ?? "Uncategorized";
        if (!grouped[cat]) grouped[cat] = [];
        if (grouped[cat].length < limitPerCat) {
          grouped[cat].push(e);
        }
      }
      if (!Object.keys(grouped).length) {
        return "No unread entries available for today's digest.";
      }
      const dateStr = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const sections = Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cat, items]) => {
          const lines = items.map((e: any) => `  • ${e.title}\n    ${e.url}`);
          return `## ${cat}\n${lines.join("\n")}`;
        });
      return `# Panfleto Daily Digest — ${dateStr}\n\n${sections.join("\n\n")}`;
    }

    case "mark_entries_read": {
      const ids = (args.entry_ids as number[]) ?? [];
      if (!ids.length) return "Error: entry_ids array is required.";
      await miniflux(token, "/entries", {
        method: "PUT",
        body: JSON.stringify({ entry_ids: ids, status: "read" }),
      });
      return `Marked ${ids.length} entr${ids.length === 1 ? "y" : "ies"} as read.`;
    }

    case "get_starred_entries": {
      const limit = Math.min(50, Math.max(1, Number(args.limit ?? 20)));
      const params = new URLSearchParams({
        starred: "true",
        limit: String(limit),
        order: "published_at",
        direction: "desc",
      });
      const data = await miniflux(token, `/entries?${params}`);
      const entries: any[] = data?.entries ?? [];
      if (!entries.length) return "No starred entries found.";
      return entries
        .map(
          (e: any) =>
            `[${e.id}] ${e.title}\n  Feed: ${e.feed?.title ?? "?"}\n  URL: ${e.url}`
        )
        .join("\n\n");
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ─── MCP JSON-RPC handler ────────────────────────────────────────────────────

function jsonRpcError(id: unknown, code: number, message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status: 200 } // MCP spec: always 200, error in body
  );
}

function jsonRpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

export async function POST(req: NextRequest) {
  // 1. Extract auth token from query param
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return jsonRpcError(null, -32600, "Missing ?token= query parameter. Generate your API key at app.panfleto.win/settings/api-keys");
  }

  // 2. Parse JSON-RPC body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error: invalid JSON");
  }

  const { jsonrpc, method, params, id } = body;
  if (jsonrpc !== "2.0") {
    return jsonRpcError(id, -32600, "Invalid Request: jsonrpc must be '2.0'");
  }

  // 3. Handle MCP methods
  try {
    switch (method) {
      // ── initialize ──────────────────────────────────────────────────────────
      case "initialize":
        return jsonRpcResult(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "panfleto-mcp",
            version: "1.0.0",
            description: "AI assistant integration for Panfleto RSS reader",
          },
        });

      // ── notifications/initialized (no response needed) ───────────────────
      case "notifications/initialized":
        return new NextResponse(null, { status: 204 });

      // ── tools/list ──────────────────────────────────────────────────────────
      case "tools/list":
        return jsonRpcResult(id, { tools: TOOLS });

      // ── tools/call ──────────────────────────────────────────────────────────
      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments ?? {};
        if (!toolName) return jsonRpcError(id, -32602, "Missing params.name");

        const tool = TOOLS.find((t) => t.name === toolName);
        if (!tool) return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`);

        try {
          const text = await callTool(token, toolName, toolArgs);
          return jsonRpcResult(id, {
            content: [{ type: "text", text }],
          });
        } catch (err: any) {
          // Tool execution errors go in content with isError flag
          return jsonRpcResult(id, {
            content: [{ type: "text", text: err.message }],
            isError: true,
          });
        }
      }

      // ── ping ────────────────────────────────────────────────────────────────
      case "ping":
        return jsonRpcResult(id, {});

      default:
        return jsonRpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err: any) {
    return jsonRpcError(id, -32603, `Internal error: ${err.message}`);
  }
}

// GET: basic info for browsers visiting the URL directly
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  return NextResponse.json({
    name: "Panfleto MCP Server",
    version: "1.0.0",
    protocol: "MCP Streamable HTTP (2024-11-05)",
    description: "Connect your AI assistant to your Panfleto RSS reader",
    status: token ? "token_provided" : "no_token",
    usage: {
      url: "https://panfleto.win/api/mcp?token=YOUR_API_KEY",
      how_to_get_token: "Visit https://app.panfleto.win/settings/api-keys",
      compatible_clients: ["Claude.ai", "Claude Code", "Cursor", "Continue", "any MCP-compatible client"],
    },
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}
