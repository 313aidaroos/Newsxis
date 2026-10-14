/** Opt-in daily report at 8:00 PM America/Chicago. Labeled when a model wrote it. */

export const DAILY_REPORT_AI_LABEL = "Written by Cixy · AI-generated daily report";
export const DAILY_REPORT_EMPTY_LABEL = "Not a model summary. The feed had no live stories in this window.";

export function isEightPmCentral(now: Date): boolean {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).find((part) => part.type === "hour")?.value;
  return hour === "20";
}

/** Calendar date in America/Chicago, YYYY-MM-DD. */
export function centralDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type DailyReportDraft = { title: string; body: string; ai_label: string };

/**
 * Stories and no model script → null (do not invent a summary).
 * No stories → one true sentence, and it is not labeled as model writing.
 */
export function dailyReportDraft(dateKey: string, storyCount: number, script: string | null): DailyReportDraft | null {
  const title = `Daily report · ${dateKey}`;
  if (storyCount === 0) {
    return {
      title,
      body: "No live stories were published on Newsxis in the last 24 hours.",
      ai_label: DAILY_REPORT_EMPTY_LABEL,
    };
  }
  const text = script?.trim();
  if (!text) return null;
  return { title, body: text, ai_label: DAILY_REPORT_AI_LABEL };
}
