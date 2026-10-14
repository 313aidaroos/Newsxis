import { fail, json } from "@/lib/api";
import { profilePatch } from "@/lib/profile-patch";
import { ageAllowsUse, reporterSeatActive, showGraphicMedia } from "@/lib/safety";
import { currentProfile, supabaseUser } from "@/lib/supabase/server";
import { apixisSubOf } from "@/lib/apixis-login";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, profile } = await currentProfile();
  if (!user) return json({ ok: true, signedIn: false, profile: null });
  const seat = reporterSeatActive(profile);
  return json({
    ok: true,
    signedIn: true,
    email: user.email,
    linked: Boolean(apixisSubOf(user)),
    profile,
    canPost: seat,
    ageOk: ageAllowsUse(profile),
    showGraphic: showGraphicMedia(profile?.show_graphic_media),
  });
}

export async function PATCH(request: Request) {
  const { user } = await currentProfile();
  if (!user) return fail("sign_in_required", 401);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const parsed = profilePatch(body);
  if (parsed.error) return fail(parsed.error);
  if (Object.keys(parsed.patch).length === 0) return fail("nothing_to_save");
  const db = await supabaseUser();
  const { data, error } = await db.from("profiles").update(parsed.patch).eq("id", user.id).select("*").single();
  if (error) return fail(error.message.includes("unique") ? "username_taken" : error.message, 400);
  return json({ ok: true, profile: data });
}
