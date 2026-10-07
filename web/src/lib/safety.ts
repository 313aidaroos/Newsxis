/** Age attestation and graphic-media display. Pure helpers so the rules can be tested. */

export type AgeAnswer = "yes" | "no";

/** confirm = record 13+ · block = they said no · reject = not a real answer, or already blocked. */
export function ageDecision(answer: unknown, alreadyBlocked: boolean): "confirm" | "block" | "reject" {
  if (alreadyBlocked) return "reject";
  if (answer === "yes") return "confirm";
  if (answer === "no") return "block";
  return "reject";
}

export function ageAllowsUse(profile: { age_confirmed_at?: string | null; age_blocked?: boolean | null } | null | undefined): boolean {
  return Boolean(profile && profile.age_confirmed_at && !profile.age_blocked);
}

/**
 * Graphic media is off until a signed-in person opts in.
 * Off: do not render the file. On: show it blurred until hover.
 */
export function mediaPresentation(graphic: boolean, showGraphic: boolean): "show" | "blur" | "hide" {
  if (!graphic) return "show";
  if (!showGraphic) return "hide";
  return "blur";
}

/** Visitors and new accounts are off. Only an explicit true opts in. */
export function showGraphicMedia(value: boolean | null | undefined): boolean {
  return value === true;
}

export type ModerationDecision = "live" | "held" | "removed";

/** Every post and comment is inserted as pending. Publishing is a second server write. */
export function insertedStatus(): "pending" {
  return "pending";
}

/**
 * After moderation. `live` only when the moderator returned live.
 * No AI answer is held, never published.
 */
export function statusAfterModeration(decision: ModerationDecision | null, aiAvailable: boolean): "live" | "held" | "removed" | "pending" {
  if (!aiAvailable || !decision) return "held";
  if (decision === "live") return "live";
  if (decision === "removed") return "removed";
  return "held";
}

export function reporterSeatActive(
  profile: { is_owner?: boolean; activated_at?: string | null; reporter_active_until?: string | null } | null | undefined,
  now = Date.now(),
): boolean {
  if (!profile) return false;
  if (profile.is_owner) return true;
  if (!profile.activated_at || !profile.reporter_active_until) return false;
  const until = Date.parse(profile.reporter_active_until);
  return Number.isFinite(until) && until > now;
}
