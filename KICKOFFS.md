# panfleto — what to paste next

Three prompts, in the order you'll want them. Everything below is regenerable:

```bash
GROOM=~/dobby/dobby-foundation/plugins/ways-of-work/skills/groom
node "$GROOM/emit-epic-kickoff.mjs" --epic miniflux-upstream-resync
```

---

## ⚠️ Read this before pasting §1 — two places the generic prompt is wrong for panfleto

The kickoff generator writes a prompt that assumes the template's default deploy rail. panfleto's is
different in two ways that matter, and both appear in the generated §5. **Paste the addendum
directly under the kickoff** so the orchestrator gets the correction in the same message.

**1. "Apply migrations BEFORE merging (merging deploys)" does not apply here.**
Merging to `main` deploys nothing on panfleto — a human runs `update.sh` on the VM. And this epic
must not add a migration at all (`AGENTS.md` rule 3): the only migrations involved are *upstream's*
two, which apply on container boot via `RUN_MIGRATIONS=1`, i.e. **after** the deploy, not before the
merge. The generic instruction, followed literally, would have someone hand-applying migrations to
production before a merge that doesn't deploy.

**2. Merge authorization is yours to grant, and I have not assumed it.**
The generated §5 asserts *"you are pre-authorized to merge on a green gate."* Per
`WAYS-OF-WORKING.md`, HIGH tier is a product-owner merge unless you pre-authorize a **named**
epic-mode run. All three PRs here are HIGH, and S2 deploys 131 upstream commits to your only
environment. The addendum below **defaults to you merging**. If you'd rather pre-authorize, replace
that paragraph with: *"This is a named epic-mode run — you are pre-authorized to merge S1 and S3 on
green. S2 still comes to me."* Splitting it that way keeps the round-trip only where it's earned.

---

## 1 · Build the epic — Claude Code, strong model, epic mode

> Paste the output of `emit-epic-kickoff.mjs --epic miniflux-upstream-resync`, then paste this
> addendum immediately after it in the same message.

### panfleto addendum — overrides the generic §5 above

**This project has no CD.** Merging to `main` deploys nothing. Production changes only when a human
SSHes to the Oracle VM and runs `/opt/panfleto/deploy/update.sh`, which pulls `main` and rebuilds the
images *on the VM*. So:

- **Ignore "apply migrations BEFORE merging."** This epic adds no migration of its own — `AGENTS.md`
  rule 3 forbids it, and zero custom migrations is precisely what makes this rebase safe. Upstream's
  two new migrations apply on first container boot after the deploy (`RUN_MIGRATIONS=1`). The order
  is: merge → deploy → migrations run → verify live.
- **"Done means shipped" still holds, and here it means deployed.** A merged PR that hasn't been
  through `update.sh` and confirmed against `https://app.panfleto.win` is not done.
- **The deploy is mine to run, not yours.** It compiles Go on the single production host, sharing two
  cores with a Postgres holding 3 GB of `shared_buffers`. Propose the deploy, tell me what to watch,
  and I'll run it.
- **Merge authorization:** all three PRs are HIGH tier, so **I merge them**. Get the gate green, get
  both cross-family passes plus the fresh reviewer subagent clean, declare the tier in the PR body,
  and hand it to me.
- **The gate is local and CI does not cover it.** Nothing in `guards.yml` builds `panfleto-core/` —
  deliberately, since there's no per-branch preview to build against and arm64 Go on a hosted runner
  burns metered Actions minutes. Your gate is `go build ./... && go vet ./... && go test ./...` plus
  `docker compose build miniflux` from a fresh submodule clone. **Say that in every PR body** rather
  than letting a green badge imply more than it checked.
- **When you route reviewers, tell them it's Go inside a Miniflux fork** and that `AGENTS.md` rule 1
  (keep the delta small) is a standing constraint. Otherwise codex and agy will file idiomatic-refactor
  findings that grow the fork, which is the opposite of what this epic is for.
- **Watch for the empty-output failure.** A cross-review pass that exits 0 with no output reads as a
  clean review and is the most dangerous outcome on that layer. If a pass returns nothing, treat it as
  DARK and say so in the PR body.

