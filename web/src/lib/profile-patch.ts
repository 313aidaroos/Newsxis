/** Fields a person may change on their own profile. Privileged columns are dropped. */

export const PROFILE_EDITABLE = [
  "username",
  "display_name",
  "bio",
  "avatar_url",
  "home_place",
  "home_country",
  "home_region",
  "home_city",
  "home_lat",
  "home_lng",
  "lang",
  "show_graphic_media",
  "alerts_push",
  "alerts_email",
  "alert_min_severity",
] as const;

export type ProfileEditable = (typeof PROFILE_EDITABLE)[number];

const PRIVILEGED = [
  "is_owner",
  "activated_at",
  "reporter_active_until",
  "verified_reporter",
  "banned",
  "reporter_points",
  "apixis_sub",
  "age_confirmed_at",
  "age_blocked",
  "id",
] as const;

export function profilePatch(body: Record<string, unknown>): { patch: Record<string, unknown>; error?: "username_too_short" } {
  const patch: Record<string, unknown> = {};
  for (const key of PROFILE_EDITABLE) {
    if (key in body) patch[key] = body[key];
  }
  for (const key of PRIVILEGED) delete patch[key];
  if (typeof patch.username === "string") {
    patch.username = patch.username.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    if ((patch.username as string).length < 3) return { patch, error: "username_too_short" };
  }
  if ("show_graphic_media" in patch) patch.show_graphic_media = patch.show_graphic_media === true;
  if ("alert_min_severity" in patch) {
    const n = Number(patch.alert_min_severity);
    patch.alert_min_severity = n === 3 || n === 4 || n === 5 ? n : 4;
  }
  return { patch };
}
