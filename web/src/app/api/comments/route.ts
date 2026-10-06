import { fail, json } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/anthropic";
import { moderateText } from "@/lib/ai/moderate";
import { currentProfile, supabaseConfigured, supabaseUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!supabaseConfigured()) return json({ ok: true, items: [] });
  const p = new URL(request.url).searchParams;
  const db = await supabaseUser();
  let q = db.from("comments").select("*, author:profiles(id,username,display_name,avatar_url,verified_reporter)").eq("status", "live").order("created_at", { ascending: true }).limit(200);
  if (p.get("story")) q = q.eq("story_id", p.get("story")!);
  else if (p.get("post")) q = q.eq("post_id", p.get("post")!);
  else return fail("story or post required");
  const { data } = await q;
  return json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const { user, profile } = await currentProfile();
  if (!user || !profile) return fail("sign_in_required", 401);
  if (profile.banned) return fail("banned", 403);
  const body = await request.json().catch(() => ({})) as { body?: string; story_id?: string; post_id?: string; parent_id?: string };
  const text = (body.body ?? "").trim();
  if (!text || text.length > 2000) return fail("bad_comment");
  if (!body.story_id && !body.post_id) return fail("target required");
  let status: "live" | "held" | "removed" = "live";
  if (aiConfigured()) {
    try { const m = await moderateText(text, { hasMedia: false }); status = m.decision; } catch { status = "live"; }
  }
  if (status === "removed") return fail("comment_rejected", 422);
  const db = await supabaseUser();
  const { data, error } = await db.from("comments").insert({ author_id: user.id, body: text, story_id: body.story_id ?? null, post_id: body.post_id ?? null, parent_id: body.parent_id ?? null, status }).select("*").single();
  if (error) return fail(error.message, 500);
  return json({ ok: true, comment: data, status });
}
