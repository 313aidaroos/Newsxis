/** When the home globe is allowed to refetch stories and posts. */

export const HOME_REFRESH_MS = 45_000;
export const VIEW_PAN_DEBOUNCE_MS = 400;

/** Passed to MapLibre `setCenter` so an idle-spin `moveend` is not a user pan. */
export const IDLE_SPIN_EVENT = "newsxisIdleSpin";

export type FeedReason = "filter" | "mode" | "pan" | "spin" | "refresh";
export type HomeMode = "world" | "view";

export function isIdleSpinMove(event: { newsxisIdleSpin?: boolean } | null | undefined): boolean {
  return event?.newsxisIdleSpin === true;
}

/**
 * World mode ignores camera motion (including the idle spin). This view refetches
 * after a settled pan. Filters, the World / This view switch, and the timer always refetch.
 */
export function feedReasonFetches(reason: FeedReason, mode: HomeMode): boolean {
  if (reason === "spin") return false;
  if (reason === "pan") return mode === "view";
  return reason === "filter" || reason === "mode" || reason === "refresh";
}

/** A story this fresh means the desk is actually receiving news. Older than this, the Live badge stays off. */
export const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

export function feedIsLive(publishedAt: Array<string | null | undefined>, now = Date.now()): boolean {
  return publishedAt.some((iso) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return Number.isFinite(t) && now - t >= 0 && now - t <= LIVE_WINDOW_MS;
  });
}

export function focusForStory(story: { lat: number | null; lng: number | null }): { lat: number; lng: number; zoom: number } | null {
  if (story.lat == null || story.lng == null || !Number.isFinite(story.lat) || !Number.isFinite(story.lng)) return null;
  return { lat: story.lat, lng: story.lng, zoom: 6 };
}

/** What Cixy can say without a model: only headlines already on the map. */
export function cixyReadout(stories: Array<{ headline: string; place?: string | null }>, reason: "empty" | "offline" | "rate"): string {
  const lines = stories.slice(0, 4).map((s) => (s.place ? `${s.headline} (${s.place})` : s.headline)).filter(Boolean);
  if (!lines.length) {
    if (reason === "rate") return "Cixy needs a short break. Nothing else is on the map in this window.";
    if (reason === "offline") return "Cixy cannot write a new script until her brain is connected. Nothing is on the map in this window.";
    return "Nothing is on the map in this window.";
  }
  const list = lines.join("; ");
  if (reason === "rate") return `Cixy needs a short break. Already on the map: ${list}.`;
  if (reason === "offline") return `Cixy cannot write a new script until her brain is connected. Already on the map: ${list}.`;
  return `Already on the map: ${list}.`;
}
