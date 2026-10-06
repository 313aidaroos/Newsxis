import { fail, json } from "@/lib/api";
import { currentProfile, supabaseUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Subscribe to breaking alerts: { channel: "expo"|"email"|"push", endpoint: {...}, lat, lng, radius_km, country, min_severity } */
export async function POST(request: Request) {
  const { user, profile } = await currentProfile();
  if (!user) return fail("sign_in_required", 401);
  const b = await request.json().catch(() => ({})) as Record<string, unknown>;
  const channel = b.channel;
  if (channel !== "expo" && channel !== "email" && channel !== "push") return fail("bad_channel");
  const endpoint = channel === "email" ? { email: user.email } : (b.endpoint as Record<string, string> | undefined);
  if (!endpoint) return fail("endpoint required");
  const db = await supabaseUser();
  const { data, error } = await db.from("alert_subscriptions").insert({
    user_id: user.id, channel, endpoint,
    lat: Number.isFinite(b.lat) ? b.lat : profile?.home_lat ?? null, lng: Number.isFinite(b.lng) ? b.lng : profile?.home_lng ?? null,
    radius_km: Math.min(1000, Math.max(5, Number(b.radius_km ?? 50))), country: typeof b.country === "string" ? b.country.toUpperCase() : profile?.home_country ?? null,
    min_severity: Math.min(5, Math.max(1, Number(b.min_severity ?? profile?.alert_min_severity ?? 4))),
  }).select("id").single();
  if (error) return fail(error.message, 500);
  return json({ ok: true, id: data.id });
}

export async function DELETE(request: Request) {
  const { user } = await currentProfile();
  if (!user) return fail("sign_in_required", 401);
  const id = new URL(request.url).searchParams.get("id");
  const db = await supabaseUser();
  const q = db.from("alert_subscriptions").delete().eq("user_id", user.id);
  await (id ? q.eq("id", id) : q);
  return json({ ok: true });
}
