# Newsxis — the blueprint

Real-time news for every place on Earth. An AI (Cixy) listens to public radio, scanners and
free news feeds, writes the story, researches it, posts "Another side", reads it on air in a
soft, clear, slightly sci-fi voice, and pushes it to social media. People watch for free and
pay to post.

Owner: Awad (Apixis Dev LLC). Built 2026-10-06. Lead developer: Claude.

## Decisions (from the owner's answers, 2026-10-06)

| # | Topic | Decision |
|---|---|---|
| 1 | Scope | The whole world, down to counties/cities. Phase 1 starts in **NYC** plus the Middle East, Europe, Africa and the US. |
| 2 | Languages | English + Spanish first. Cixy speaks whatever language is common in the place she is covering. |
| 3 | Sources | Public radio, licensed scanner feeds, free RSS, GDELT, government alerts (NWS, USGS, GDACS). No paid wires. |
| 4 | Freshness | As soon as it happens. Radio is listened to 24/7 by a worker; feeds are polled every few minutes. |
| 5 | What goes in the feed | AI summary + headline + topic/region tags + source + timestamp, plus live listening to the source station. Full transcripts only where the station allows it. |
| 6 | Publishing | Cixy posts on her own, every post labeled AI-generated. The owner can pin, edit or remove anything from the phone (`/admin`). |
| 7 | Verification | Cixy researches each story; 2+ independent sources → **Confirmed**. Sources that disagree → an **Another side** reply in the thread; conflicting facts → **Disputed** tag. Corrections are posted in-thread when needed. |
| 8 | Tone | No political leaning. Traditional, old-school newsroom voice. |
| 9 | Breaking alerts | 10+ deaths, attacks/assassinations on officials, new wars, major strikes, disasters, plus anything big in the person's chosen area. |
| 10 | Graphic media | Allowed. Off by default for visitors and new accounts. A signed-in person can opt in from settings; it stays blurred until hover. 13+, and the age question is enforced at sign-in. |
| 11 | Anchor | **Cixy** — the shared Apixis persona, in a news-anchor role. Soft, clear, natural female voice with a sci-fi edge (ElevenLabs). Hourly world briefing, regional briefing every 3 hours, breaking news immediately, plus a 24/7 "Newsxis Radio" stream. |
| 12 | Map | Interactive 3D globe. Zoom from the world to a street in satellite view. Layers: stories, conflict zones, live radio stations, user posts, weather/disasters. Time slider over the last 7 days where Cixy narrates how an event unfolded. |
| 13 | Users | Watch free. Account (Apixis ID) to post. Posts can be text, photos, video, voice and live clips, all AI-moderated. Comments and reactions. Chat. People earn reporter reputation and Ixis. |
| 14 | Money | Activation $10 (1,000 Ixis) + $10 (1,000 Ixis) per month to post, auto-renewing, cancel anytime. The customer chooses card or Ixis. Both go through the Apixis Wallet, which is the only app with Stripe. Every charge is tagged product=newsxis. Ads (never on tragedy), sponsorships, donations. Every revenue stream is organized in `/admin`. |
| 15 | Social | X, Facebook, Bluesky. Auto-generated image cards. Accounts per country, per state and for big cities, owned by Apixis. Main account posts top stories about every 10 minutes, Bluesky every 3–5 minutes, Facebook 1–2/hour; local accounts only when something happens there. |
| 16 | Apixis family | Apixis ID sign-in, one Wallet, shared family feed, every new account gets an agent in the Apixis world. Geoxis may merge in later. |
| 17 | Back office | AI agents for support, complaints, marketing and ads, run from `/admin` (support email newsxis@apixis.dev). Designed now, built next. |
| 18 | Cost | As cheap as possible: free tiers, open-source Whisper on one small server, Claude Haiku for most stories. |
| 19 | Mobile | Native iOS/Android app (Expo) in `mobile/`. |

## Layout of this repo

```
web/        Next.js 15 site (Vercel Root Directory = web)
  src/app/            pages + API routes (incl. /api/cron/* run by Vercel Cron)
  src/components/     Globe, feed, story, radio, Cixy briefing, admin
  src/lib/            ai/ (Claude), ingest/ (feeds), social/, tts/, supabase/, apixis family SDK copies
  src/feed-client/    shared family feed (copy as-is from Socixis, never edited)
supabase/   migrations/ (apply with the Supabase MCP or SQL editor)
workers/    always-on Node worker: radio-listener (ffmpeg → Whisper/Deepgram → stories)
mobile/     Expo app (iOS + Android)
docs/       family rules, social checklist, costs
```

