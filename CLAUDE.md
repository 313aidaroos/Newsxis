# CLAUDE.md — Newsxis

Read `PLAN.md` first (the owner's decisions), then `docs/APIXIS_FAMILY.md` before touching auth,
Ixis, billing, Cixy or the feed. The family source of truth is `313aidaroos/ApixisWallet → AGENTS.md`.

## What this is
Real-time world news, by place, written and read on air by **Cixy** (the one shared Apixis persona,
here in a news-anchor role). Website in `web/` (Next.js, Vercel Root Directory `web`), always-on radio
worker in `workers/`, mobile app in `mobile/`, SQL in `supabase/migrations/`.

## Rules
- **One Cixy.** Build her prompt with `cixySystemPrompt(NEWSXIS_ROLE)` from `web/src/lib/apixis-cixy.ts` (a copy of the family SDK; never edit the copy, change it in ApixisWallet then copy). No politics, no leaning, traditional newsroom voice. Every Cixy post carries `ai_label`.
- **One Wallet, one login.** `web/src/lib/apixis-wallet.ts`, `apixis-login.ts`, `apixis-redirect.ts`, `apixis-world*.ts` and `web/src/feed-client/*` are byte-for-byte copies from the family. Never fork them. Customers pay by card or Ixis, their choice, through the Wallet. This site never keeps an Ixis balance and never holds Stripe keys.
- **Never fake news.** If the AI brain, the feed or a source is unavailable, say so (503), never invent a story, a quote, a balance or a source. Every story links to where it came from.
- **Copyright.** Summaries + short quotes + link. Full transcripts only where `sources.allows_transcript` is true. Scanner audio only from licensed providers, with private details stripped.
- **Secrets are server-only.** `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WALLET_API_KEY`, `APIXIS_WORLD_KEY`, `ELEVENLABS_API_KEY`, `DEEPGRAM_API_KEY`, social tokens, `CRON_SECRET`. Never in `NEXT_PUBLIC_*`, never logged.
- **Migrations ship with RLS.** Public can read live stories/threads/briefings/sources only. Everything else is owner-scoped or service-role.
- **AI change log (owner's standing rule):** any AI model, bot or agent that changes anything in this repo appends a dated entry to `AI_CHANGELOG.md`. No exceptions.

## Commands
```
cd web && npm install && npm run dev      # site
cd web && npm run check                   # lint + typecheck + build
cd workers && npm install && npm run listen   # radio listener (needs ffmpeg)
cd mobile && npm install && npx expo start    # app
```
