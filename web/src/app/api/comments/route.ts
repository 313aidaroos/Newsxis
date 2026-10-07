import { fail, json } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/anthropic";
import { moderateText } from "@/lib/ai/moderate";
import { ageAllowsUse, insertedStatus, statusAfterModeration, type ModerationDecision } from "@/lib/safety";
import { currentProfile, serviceConfigured, supabaseAdmin, supabaseConfigured, supabaseUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!supabaseConfigured()) return json({ ok: true, items: [] });
  const p = new URL(request.url).searchParams;
  const db = serviceConfigured() ? supabaseAdmin() : await supabaseUser();
  let q = db.from("comments").select("id,author_id,story_id,post_id,parent_id,body,status,likes,created_at, author:profiles(id,username,display_name,avatar_url,verified_reporter)").eq("status", "live").order("created_at", { ascending: true }).limit(200);
  if (p.get("story")) q = q.eq("story_id", p.get("story")!);
  else if (p.get("post")) q = q.eq("post_id", p.get("post")!);
  else return fail("story or post required");
  const { data } = await q;
  return json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const { user, profile } = await currentProfile();
  if (!user || !profile) return fail("sign_in_required", 401);
  if (profile.banned || profile.age_blocked) return fail("banned", 403);
  if (!ageAllowsUse(profile)) return fail("age_required", 403);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const body = await request.json().catch(() => ({})) as { body?: string; story_id?: string; post_id?: string; parent_id?: string };
  const text = (body.body ?? "").trim();
  if (!text || text.length > 2000) return fail("bad_comment");
  if (!body.story_id && !body.post_id) return fail("target required");
  let decision: ModerationDecision | null = null;
  const aiOn = aiConfigured();
  if (aiOn) {
    try { decision = (await moderateText(text, { hasMedia: false })).decision; } catch { decision = null; }
  }
  const status = statusAfterModeration(decision, aiOn && decision !== null);
  if (status === "removed") return fail("comment_rejected", 422);
  const db = supabaseAdmin();
  const { data, error } = await db.from("comments").insert({
    author_id: user.id, body: text, story_id: body.story_id ?? null, post_id: body.post_id ?? null, parent_id: body.parent_id ?? null, status: insertedStatus(),
  }).select("*").single();
  if (error || !data) return fail(error?.message ?? "could_not_save", 500);
  const { data: published, error: publishError } = await db.from("comments").update({ status }).eq("id", data.id).select("*").single();
  if (publishError || !published) return fail(publishError?.message ?? "could_not_save", 500);
  return json({ ok: true, comment: published, status });
}
