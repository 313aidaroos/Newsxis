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
