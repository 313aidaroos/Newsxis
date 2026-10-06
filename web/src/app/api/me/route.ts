import { fail, json } from "@/lib/api";
import { currentProfile, supabaseUser } from "@/lib/supabase/server";
import { apixisSubOf } from "@/lib/apixis-login";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, profile } = await currentProfile();
  if (!user) return json({ ok: true, signedIn: false, profile: null });
  const seat = Boolean(profile?.is_owner || (profile?.activated_at && profile?.reporter_active_until && Date.parse(profile.reporter_active_until) > Date.now()));
  return json({ ok: true, signedIn: true, email: user.email, linked: Boolean(apixisSubOf(user)), profile, canPost: seat });
}

const EDITABLE = ["username", "display_name", "bio", "avatar_url", "home_place", "home_country", "home_region", "home_city", "home_lat", "home_lng", "lang", "show_graphic_media", "alerts_push", "alerts_email", "alert_min_severity"] as const;

export async function PATCH(request: Request) {
  const { user } = await currentProfile();
  if (!user) return fail("sign_in_required", 401);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];
  if (typeof patch.username === "string") {
    patch.username = patch.username.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    if ((patch.username as string).length < 3) return fail("username_too_short");
  }
  const db = await supabaseUser();
  const { data, error } = await db.from("profiles").update(patch).eq("id", user.id).select("*").single();
  if (error) return fail(error.message.includes("unique") ? "username_taken" : error.message, 400);
  return json({ ok: true, profile: data });
}
