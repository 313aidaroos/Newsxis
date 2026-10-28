/** Retry schedule for a failed alert. Status stays on the existing text column so this works before any new migration. */

export const ALERT_MAX_ATTEMPTS = 5;
/** 2, 4, 8, 16, 32 minutes. The alerts cron runs every 2 minutes. */
export const ALERT_BACKOFF_MS = [2, 4, 8, 16, 32].map((minutes) => minutes * 60 * 1000);

export type AlertRetry = { due: boolean; attempts: number; terminal: boolean };

/** `sent` is done. `dead` will not be tried again. `failed` is a legacy row from before retries. `failed:<n>:<epochMs>` is the next time. */
export function alertRetryState(status: string, createdAt: string, now: number): AlertRetry {
  if (status === "sent") return { due: false, attempts: 0, terminal: true };
  if (status === "dead") return { due: false, attempts: ALERT_MAX_ATTEMPTS, terminal: true };
  if (status === "failed") {
    const dueAt = Date.parse(createdAt) + ALERT_BACKOFF_MS[0];
    return { due: Number.isFinite(dueAt) && now >= dueAt, attempts: 1, terminal: false };
  }
  const match = /^failed:(\d+):(\d+)$/.exec(status);
  if (!match) return { due: false, attempts: 0, terminal: true };
  const attempts = Number(match[1]);
  const dueAt = Number(match[2]);
  if (attempts >= ALERT_MAX_ATTEMPTS) return { due: false, attempts, terminal: true };
  return { due: now >= dueAt, attempts, terminal: false };
}

/** Status to store after a failed send. `attemptsSoFar` is how many sends have already failed. The attempt that reaches the cap is `dead` and is not loaded again. */
export function alertFailedStatus(attemptsSoFar: number, now: number): string {
  const next = attemptsSoFar + 1;
  if (next >= ALERT_MAX_ATTEMPTS) return "dead";
  const wait = ALERT_BACKOFF_MS[Math.min(next - 1, ALERT_BACKOFF_MS.length - 1)];
  return `failed:${next}:${now + wait}`;
}
