# Newsxis launch readiness

Official launch: **1 January 2027**. Marketing starts **1 December 2026**. Beta is now. Facebook Page is live at `https://www.facebook.com/profile.php?id=61595105653913`. That address is the default. `NEXT_PUBLIC_FACEBOOK_PAGE_URL` overrides it.

Branch under review: `cursor/security-billing-safety-c08c` (PR #1, not merged). Master is the first build. Supabase `olwnstniusyyaswxboux` has migrations 001–004 applied. This note does not merge anything and does not change Vercel or Supabase settings.

## Done

- The site, globe, live feed, story threads (research, Another side, corrections), Cixy briefings, radio page, admin, ingest crons (RSS, GDELT, USGS, NWS, GDACS), classification, research, and ElevenLabs TTS are in the repo.
- Sign-in is Apixis ID only. The login page has no email or password form. `/auth/apixis/start` refuses to start until the 13+ cookie is set. Sign-in links on the post page, the family feed, and the wallet chip go to `/login` first.
- 13+ is stored on the profile. A no answer blocks the account. Graphic media is off until an explicit opt-in, then blurred until hover. `/post` requires a session.
- Reporter prices are $10 (1,000 Ixis) to activate and $10 (1,000 Ixis) a month. Sponsor briefing is 5,000 Ixis ($50) in the catalog. Card and Ixis checkout call the Apixis Wallet. There is no Stripe SDK and no Stripe key in Newsxis. `/billing` shows Wallet rows only when the Wallet returns them, and says so when a route is missing.
- Security migrations 003 and 004 are in the repo. 001–004 are applied on the Newsxis project. Public reads are live stories, threads, briefings, and sources.
- Terms (`/terms`) and privacy (`/privacy`) state 13+, the AI label, the correction policy, and that emails and IP addresses are kept for fraud, tax, and legal purposes.
- Root metadata, story Open Graph and Twitter cards, `robots.txt`, and `sitemap.xml` are in the site.
- The Facebook Page links to `https://www.facebook.com/profile.php?id=61595105653913` when `NEXT_PUBLIC_FACEBOOK_PAGE_URL` is unset. A set env value overrides it and must still be https on facebook.com, m.facebook.com, or fb.com, including `profile.php?id=`. That profile form is a link on About. A vanity Page URL can still embed. An invalid override leaves the slot empty.
- Socixis Social is a tab on `/feed` using the copied family feed client (`Apixis.dev /api/feed/*`).
- X, Facebook, and Bluesky poster functions exist and the social cron is scheduled.

## Still to do

### Agent can do

- Record a receipt for every completed Wallet purchase and show it on the billing history page, including the sponsor item, without inventing rows when the Wallet is down.
- Put the Socixis Social tab behind a flag when `APIXIS_WORLD_KEY` is missing, so the tab does not call a feed that is not connected.
- Opt-in daily report at 8:00 PM America/Chicago, labeled AI, written only from stories already on the site.
- Leave social posts queued when X, Facebook, or Bluesky keys are missing, and keep X text inside the platform limit.
- Tests for those paths.

### Needs Awad

- Approve and merge PR #1 and the draft launch PRs. This work does not merge them.
- Keys and dashboard env (values are not written here): `SUPABASE_SERVICE_ROLE_KEY` if still unset on Vercel, `WALLET_API_KEY`, `APIXIS_CLIENT_ID`, `APIXIS_WORLD_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `CRON_SECRET` for production, `TOKEN_ENC_KEY`, `NEXT_PUBLIC_MAPTILER_KEY`, social tokens, and `NEXT_PUBLIC_FACEBOOK_PAGE_URL` only if the Page address should override the built-in profile URL.
- Supabase Auth dashboard: leaked-password protection, and the Auth connection cap if it should be a percentage instead of a fixed 10.
- Vercel deployment protection is on for every deployment, including production. Changing that is a dashboard setting.
- Apixis Wallet repo (not this repo): catalog SKUs `newsxis_reporter_activation`, `newsxis_reporter_monthly`, `newsxis_boost_story_onetime`, `newsxis_sponsor_briefing_onetime`, and the routes `POST /api/v1/checkout`, `POST /api/v1/subscribe`, `GET /api/v1/billing/payments`, `GET /api/v1/billing/subscriptions`, `POST /api/v1/billing/subscriptions/cancel`. Register the Newsxis callback and the Buy Ixis return host. Apixis.dev must allow client `newsxis` and issue the feed key.
