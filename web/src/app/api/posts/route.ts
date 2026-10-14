/**
 * User posts (reporters). GET: live posts (optionally near a point). POST: create (needs an active
 * reporter seat), AI-moderated before it goes live. Media is uploaded by the browser to the `media`
 * bucket under the person's own folder; the URLs are passed here.
 */
import { fail, json } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/anthropic";
import { moderateText } from "@/lib/ai/moderate";
import { ageAllowsUse, insertedStatus, reporterSeatActive, statusAfterModeration, type ModerationDecision } from "@/lib/safety";
import { currentProfile, serviceConfigured, supabaseAdmin, supabaseConfigured, supabaseUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!supabaseConfigured()) return json({ ok: true, items: [] });
  const p = new URL(request.url).searchParams;
  const db = serviceConfigured() ? supabaseAdmin() : await supabaseUser();
  let q = db.from("posts").select("id,author_id,body,media,kind,lang,status,place_name,country,region,city,lat,lng,story_id,likes,comments,created_at, author:profiles(id,username,display_name,avatar_url,verified_reporter)").eq("status", "live").order("created_at", { ascending: false }).limit(Math.min(100, Number(p.get("limit") ?? 50)));
  const bbox = p.get("bbox")?.split(",").map(Number);
  if (bbox?.length === 4 && bbox.every(Number.isFinite)) q = q.gte("lat", bbox[1]).lte("lat", bbox[3]).gte("lng", bbox[0]).lte("lng", bbox[2]);
  if (p.get("story")) q = q.eq("story_id", p.get("story")!);
  if (p.get("cursor")) q = q.lt("created_at", p.get("cursor")!);
  const { data } = await q;
  return json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const { user, profile } = await currentProfile();
  if (!user || !profile) return fail("sign_in_required", 401);
  if (profile.banned || profile.age_blocked) return fail("banned", 403);
  if (!ageAllowsUse(profile)) return fail("age_required", 403);
  const seatOk = reporterSeatActive(profile);
  if (!seatOk) return fail("reporter_seat_required", 402);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const body = await request.json().catch(() => ({})) as { body?: string; media?: Array<{ url: string; kind: string }>; kind?: string; lat?: number; lng?: number; place_name?: string; country?: string; region?: string; city?: string; story_id?: string };
  const text = (body.body ?? "").trim();
  const media = Array.isArray(body.media) ? body.media.filter((m) => typeof m.url === "string" && m.url.includes("/storage/v1/object/public/media/")).slice(0, 6) : [];
  if (!text && !media.length) return fail("empty_post");
  if (text.length > 4000) return fail("too_long");
  const db = supabaseAdmin();
  const hour = Math.floor(Date.now() / 3600e3);
  const { data: allowed } = await db.rpc("take_request_allowance", { bucket_key: `post:${user.id}:${hour}`, max_hits: 20, expiry: new Date((hour + 1) * 3600e3).toISOString() });
  if (allowed === false) return fail("rate_limited", 429);

  let decision: ModerationDecision | null = null;
  let moderation: Record<string, unknown> = { state: "pending" };
  let graphic = false;
  const aiOn = aiConfigured();
  if (aiOn) {
    try {
      const m = await moderateText(text || "(media only)", { hasMedia: media.length > 0, place: body.place_name ?? null });
      decision = m.decision; moderation = m as unknown as Record<string, unknown>; graphic = m.graphic;
    } catch { decision = null; moderation = { state: "held", reason: "moderation_unavailable" }; }
  } else { moderation = { state: "held", reason: "ai_not_configured" }; }
  const status = statusAfterModeration(decision, aiOn && decision !== null);
  if (status === "removed") return fail("post_rejected", 422, { reason: (moderation as { reason?: string }).reason ?? null });

  const kind = media.some((m) => m.kind === "video") ? "video" : media.some((m) => m.kind === "audio") ? "voice" : media.length ? "photo" : "text";
  const { data, error } = await db.from("posts").insert({
    author_id: user.id, body: text, media: media.map((m) => ({ ...m, graphic })), kind: body.kind === "live" ? "live" : kind, status: insertedStatus(), moderation,
    lat: Number.isFinite(body.lat) ? body.lat : profile.home_lat, lng: Number.isFinite(body.lng) ? body.lng : profile.home_lng,
    place_name: body.place_name ?? profile.home_place, country: body.country ?? profile.home_country, region: body.region ?? profile.home_region, city: body.city ?? profile.home_city,
    story_id: body.story_id ?? null,
  }).select("*").single();
  if (error || !data) return fail(error?.message ?? "could_not_save", 500);
  const { data: published, error: publishError } = await db.from("posts").update({ status, moderation }).eq("id", data.id).select("*").single();
  if (publishError || !published) return fail(publishError?.message ?? "could_not_save", 500);
  if (status === "live") await db.from("profiles").update({ reporter_points: profile.reporter_points + 5 }).eq("id", user.id);
  return json({ ok: true, post: published, status });
}
