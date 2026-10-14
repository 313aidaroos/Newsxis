# Grok notes

## 2026-10-06 — Advisor migration 004

Branch `cursor/security-billing-safety-c08c`. Pull request: https://github.com/313aidaroos/Newsxis/pull/1. Do not merge from this note. 001, 002 and 003 were not edited.

### Why the public profile view works this way
`profiles_public` had `security_invoker = false`, so it ran as the owner and skipped row security. It is now `security_invoker = true`.

Postgres policies are row policies. They cannot reveal `username` on someone else's row and hide `home_lat` on that same row. The signed-in site reads the caller's full profile (`select *`, age flags, home coordinates) with the user JWT, under "profiles self read". A second policy that lets authenticated read every profile would expose those private columns.

So the directory does not select from `profiles` as the caller. The view calls `private.profile_directory()`. That function is security definer, lives outside the exposed `public` schema, and returns only id, username, display name, avatar, bio, verified reporter, reporter points and created at, and only when `banned` and `age_blocked` are false. Anon and authenticated may select the view. Anon still has no SELECT policy on `profiles`. Authenticated still reads only their own row, unless `is_owner()` is true.

### Other advisor items
Every function in `public` gets `search_path = public, extensions`, including `set_updated_at`, `stories_near` and `is_owner`. `pg_trgm` is moved into `extensions`. The headline trigram index stays valid (`extensions.gin_trgm_ops`). API roles, and `authenticator` when that role exists, use that search path so `%` and `similarity()` still resolve.

`handle_new_user()` and `sync_owner_flags()` are revoked from public, anon and authenticated. Execute remains for `supabase_auth_admin` (signup trigger) and `service_role`. `take_request_allowance` stays service-role only, which is how the server calls it. `set_updated_at` and `protect_profile_privileges` stay executable by authenticated, because a signed-in person updates their own profile and those triggers fire.

The 13 named policies were dropped and recreated with `(select auth.uid())` and the same conditions. "reactions self" is insert, update and delete, so it no longer overlaps the public read. `alert_deliveries`, `master_admins` and `request_allowances` have an explicit deny for anon and authenticated. The service role still bypasses RLS. The foreign keys named in the advisor note each got an index. Unused indexes were left alone.

The old message policies said `m.conversation_id = conversation_id`. Inside that subquery Postgres binds the bare name to `m.conversation_id`, so the check was true for any conversation the person belongs to. 004 uses `messages.conversation_id`.

### Infra notes (nothing in this repo changed them)
(a) Supabase project `newsxis` (ref olwnstniusyyaswxboux, us-east-1, org aqrfqmskbwxyfdzaibue, $10/mo) was created 2026-10-06 ~9:33 PM CT after Awad approved. Undo: pause or delete it in the Supabase dashboard.

(b) Migrations 001–003 were applied ~9:35 PM CT. 004 is applied by the owner after this pull request, not from here. Undo: there is no automatic down migration. Restore the database or drop the objects.

(c) Vercel env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were set for Preview only on project newsxis. `SUPABASE_SERVICE_ROLE_KEY` is pending. Undo: remove them in Vercel Settings, Environment Variables, or with `vercel env rm <NAME> preview`. No secret values are written down.

(d) Still to do in the Supabase dashboard: enable leaked-password protection (Auth settings), and consider changing the Auth database connection cap from a fixed 10 to a percentage.

Undo the file: revert commit `f636594` on branch `cursor/security-billing-safety-c08c`, or close https://github.com/313aidaroos/Newsxis/pull/1 without merging.

## 2026-10-06 — Home fetch loop, missing page, favicon

Branch `cursor/security-billing-safety-c08c`. Pull request: https://github.com/313aidaroos/Newsxis/pull/1. Same pull request as the security work. Do not merge from this note.

The preview was calling `/api/stories` and `/api/posts` about 17 times a second. Cause: `Globe` idle spin uses `map.setCenter` every animation frame while zoom is under 2.2. MapLibre fires `moveend` for that jump. Home stored the new camera and rebuilt `load`, and `load` depended on `view` even in World mode, where the bbox is not sent. The spin now tags that jump (`newsxisIdleSpin`) and the listener drops it. Home refetches on hours, severity, or the World / This view switch immediately; a pan refetches only in This view, after 400ms of quiet; a 45s timer refreshes either mode. `web/src/lib/home-feed.ts` holds that rule so a test can check it without a map.

Unknown URLs, including `/story/<missing>`, render `web/src/app/not-found.tsx`. `/favicon.ico` and `/favicon.png` are the same mark as `web/src/app/icon.svg`.

Undo: revert commit `f89ea14` on branch `cursor/security-billing-safety-c08c`, or close https://github.com/313aidaroos/Newsxis/pull/1 without merging.

## 2026-10-06 ~9:20 PM CT — Vercel project protection (no code)

A Vercel project `newsxis` (prj_c5I3vU7jDzVlqqcsHsULBmAmzzoR, team 313aidaroos-projects) was created and linked to this repo, with root `web`. The first CLI deploy unintentionally went to production at newsxis.vercel.app. Vercel Authentication (SSO protection) is now ON for ALL deployments, production included, so every URL needs a Vercel login. Crons are left as-is; they return 401 because CRON_SECRET is set for Preview only.

Undo: Vercel project settings, Deployment Protection, set Vercel Authentication back to 'Standard Protection' (previews only), or via API PATCH /v9/projects/newsxis with ssoProtection.deploymentType='preview'. This note does not change those settings.

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
