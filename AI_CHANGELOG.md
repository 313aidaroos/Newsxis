# AI change log

Every AI model, bot or agent that changes anything in this repo appends a dated entry here (what + why).

## 2026-10-06 — Grok: security, Wallet billing, 13+, graphic media off
- New migration `supabase/migrations/003_security.sql` (001 and 002 were left as written). It may already have been applied from `docs/SETUP.md`, so a follow-up migration is what actually locks a live database. 003: privileged profile columns change only from the server; posts and comments insert only as pending and only through server routes; public profile view hides home coordinates and Apixis ids; media uploads are activated reporters writing their own folder; master admins are the two rows in `public.master_admins` (alaidaroosawad@gmail.com, awad@apixis.dev). newsxis@apixis.dev is not an admin.
- Payments follow the 2026-10-06 family billing plan. Card or Ixis, the customer's choice, through the Wallet. No Stripe SDK and no Stripe keys. `/billing` reads the Wallet and does not invent rows. Reporter seat is $10 activation plus $10 a month. Sponsor briefing (5,000 Ixis) is in `web/src/lib/products.ts`.
- Entity name is Apixis Dev LLC. Feed tab label is Socixis Social. Repo name in `docs/SETUP.md` is `313aidaroos/Newsxis`.
- Sign-in requires a 13+ answer, stored on the profile. Graphic media is off for visitors and new users; settings can turn it on, and then it stays blurred until hover.
- Undo: revert commit `6c18420` on branch `cursor/security-billing-safety-c08c`, or close https://github.com/313aidaroos/Newsxis/pull/1 without merging.

## 2026-10-06 — Claude (lead developer): first build
- Interviewed the owner (two rounds of questions) and wrote the decisions into `PLAN.md`.
- Scaffolded the repo: `web/` (Next.js 15 site), `supabase/migrations/001_newsxis.sql`, `workers/` (radio listener), `mobile/` (Expo), `docs/`.
- Copied the Apixis family SDK (Wallet, Apixis ID login, world agent, Cixy core, feed-client) from Socixis / ApixisWallet without changes.
- Built: 3D globe (MapLibre, satellite zoom), live feed, story threads (research / Another side / corrections), Cixy briefings page, radio page, Apixis ID login, Wallet chip, reporter activation via Wallet redeem, admin dashboard, cron ingest for RSS / GDELT / USGS / NWS / GDACS, Claude classification + research, ElevenLabs TTS, Bluesky / X / Facebook posters.
- Why: the owner asked for Newsxis to be created "first try" with the whole plan laid down.
