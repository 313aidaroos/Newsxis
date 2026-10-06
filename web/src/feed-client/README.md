# feed-client (shared family feed, copy as-is)

Thin client for the shared Socixis Social feed (Apixis.dev `/api/feed/*`, contract `docs/FEED_API.md`).
Same files in every Ixis site; do not edit per site. Written 2026-10-04 by Grok for Awad.

- `api.ts`: typed fetch wrapper (token from the site's own `/api/feed-session`, refresh on `token_expired`).
- `hooks.ts`: React state (`useFeed`, `usePost`, `useComments`, `useProfile`, `useSearch`, `useTrending`).
- `FeedView.tsx`: structure + behavior only. No CSS. The host passes a `skin` of its OWN class names, and
  its own `feed.css` maps `--fx-*` to the host's CSS variables. No SVGs.

Per site you add: `/api/feed-session` (server, uses `APIXIS_WORLD_KEY`), a `/feed` page in the site's own
shell, a skin, a `feed.css`, and one nav item.