**Start with D5, D6 and D7 in the epic README** — they're marked "to lock" and they're the three
things I could not verify from a read of the tree. D6 in particular needs `psql` against the live
database, not a read of the migration files.

---

## 2 · The two fixed-scope items that need no more grooming

Both are at Definition of Ready and ride the **fixed scope** lane — straight to a builder, no betting
table. They're earlier in the build order than the epic above and don't depend on it.

### 2a · The ad-block bug (#2 · appetite S · risk low)

```
Read AGENTS.md (Start here) + Roadmap/LEARNINGS.md.
Then read Roadmap/00-ideas/seeds/adblock-rule-false-positives.md.

Fix it. Fixed-scope lane, single story, LOW tier. Branch fix/adblock-rule-false-positives
off latest main.

The rule in scripts/enhance_miniflux.js is unanchored, so `ad` matches "leader" and
"roadmap", `deal` matches "dealer", `sale` matches "wholesale" — we are silently dropping
real articles from Unread with no log and no counter. The seed has the replacement pattern
and the Spanish terms.

Two things the seed asks for that are easy to skip and shouldn't be: a node:test file
asserting both directions (these titles match, these don't) — enhance_miniflux.js has no
tests today and this is exactly the bug a test catches — and a real before/after number so
the product owner can see how much was being lost.

Applying the rule writes to every feed's configuration via an admin API key. Run it against
one feed and diff the result before you loop.
```

### 2b · The paywall rail (#3 · appetite S · risk HIGH)

```
Read AGENTS.md (Start here) + Roadmap/LEARNINGS.md.
Then read Roadmap/00-ideas/seeds/paywall-rail-single-source.md.

Build it. Fixed-scope lane, Sweeper archetype, HIGH tier — I merge. Branch
chore/paywall-rail-single-source off latest main.

Acceptance is "less code, same behaviour, no regressions": the rail is told once, in the
template, and nothing outside Miniflux writes to entries.content ever again.

Order matters. Delete the script and the workflow FIRST — the mutation has to stop before
the cleanup, or it re-dirties what you just cleaned.

The cleanup pass is a production write and there is no staging. Before it runs: a verified
restore, a LIMITed batch, and the exact matched HTML printed for inspection before anything
is updated. Some entries were appended more than once, so strip all occurrences, not the
first. Start by telling me the answer to:
  SELECT count(*) FROM entries WHERE content LIKE '%Paywall Bypass%';
That number decides whether this is a five-minute pass or a batched job.

stripScheme must take the parsed host and path — not a string slice of the raw URL, which
would undo the untrustedURL escaping the template already does.
```

---

## 3 · Next groom — Cowork, when the epic lands

Nothing in the funnel needs grooming before the resync ships. #2 and #3 above are already at
Definition of Ready; #5 is a spike brief that's ready to run. The next item needing a **deep** groom
is #6, and it's blocked on the epic.

```
We're working the agreed build order in Roadmap/00-ideas/README.md (the sequence table —
BUILD-ORDER.md does not sort by build_order, see the note there).
The last groomed item was #4 miniflux-upstream-resync — scaffolded, and now shipped.

Groom the next shaped bet: #6 article-autofetch.
Read first, in order: Roadmap/00-ideas/BUILD-ORDER.md, then Stage 0 orientation
(AGENTS.md, Roadmap/README.md, WAYS-OF-WORKING.md, LEARNINGS.md), then the scope seed
Roadmap/00-ideas/seeds/article-autofetch.md and the decision written into
Roadmap/00-ideas/seeds/spike-unwall-app.md.

Then run /groom on it — one ask, the normal stages — and stop at the scope-doc gate for my
sign-off.

The four open questions the seed leaves for this groom: what counts as "thin" content; whether
fetch_status needs a column (which would be a migration, so HIGH and escalate); whether
everything-for-everyone survives contact with archive.ph's rate limits; and Stage 6b's real
problem — panfleto has no flag provider at all, so either the env-var-plus-restart seam is
accepted and named, or a minimal flag rail becomes its own slice first.
```

---

## Run the spike whenever you like

`#5 spike-unwall-app` is independent, costs almost nothing, and unblocks step 2 of the autofetch
chain. It has to run **from the Oracle VM** — the VM's IP is the one that will be making these
requests in production, and rate limits are per-IP. The commands are in the seed.
