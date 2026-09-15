# Can the newspaper read one reader's feeds? — Sprint 2: Ranking floor — is the paper worth reading?

**Status:** ✅ complete — edition rendered, verdict given (*worth reading with tuning*), bet confirmed L

## Stories

### Story 2.1 — Rule out the view-based ranker for the personalized edition ✅ `D3` (partial)
**As a** product owner, **I want** to know whether the trending ranker we already own can serve one
reader, **so that** we don't build on a signal that can never fire.
**Acceptance:** written into D3 with the reason.
**Risk:** low
**Outcome:** ruled out. `src/lib/trending/ranking.ts` is `views / (age+2)^1.5 × multiplier` over
Upstash ZSETs written by article pages after mount. One reader generates a handful of views a day,
so the personalized edition would be permanently cold-started. It stays the **anonymous** edition's
ranker, where site-scale traffic makes it meaningful.

### Story 2.2 — Rank one real account and read the front page 🟡 rendered, verdict owed
**As a** product owner, **I want** to see a personalized front page built from my own feeds,
**so that** I can say whether it is worth reading before anyone bets on building it.
**Acceptance:** a rendered (or plain-text) front page for one real account, produced from intrinsic
signals only, and a one-paragraph editorial judgement from the product owner: worth reading as-is,
worth reading with tuning, or needs the LLM pass. That judgement is what sizes the build bet **M or
L**, and D3 moves to LOCKED carrying it.
**Risk:** low
**Outcome so far:** v1 ran over user 2's last 24 hours (1,156 entries → 1,067 stories). Front page (private):
https://claude.ai/artifact/EQuWxi3buUNnpb5MSR7fMU. 20 of its 29 stories are there on recency alone. Feed weight
doesn't exist in Miniflux, and HN comment counts need one external call per entry. The product owner's verdict is owed
before D3 locks. See D3.

**The ranking under test (v1, intrinsic signals only — no new dependency, no cold start):**

| Signal | Source | Why |
|---|---|---|
| Recency | `published_at` | A newspaper is a daily. Decay, don't sort. |
| Feed + category weight | `feed.title`, `category.title` | The reader already declared importance by how they organized their feeds. Free personalization. |
| Per-section quota | `category.title` | Stops one noisy feed owning the front page — the failure mode a river doesn't have and a front page does. |
| Comment volume | `comments_url` (persisted; HN pipeline shipped) | The only external "other people care" signal panfleto already has. |
| Cross-source dedupe | title/URL similarity | Four feeds carrying one story become one lead with four sources. This is the thing that most makes it read like a paper. |

**Judge it on the output, not the formula.** The open question is editorial: does the top of the
page look like what a person would want on their front page this morning? Tuning is out of scope —
if v1 needs tuning to be *readable*, that is the finding, and it is what makes the follow-on bet L.

### Story 2.3 — Size the follow-on bet ✅ provisional — **L**, see the README's *Follow-on bet*
**As a** product owner, **I want** the build epic sized M or L with a stated reason, **so that** the
next betting table is a three-line decision instead of a fresh groom.
**Acceptance:** written at the foot of the epic README, naming what it would displace from the
current build order.
**Risk:** low

## Sprint QA
- **api spec(s):** none — spike.
- **browser smoke owed:** no. Story 2.2's output is read by the product owner, but it is a
  judgement call on content, not a UI assertion.
- **deterministic gate:** N/A — nothing merges from this sprint.

## Sprint 2 — Smoke walkthrough (do these in order)
Env: documentation review + one generated artifact · no deployment

1. Open the epic README's **Decisions** block and read D3.
   → It states whether the intrinsic ranking is good enough, with the product owner's own judgement
   quoted, not inferred.
2. Open the front page produced by Story 2.2.
   → It is built from one real account's feeds, and the top items are recognisably that reader's
   sources — not a generic news river.
3. Check the same story appearing in more than one of your feeds.
   → It appears **once**, with its other sources listed against it.
4. Read the foot of the epic README.
   → The follow-on bet is sized M or L, with a reason and what it displaces.

If any step fails, note the step number + what you saw — that's the bug report.
