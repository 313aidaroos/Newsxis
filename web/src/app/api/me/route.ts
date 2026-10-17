import { fail, json } from "@/lib/api";
import { profilePatch } from "@/lib/profile-patch";
import { ageAllowsUse, reporterSeatActive, showGraphicMedia } from "@/lib/safety";
import { currentProfile, supabaseUser } from "@/lib/supabase/server";
import { apixisSubOf } from "@/lib/apixis-login";
import { apixisClientConfigured } from "@/lib/public-site";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, profile } = await currentProfile();
  const signInReady = apixisClientConfigured();
  if (!user) return json({ ok: true, signedIn: false, profile: null, signInReady });
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
    signInReady,
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
  if (error) {
    if (error.message.includes("unique")) return fail("username_taken", 400);
    if (/daily_report_opt_in/.test(error.message)) return fail("daily_report_not_ready", 503);
    return fail(error.message, 400);
  }
  return json({ ok: true, profile: data });
}
