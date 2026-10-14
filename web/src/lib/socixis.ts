/**
 * Socixis Social is a thin client of Apixis.dev /api/feed/*.
 * Off unless the family feed key is set, or SOCIXIS_FEED is explicitly on.
 * An explicit off always wins. The tab stays visible and says the feed is not connected.
 */
type FeedEnv = { SOCIXIS_FEED?: string; APIXIS_WORLD_KEY?: string };

export function socixisFeedEnabled(env: FeedEnv = {
  SOCIXIS_FEED: process.env.SOCIXIS_FEED,
  APIXIS_WORLD_KEY: process.env.APIXIS_WORLD_KEY,
}): boolean {
  const flag = (env.SOCIXIS_FEED ?? "").trim().toLowerCase();
  if (flag === "off" || flag === "0" || flag === "false") return false;
  if (flag === "on" || flag === "1" || flag === "true") return true;
  return Boolean(env.APIXIS_WORLD_KEY?.trim());
}
