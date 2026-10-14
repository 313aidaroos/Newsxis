# Newsxis launch readiness

Official launch: **1 January 2027**. Marketing starts **1 December 2026**. Beta is now. Facebook Page is live at `https://www.facebook.com/profile.php?id=61595105653913`. That address is the default. `NEXT_PUBLIC_FACEBOOK_PAGE_URL` overrides it.

Branch under review: `cursor/launch-legal-seo-2a3f` (PR #2). Base is `master`, which includes PR #1. Supabase `olwnstniusyyaswxboux` has migrations 001–004 applied. This note does not merge anything and does not change Vercel or Supabase settings.

## Done

- The site, globe, live feed, story threads (research, Another side, corrections), Cixy briefings, radio page, admin, ingest crons (RSS, GDELT, USGS, NWS, GDACS), classification, research, and ElevenLabs TTS are in the repo.
- Sign-in is Apixis ID only. The login page has no email or password form. `/auth/apixis/start` refuses to start until the 13+ cookie is set. Sign-in links on the post page, the family feed, and the wallet chip go to `/login` first.
- 13+ is stored on the profile. A no answer blocks the account. Graphic media is off until an explicit opt-in, then blurred until hover. `/post` requires a session.
- Reporter prices are $10 (1,000 Ixis) to activate and $10 (1,000 Ixis) a month. Sponsor briefing is 5,000 Ixis ($50) in the catalog. Card and Ixis checkout call the Apixis Wallet. There is no Stripe SDK and no Stripe key in Newsxis. `/billing` shows Wallet rows only when the Wallet returns them, and says so when a route is missing.
- Security migrations 003 and 004 are in the repo. 001–004 are applied on the Newsxis project. Public reads are live stories, threads, briefings, and sources.
- Terms (`/terms`) and privacy (`/privacy`) state 13+, the AI label, the correction policy, and that emails and IP addresses are kept for fraud, tax, and legal purposes.
- Root metadata, story Open Graph and Twitter cards, `robots.txt`, and `sitemap.xml` are in the site.
- A completed Wallet purchase is written to `revenue_events` and shown on `/billing`, with a receipt page at `/billing/receipt/[id]`. The sponsor item is 5,000 Ixis ($50): card goes to Wallet Checkout, Ixis uses Wallet redeem. If the Wallet route is missing, the page says so and does not invent a payment. `005_receipts.sql` adds a buyer read policy. Receipts record without it, using columns from migration 001. It is not applied to the live database from this repo.
- The Facebook Page links to `https://www.facebook.com/profile.php?id=61595105653913` when `NEXT_PUBLIC_FACEBOOK_PAGE_URL` is unset. A set env value overrides it and must still be https on facebook.com, m.facebook.com, or fb.com, including `profile.php?id=`. That profile form is a link on About. A vanity Page URL can still embed. An invalid override leaves the slot empty.
- Socixis Social is a tab on `/feed`. It calls the copied family feed client (`Apixis.dev /api/feed/*`) only when `APIXIS_WORLD_KEY` is set or `SOCIXIS_FEED=on`. Otherwise the tab says the feed is not connected.
- The opt-in daily report runs at 8:00 PM America/Chicago (`/api/cron/daily-report`, hourly cron that checks the Central hour). A model summary is labeled AI. An empty day says the feed was empty and is not labeled as model writing. Stories with no model available are not summarized.
- X, Facebook, and Bluesky posts stay queued when the platform keys are missing. X text is capped at 280 characters. A failed image upload does not drop the text post. The social cron is scheduled.

## Still to do

### Agent can do

Nothing in this list is still unbuilt. Phase 2 items (licensed scanners, the mobile store listings, per-country social accounts, the 24/7 radio stream) wait on accounts and keys, which are below.

### Needs Awad

- Approve and merge PR #1 and the draft launch PRs. This work does not merge them.
- Keys and dashboard env (values are not written here): `SUPABASE_SERVICE_ROLE_KEY` if still unset on Vercel, `WALLET_API_KEY`, `APIXIS_CLIENT_ID`, `APIXIS_WORLD_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `CRON_SECRET` for production, `TOKEN_ENC_KEY`, `NEXT_PUBLIC_MAPTILER_KEY`, social tokens, and `NEXT_PUBLIC_FACEBOOK_PAGE_URL` only if the Page address should override the built-in profile URL.
- Supabase Auth dashboard: leaked-password protection, and the Auth connection cap if it should be a percentage instead of a fixed 10.
- Vercel deployment protection is on for every deployment, including production. Changing that is a dashboard setting.
- Apply `supabase/migrations/006_daily_report.sql` in the Supabase SQL editor. The opt-in column and the report table are not on the live database. This session does not apply them. 005 is optional for receipts.
- Apixis Wallet repo (not this repo): catalog SKUs `newsxis_reporter_activation`, `newsxis_reporter_monthly`, `newsxis_boost_story_onetime`, `newsxis_sponsor_briefing_onetime`, and the routes `POST /api/v1/checkout`, `POST /api/v1/subscribe`, `GET /api/v1/billing/payments`, `GET /api/v1/billing/subscriptions`, `POST /api/v1/billing/subscriptions/cancel`. Register the Newsxis callback and the Buy Ixis return host. Apixis.dev must allow client `newsxis` and issue the feed key.
