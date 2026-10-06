# Newsxis — owner setup (push-button order)

Do these in order. Each one is a copy/paste. Nothing is faked: the site shows exactly which pieces are connected at `/api/health`.

## 1. Supabase (the database) — ~$10/month
1. supabase.com → Apixis Family Company org → **New project** → name `newsxis`, region `us-east-1`, strong password.
2. SQL Editor → paste `supabase/migrations/001_newsxis.sql` → Run. Then `002_seed_sources.sql` → Run.
3. Project Settings → API: copy **Project URL**, **anon key**, **service_role key**.
4. Authentication → URL configuration: Site URL = your Vercel URL; add `https://<vercel-url>/auth/apixis/callback` to redirect URLs.

## 2. Vercel (the website) — free to test, Pro ($20/mo) at launch
1. vercel.com → Add New → Project → import `313aidaroos/Newsxis-` → **Root Directory: `web`** → Deploy.
2. Settings → Environment Variables: everything in `web/.env.example`. Minimum to see news flowing:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET` (any long random string), `NEXT_PUBLIC_SITE_URL`.
3. Redeploy. Vercel Cron (in `web/vercel.json`) starts: feeds every 3 min, Cixy writes stories every 2 min, research every 5 min, world briefing hourly.
4. Open `/api/health` — every `true` is a connected piece.

## 3. Map tiles (satellite zoom) — free tier
cloud.maptiler.com → API key → Vercel env `NEXT_PUBLIC_MAPTILER_KEY`. Without it the globe uses OpenStreetMap (no satellite).

## 4. Cixy's voice — ElevenLabs (free tier first)
elevenlabs.io → pick/design a soft, clear female voice → copy the Voice ID → env `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.

## 5. Apixis family keys (ask the Wallet lead / run in ApixisWallet)
`npm run family-keys -- --only newsxis` → `WALLET_API_KEY`, `APIXIS_CLIENT_ID=newsxis`; register the callback; add the SKUs in `docs/APIXIS_FAMILY.md`; Apixis.dev issues `APIXIS_WORLD_KEY` and adds `newsxis` to its enter-client list.

## 6. Radio listener (24/7) — one small server
See `workers/README.md`. Set `WORKER_KEY` (same value) in Vercel and on the server.

## 7. Social accounts
`docs/SOCIAL_CHECKLIST.md`. Connect each from `/admin` → Social (tokens are stored encrypted; set `TOKEN_ENC_KEY` = `openssl rand -base64 32`).

## 8. Mobile app
`mobile/README.md`. Needs Apple Developer ($99/yr) and Google Play ($25) accounts under Apixis Family Company.

## 9. You are the editor
Sign in with Apixis using awad@apixis.dev or alaidaroosawad@gmail.com → `/admin` appears in the nav (pin, edit, hold, remove, approve reporters, sources, social, tickets, agent log).
