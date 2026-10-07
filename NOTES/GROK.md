# Grok notes

## 2026-10-06 — Security, billing, age, graphic media

Branch `cursor/security-billing-safety-c08c`. Pull request: https://github.com/313aidaroos/Newsxis/pull/1. Undo by reverting commit `6c18420`, or by closing that pull request without merging. Do not merge from this note.

### Why migration 003 is new
`001_newsxis.sql` and `002_seed_sources.sql` are the scripts `docs/SETUP.md` tells the owner to paste. They may already be applied. Editing them would not change a database that has already run them. `003_security.sql` applies the locks either way. Run it after 001 and 002.

### Master admins
`public.master_admins` is the list. Seeded with alaidaroosawad@gmail.com and awad@apixis.dev. The support mailbox newsxis@apixis.dev is rejected. Policies do not contain email addresses. `profiles.is_owner` is set from that table at signup.

### Wallet gaps (nothing faked)
The copied Wallet SDK (v3.1) does not have these routes yet. Newsxis calls them and shows a coming-soon or empty state when they 404:

1. `POST /api/v1/checkout` — card checkout for the reporter seat (`lookup_keys`, `method: "card"`, `apixis_product: "newsxis"`).
2. `POST /api/v1/subscribe` — Ixis plan that auto-renews (`method: "ixis"`).
3. `GET /api/v1/billing/payments?product=newsxis` — history with date, amount, description, and card or Ixis.
4. `GET /api/v1/billing/subscriptions?product=newsxis` — next renewal and cancel-at-period-end.
5. `POST /api/v1/billing/subscriptions/cancel` — cancel at the end of the paid period.

Catalog keys the Wallet still needs: `newsxis_reporter_activation`, `newsxis_reporter_monthly`, `newsxis_boost_story_onetime`, `newsxis_sponsor_briefing_onetime` (aliases of the dotted SKUs). Sponsorship checkout is not sold yet (`not_available_yet`).

What already exists and is used: Ixis `redeem()` (one charge, not auto-renew), `entitlements()` (`renews_at` when the Wallet sends it), and `walletBalance()` history for Ixis lines only. A billing page visit copies a real active entitlement’s `renews_at` onto the profile. It does not invent a date.

Newsxis has no Stripe keys and no Stripe SDK.
