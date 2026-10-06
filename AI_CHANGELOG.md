# AI change log

Every AI model, bot or agent that changes anything in this repo appends a dated entry here (what + why).

## 2026-10-06 — Claude (lead developer): first build
- Interviewed the owner (two rounds of questions) and wrote the decisions into `PLAN.md`.
- Scaffolded the repo: `web/` (Next.js 15 site), `supabase/migrations/001_newsxis.sql`, `workers/` (radio listener), `mobile/` (Expo), `docs/`.
- Copied the Apixis family SDK (Wallet, Apixis ID login, world agent, Cixy core, feed-client) from Socixis / ApixisWallet without changes.
- Built: 3D globe (MapLibre, satellite zoom), live feed, story threads (research / Another side / corrections), Cixy briefings page, radio page, Apixis ID login, Wallet chip, reporter activation via Wallet redeem, admin dashboard, cron ingest for RSS / GDELT / USGS / NWS / GDACS, Claude classification + research, ElevenLabs TTS, Bluesky / X / Facebook posters.
- Why: the owner asked for Newsxis to be created "first try" with the whole plan laid down.
