# 02 · Onboarding & signup

**Who it's for:** someone who has never used panfleto, between landing on the site and their first
read.

The landing page and its copy, registration and Auth0 SSO, the starter feeds a new account arrives
with, the welcome email and signup notification, and feed discovery on the subscribe page.

The promise this domain keeps is **no empty screen**: a brand-new account opens onto 16 categorised
feeds with articles in them, not an onboarding wizard.

## Current features
See the poster's [02 · Onboarding & signup](../README.md#02--onboarding--signup) section.

## Where the code lives
`landing-page/src/app/` · `panfleto-core/internal/ui/user_onboarding.go` ·
`internal/ui/oauth2_callback.go` · `internal/template/templates/views/add_subscription.html`

## Epics

| # | Epic | Status | Risk | Appetite |
|---|---|---|---|---|
| 9 | [`onboarding-provisioning-reliability`](onboarding-provisioning-reliability/README.md) — a new signup should not be a coin flip | 📋 scaffolded | low | S |

**Sequencing note:** best built *after* `miniflux-upstream-resync` sprint 3, which consolidates the
starter-feed list into one `feeds.json`. Building it first means writing the feed health check twice.
