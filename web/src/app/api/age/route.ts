import { fail, json } from "@/lib/api";
import { ageDecision } from "@/lib/safety";
import { currentProfile, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Records the 13+ answer. The person cannot set this column themselves. */
export async function POST(request: Request) {
  const { user, profile } = await currentProfile();
  if (!user || !profile) return fail("sign_in_required", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const body = await request.json().catch(() => ({})) as { answer?: unknown };
  const decision = ageDecision(body.answer, Boolean(profile.age_blocked));
  if (decision === "reject") {
    return fail(profile.age_blocked ? "age_blocked" : "answer_required", profile.age_blocked ? 403 : 400);
  }
  const db = supabaseAdmin();
  if (decision === "block") {
    const { error } = await db.from("profiles").update({ age_blocked: true, age_confirmed_at: null }).eq("id", user.id);
    if (error) return fail("could_not_save", 500);
    return json({ ok: true, blocked: true });
  }
  const { error } = await db.from("profiles").update({ age_confirmed_at: new Date().toISOString(), age_blocked: false }).eq("id", user.id);
  if (error) return fail("could_not_save", 500);
  return json({ ok: true, blocked: false });
}
