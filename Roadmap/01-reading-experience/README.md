# 01 · Reading experience

**Who it's for:** someone who has already signed up and is here to read.

Everything after login: the entry list, the entry view, how an article's text actually gets onto the
page, what happens when a publisher doesn't want it to, comments, and the reading surfaces
(keyboard, mobile, PWA, themes).

The north star for this domain is **"click an article and it's already there."** No Download button,
no second tab, no bouncing to a paywall. Whatever it takes to make that true — the crawler, a
fallback chain, a prefetch worker — belongs here.

## Current features
See the poster's [01 · Reading experience](../README.md#01--reading-experience) section — it is the
status source of truth, not this page.

## Where the code lives
`panfleto-core/internal/ui/` · `internal/template/templates/views/entry.html` ·
`internal/reader/processor/` · `internal/reader/scraper/` · `internal/reader/sanitizer/`

## Epics
_(none scaffolded yet — see `../00-ideas/BUILD-ORDER.md`)_
