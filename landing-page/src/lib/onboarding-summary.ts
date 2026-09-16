// The one line the product owner reads when somebody signs up.
//
// panfleto has TWO signup paths — Auth0 (provisionUserOnboarding, in the Go reader) and password
// registration (/api/register, here) — and they used to send the same content-free ping: "a new
// reader joined", with no way to tell a complete provision from a broken one. This formatter is the
// TypeScript half of the pair; `formatOnboardingSummary` in
// panfleto-core/internal/ui/user_onboarding.go is the Go half, and the two are kept identical on
// purpose so a message in the channel doesn't need a decoder ring to say which path produced it.
//
// Deliberately zero imports: a pure module a test runner can load without pulling in next/server.
// See Roadmap/02-onboarding-and-signup/onboarding-provisioning-reliability.

export type FeedResult = {
  url: string
  /** Empty or absent means the feed was added. */
  reason?: string
}

export function formatOnboardingSummary(username: string, results: FeedResult[]): string {
  const failed = results.filter((r) => !!r.reason).map((r) => r.url)
  const added = results.length - failed.length

  if (results.length === 0) {
    return `⚠️ New reader ${username} joined Panfleto, but NO starter feeds were attempted — feeds.json looks empty.`
  }
  if (failed.length === 0) {
    return `🎉 New reader ${username} joined Panfleto — all ${added} starter feeds added.`
  }
  return (
    `⚠️ New reader ${username} joined Panfleto — ${added}/${results.length} starter feeds added, ` +
    `${failed.length} failed:\n${failed.join('\n')}`
  )
}