## How a story is born

```
radio stream ──ffmpeg──► 30s audio chunks ──Whisper/Deepgram──► transcript segments ─┐
RSS / GDELT / USGS / NWS / GDACS ──poll every 2–15 min────────────────────────────────┤
user post (after moderation) ────────────────────────────────────────────────────────┘
        │
        ▼  lib/ai/classify.ts (Claude Haiku)
   is this news? headline · summary · category · severity 1–5 · place (lat/lng, country, region, city, county) · language
        │
        ▼  dedupe against stories from the last 48h in the same area (title similarity + place)
   new story (status live, ai_label "Written by Cixy from <source>") ─ or ─ confirmation of an existing one
        │
        ▼  lib/ai/research.ts (Claude Sonnet + web search), only for severity ≥ 3 or 2+ sources
   thread: "What we found" (confirming sources) · "Another side" (sources that disagree) · Disputed tag
        │
        ├─► alerts (push/email) when severity ≥ 4 or inside a person's area
        ├─► social queue (image card + text) → X / Facebook / Bluesky by account scope
        └─► next Cixy briefing (hourly world, 3-hourly regional, breaking right away) → ElevenLabs → /radio
```

## Money (card or Ixis, the customer's choice, through the Apixis Wallet)

Newsxis does not hold Stripe keys and does not ship a Stripe SDK. The Wallet is the one checkout. At reporter checkout the customer picks card or Ixis. Card opens the Wallet's Checkout; Ixis debits the shared balance. The monthly seat auto-renews until they cancel. Access stays until the paid period ends. Billing history is `/billing`, read from the Wallet. Where a Wallet route is not shipped yet, the page says so and shows no made-up rows.

Wallet SKUs to add in `ApixisWallet/lib/catalog.ts` (owner approves):

| key | name | Ixis | days |
|---|---|---|---|
| `newsxis.activate` (`newsxis_reporter_activation`) | Reporter activation | 1,000 | — |
| `newsxis.reporter.monthly` (`newsxis_reporter_monthly`) | Reporter seat, auto-renewing | 1,000 | month |
| `newsxis.boost.story` | Pin a story to a city for 24h | 500 | — |
| `newsxis.sponsor.briefing` (`newsxis_sponsor_briefing_onetime`) | "This briefing is brought to you by…" (1 day, 1 region) | 5,000 | — |

Reporter earnings are tracked as `reporter_points` on the profile. Paying them out as Ixis is a
Wallet decision (family marketplace settle), so it is designed in but switched off until the Wallet lead adds it.

## Costs (month, Phase 1)

| Item | Cost |
|---|---|
| Vercel Pro (commercial site) | ~$20 |
| Supabase project `newsxis` on the Pro org | ~$10 |
| Radio worker (1 small VPS, or Oracle free tier) + open-source Whisper | $0–40 |
| Claude (Haiku for classification, Sonnet for research/briefings) | $20–100 |
| ElevenLabs voice | $0–22 |
| Map tiles (MapTiler free tier; satellite) | $0 until heavy traffic |
| Apple developer $99/yr · Google Play $25 once | — |

## Phases

1. **Now:** website live on Vercel, globe + feed, feeds ingested (RSS/GDELT/USGS/NWS), Cixy writes stories and threads, hourly world briefing, 3 NYC radio stations listened to, Bluesky + X posting from the main account, Apixis ID login, reporter activation through the Wallet.
2. Scanners (licensed), Spanish, 20 more stations (Middle East, Europe, Africa), per-country social accounts, alerts, user video posts, mobile app in the stores.
3. Time-slider narration, 24/7 Newsxis Radio, back-office agents (support, complaints, marketing, ads), Geoxis merge, ads + sponsorships.

## Legal notes (Apixis Dev LLC)
- Summaries + short quotes + link to the station. Full transcripts only with station permission.
- Scanner feeds only through licensed providers; Cixy strips private people's names, addresses and medical details.
- All-party consent state: never record calls; broadcast streams are public.
- Privacy policy must state IPs and emails are kept for fraud, tax and legal purposes (family rule).
- Terms: 13+, AI-generated label on every Cixy post, correction policy.
