# Social accounts checklist (owner)

Newsxis cannot create social accounts. Create them under Apixis Dev LLC, then paste the keys into
`/admin/social` (or Vercel env for the main account). Start with the main account; add locals as regions go live.

## Naming
- Main: `@newsxis`
- Country: `@newsxis_<iso2>` → `@newsxis_us`, `@newsxis_gb`, `@newsxis_eg`
- US state: `@newsxis_<state>` → `@newsxis_ny`, `@newsxis_il`
- Big city: `@newsxis_<city>` → `@newsxis_nyc`, `@newsxis_london`, `@newsxis_cairo`
Same handle on every platform where it is free. Bio: "AI-written real-time news for <place>, read by Cixy. Owned by Apixis Dev LLC. Every post is AI-generated and links to its source."

## Bluesky (easiest, do first)
1. Create the account at bsky.app → Settings → App Passwords → create one.
2. Env: `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`. Label the account as automated in its bio.
3. Rate: a post every 3–5 minutes is fine.

## X
1. developer.x.com → create a project + app → OAuth 2.0 user context, scopes `tweet.read tweet.write users.read offline.access`.
2. The free tier allows only ~1,500 posts/month per app. Every 10 minutes = ~4,300/month, so **Basic ($200/month at last check; verify)** is needed for the main account. Locals fit on free.
3. Env: `X_CLIENT_ID`, `X_CLIENT_SECRET`; connect each account from `/admin/social` (OAuth, token stored encrypted).

## Facebook
1. Create a Page per account; developers.facebook.com → app → Facebook Login + `pages_manage_posts`, `pages_read_engagement`.
2. The app must pass App Review before it can post to Pages other than the developer's. Until then, post manually or only from the owner's own Pages.
3. Env: `META_APP_ID`, `META_APP_SECRET`; connect Pages from `/admin/social`. Keep to 1–2 posts an hour per Page.

## Posting rules (built in)
- Main account: top stories (severity ≥ 3), at most one post every 10 minutes; breaking (severity 5) right away.
- Bluesky: every 3–5 minutes allowed; X and Facebook throttled as above.
- Local accounts: only stories inside their scope; no limit problems because volume is low.
- Never post graphic media to social. Every post: headline, 1-line summary, place, link to the story, auto-generated image card, "AI-written · source: <station/feed>".
