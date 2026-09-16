// Where panfleto's MCP server finds a reader's credential, and which form it prefers.
//
// The original design put the token in the URL — `https://panfleto.win/api/mcp?token=<credential>`.
// Query strings land in proxy logs (Caddy logs every request in front of this), in browser history,
// and in referrer headers, so the credential ends up in several places nobody is thinking about.
// A header is the fix. See Roadmap/03-agent-surface/mcp-token-handling.
//
// It is NOT a straight swap, and D2's research is why: Cursor (`headers` in mcp.json) and Continue
// (`requestOptions.headers`) send custom headers on a remote MCP URL today, but claude.ai's
// custom-connector request headers are a limited beta with an open bug where the configured header is
// never sent — and claude.ai is the client panfleto's own settings panel links to. So both forms work,
// the header wins when both are present, and the query form is NOT given a removal date. What this
// module does provide is the number that would make that decision possible later: every query-string
// authentication is counted in the log, as a fact, never with the token.
//
// Deliberately zero imports: a pure module a test runner can load without pulling in next/server.

export type TokenSource = "header" | "query" | "none";

export type ResolvedToken = {
  token: string | null;
  source: TokenSource;
  /** True when a client sent both forms; the header is used and this is worth knowing. */
  bothPresent: boolean;
};

/**
 * Pull the credential out of a request's header and query string.
 *
 * `authorization` is matched case-insensitively on the scheme, as RFC 9110 requires, and a bare token
 * with no scheme is NOT accepted: quietly honouring `Authorization: <token>` would mean a client that
 * mis-configures the scheme keeps working here and breaks against every other server.
 */
export function resolveToken(authorizationHeader: string | null, queryToken: string | null): ResolvedToken {
  const header = bearerToken(authorizationHeader);
  const query = queryToken?.trim() ? queryToken.trim() : null;

  if (header) return { token: header, source: "header", bothPresent: query !== null };
  if (query) return { token: query, source: "query", bothPresent: false };
  return { token: null, source: "none", bothPresent: false };
}

function bearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /^bearer[ \t]+(\S+)[ \t]*$/i.exec(headerValue.trim());
  return match ? match[1] : null;
}

/**
 * The line written when a client authenticates with the legacy query form. It carries the fact and
 * nothing else — counting these is what makes "can we remove the query string yet?" answerable, and
 * putting the token in a log line would recreate the very problem this epic is about
 * (AGENTS.md rule 4).
 */
export const LEGACY_QUERY_MARKER = "mcp-auth: legacy query-string token";

export const BOTH_FORMS_MARKER = "mcp-auth: both credential forms sent, header used";

export function legacyUseLogLine(userAgent: string | null): string {
  return `${LEGACY_QUERY_MARKER} client=${JSON.stringify(clientOf(userAgent))}`;
}

// The user agent identifies the CLIENT, not the user: it is what tells you whether the remaining
// legacy traffic is one stale connector or everybody. Newlines are stripped so a hostile value cannot
// forge a second log line, and the length is capped.
function clientOf(userAgent: string | null): string {
  return (userAgent ?? "unknown").replace(/[\r\n]/g, " ").slice(0, 120);
}

/** A client sending both forms is mid-migration - distinguishable from one that only knows the old way. */
export function bothFormsLogLine(userAgent: string | null): string {
  return `${BOTH_FORMS_MARKER} client=${JSON.stringify(clientOf(userAgent))}`;
}

/**
 * One rejection message for every way authentication can fail.
 *
 * It must not say whether the header or the query form was the wrong one, and it must not differ
 * between "no credential" and "bad credential" in a way that lets someone probe for valid tokens.
 */
export const AUTH_ERROR_MESSAGE =
  "Unauthorized. Send your panfleto MCP token as an Authorization: Bearer header (recommended), " +
  "or as a ?token= query parameter. Get or rotate your token at https://app.panfleto.win/integrations";

/**
 * JSON-RPC error codes.
 *
 * -32600 ("Invalid Request") means the payload failed structural validation, so using it for an
 * authentication failure tells the client its own protocol is broken and sends it looking in the
 * wrong place. -32000..-32099 is the reserved implementation-defined server-error block, which is
 * what both of these actually are.
 */
export const JSONRPC_AUTH_FAILED = -32001;
export const JSONRPC_UPSTREAM_UNAVAILABLE = -32002;

/**
 * Deliberately distinct from AUTH_ERROR_MESSAGE. If the reader is down and we answer "unauthorized",
 * the user rotates a perfectly good token and breaks the connector they were trying to fix.
 */
export const READER_UNAVAILABLE_MESSAGE =
  "panfleto's reader could not be reached to verify your token. This is not a problem with your " +
  "token - do not rotate it. Try again shortly; if it persists, check https://app.panfleto.win/healthcheck";
