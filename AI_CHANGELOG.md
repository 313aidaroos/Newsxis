# AI change log

Every AI model, bot or agent that changes anything in this repo appends a dated entry here (what + why).

## 2026-10-06 — Grok: Supabase advisor migration 004
- New `supabase/migrations/004_advisor_fixes.sql`. 001–003 are unchanged. `profiles_public` is `security_invoker = true`. It reads `private.profile_directory()`, which returns only the public columns for people who are not banned and not age-blocked. A public read policy on `profiles` cannot hide columns, and the signed-in app still reads its own full row, so other people's home coordinates and Apixis ids stay off that table for anon (no policy) and for authenticated (own row, or an owner).
- `set_updated_at`, `stories_near`, `is_owner` and every other public function have a fixed search path. `pg_trgm` moves to `extensions`. `handle_new_user` and `sync_owner_flags` are not executable by anon or authenticated; signup still runs as `supabase_auth_admin`, and the server keeps `take_request_allowance`. The 13 listed policies use `(select auth.uid())`. `reactions self` is insert, update and delete. Server-only tables have an explicit no-access policy. The listed foreign keys are indexed. Message membership checks qualify `messages.conversation_id` (an unqualified name bound to the inner alias and matched every conversation).
- Undo the migration file: revert the commit that adds this entry on branch `cursor/security-billing-safety-c08c`, or close https://github.com/313aidaroos/Newsxis/pull/1 without merging. There is no down migration. After 004 is applied, restore the database or drop the objects.

## 2026-10-06 ~9:33 PM CT — Supabase project `newsxis` (no code)
- Supabase project `newsxis` (ref olwnstniusyyaswxboux, us-east-1, org aqrfqmskbwxyfdzaibue, $10/mo) was created after Awad approved.
- Undo: pause or delete it in the Supabase dashboard.

## 2026-10-06 ~9:35 PM CT — Migrations 001–003 applied (no code)
- Migrations 001, 002 and 003 were applied to that project as they are in the repo. 004 is to be applied after this pull request.
- Undo: there is no automatic down migration. Restore the database or drop the objects.

## 2026-10-06 — Vercel Preview Supabase env (no code)
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were set for Preview only on Vercel project `newsxis`. `SUPABASE_SERVICE_ROLE_KEY` is pending. Values are not recorded here.
- Undo: remove them in Vercel Settings, Environment Variables, or with `vercel env rm <NAME> preview`.

## 2026-10-06 — Supabase dashboard still to do (no code)
- Enable leaked-password protection in Auth settings. Consider changing the Auth database connection cap from a fixed 10 to a percentage.

## 2026-10-06 — Grok: home fetch loop, missing page, favicon
- The idle globe spin called `setCenter` every frame. That fired `moveend`, which updated the home view, which rebuilt the story and post fetch. `/api/stories` and `/api/posts` ran many times a second even in World mode, where the camera is not part of the query. Spin move-ends are ignored. Fetches run on a filter change, on World / This view, on a settled pan in This view (400ms), and every 45 seconds.
- A missing story or any unknown URL uses `web/src/app/not-found.tsx` (the dark newsroom page) instead of the default white 404.
- `/favicon.ico` and `/favicon.png` serve the existing globe mark.
- Undo: revert commit `f89ea14` on branch `cursor/security-billing-safety-c08c`, or close https://github.com/313aidaroos/Newsxis/pull/1 without merging.

## 2026-10-06 ~9:20 PM CT — Grok: Vercel project protection (no code)
- A Vercel project `newsxis` (prj_c5I3vU7jDzVlqqcsHsULBmAmzzoR, team 313aidaroos-projects) was created and linked to this repo, with root `web`. The first CLI deploy unintentionally went to production at newsxis.vercel.app. Vercel Authentication (SSO protection) is now ON for ALL deployments, production included, so every URL needs a Vercel login. Crons are left as-is; they return 401 because CRON_SECRET is set for Preview only.
- Undo: Vercel project settings, Deployment Protection, set Vercel Authentication back to 'Standard Protection' (previews only), or via API PATCH /v9/projects/newsxis with ssoProtection.deploymentType='preview'. This note does not change those settings.

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
