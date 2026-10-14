# Apixis family: shared login + shared Wallet + shared Cixy (read before touching auth, Ixis, Cixy or the feed)

Lead developer: Claude. Owner: Awad. The source of truth for the whole family is **ApixisWallet → `AGENTS.md`**
(and `docs/FAMILY_STATUS.md` there). This note is the short version for Newsxis.

## Rules
1. **One checkout: Apixis Wallet.** Customers pay by card or with Ixis, their choice, and both go through the Wallet. Newsxis never stores, grants or computes its own Ixis and never holds Stripe keys or a Stripe SDK. It redeems Ixis from the Wallet (`redeem()`), starts card or Ixis checkout through the Wallet (`/api/billing/checkout`), shows the shared balance (`/api/wallet/balance`) and links to Buy Ixis (`buyIxisUrl("newsxis", returnUrl)`). Every charge is tagged `product=newsxis`.
2. **These files are copies, never forks:** `web/src/lib/apixis-wallet.ts`, `apixis-login.ts`, `apixis-redirect.ts`, `apixis-world.ts`, `apixis-world-provision.ts`, `apixis-cixy.ts`, and `web/src/feed-client/*`. Change them in ApixisWallet / Socixis, then copy them here.
3. **Who pays is the Apixis ID `sub`.** Pass `owner: await apixisOwner(user.email)` to `redeem()`. Never this site's Supabase uid, never an email from the request body.
4. **Every paid action:** reserve → provision → capture. `already_captured` = the person was charged, keep access. Only a released hold means not charged.
5. **One Cixy.** `cixySystemPrompt(NEWSXIS_ROLE)`; the news-anchor role in `web/src/lib/ai/cixy-role.ts` is the only site-specific text.
6. **Every new account gets an Apixis world agent** (`provisionApixisWorldAgent({ client: "newsxis", … })` on first sign-in) with the shared Wallet. Apixis.dev must add `newsxis` to its enter-client allowlist.
7. **Family feed.** `/feed` shows the Newsxis news feed and, in a second tab, the shared family feed through `feed-client` with this site's skin. Cixy's stories are also cross-posted to the family feed as `posted_by: "cixy"` once Apixis.dev issues Newsxis a feed key.

## What is wired here
| Piece | Where |
|---|---|
| Sign in with Apixis | `/auth/apixis/start?next=…` → Wallet → `/auth/apixis/callback`; button in `components/SignInWithApixis.tsx` |
| Shared balance + Buy Ixis | `GET /api/wallet/balance`, `components/ApixisWalletChip.tsx` |
| Reporter activation / monthly seat | Card or Ixis via `POST /api/billing/checkout` (Wallet checkout / subscribe). One-time Ixis still: `POST /api/redeem` with `newsxis.activate` / `newsxis.reporter.monthly`. Billing history: `/billing` |
| World agent at signup | `GET /api/apixis/world-agent` |
| Family feed | `/feed?tab=family`, `GET /api/feed-session` (uses `APIXIS_WORLD_KEY`) |

## Asks for the Wallet lead (owner to approve)
- Mint keys for the new site: `npm run family-keys -- --only newsxis` in ApixisWallet → `WALLET_API_KEY`, `APIXIS_CLIENT_ID=newsxis`.
- Register callback `https://<newsxis-domain>/auth/apixis/callback` and add the host to the Buy-Ixis return allowlist.
- Add catalog SKUs: `newsxis.activate` (1,000, one-time, lookup `newsxis_reporter_activation`), `newsxis.reporter.monthly` (1,000, auto-renew monthly, lookup `newsxis_reporter_monthly`), `newsxis.boost.story` (500), `newsxis.sponsor.briefing` (5,000, lookup `newsxis_sponsor_briefing_onetime`).
- Ship the billing-plan routes Newsxis already calls: `POST /api/v1/checkout`, `POST /api/v1/subscribe`, `GET /api/v1/billing/payments`, `GET /api/v1/billing/subscriptions`, `POST /api/v1/billing/subscriptions/cancel`. Until those exist, Newsxis shows a coming-soon state and does not invent payments.
- Apixis.dev: add `newsxis` to `APIXIS_ENTER_CLIENTS` and issue a feed key (`APIXIS_WORLD_KEY`).
- Reporter payouts in Ixis: a family decision (marketplace settle). Designed in, switched off.

## Env (Vercel, project `newsxis`, root `web`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`,
`WALLET_API_KEY`, `APIXIS_CLIENT_ID=newsxis`, `APIXIS_WALLET_API_URL=https://apixis-wallet.vercel.app`, `APIXIS_WORLD_KEY`,
`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `DEEPGRAM_API_KEY` (optional), `CRON_SECRET`,
`NEXT_PUBLIC_MAPTILER_KEY`, `BLUESKY_HANDLE`/`BLUESKY_APP_PASSWORD`, `X_*`, `META_*`, `OWNER_EMAILS`.
