# Newsxis mobile (Expo, iOS + Android)

Phase 1: a native shell around the Newsxis site (same globe, feed, radio, Cixy, account) with native
push notifications for breaking news and background audio for Newsxis Radio. Phase 2 moves the globe and
feed to native screens on the same `/api/*` routes.

```bash
cd mobile && npm install
npx expo start              # scan with Expo Go
npx eas build -p ios        # store builds (Apple $99/yr, Google $25 once)
```
Set `extra.siteUrl` in `app.json` to the live site. Replace `assets/icon.png` with a 1024×1024 PNG export of `assets/icon.svg`.
