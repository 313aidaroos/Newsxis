/** The radio worker posts transcript segments here (x-worker-key). The process cron turns them into stories. */
import { fail, json, workerAuthorized } from "@/lib/api";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!workerAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const body = await request.json().catch(() => null) as { source_id?: string; source_slug?: string; started_at?: string; ended_at?: string; lang?: string; text?: string } | null;
  if (!body?.text || !body.started_at || !body.ended_at || !(body.source_id || body.source_slug)) return fail("bad_request");
  const db = supabaseAdmin();
  let sourceId = body.source_id ?? null;
  if (!sourceId && body.source_slug) {
    const { data } = await db.from("sources").select("id").eq("slug", body.source_slug).maybeSingle();
    sourceId = data?.id ?? null;
  }
  if (!sourceId) return fail("unknown_source", 404);
  const { data, error } = await db.from("transcripts").insert({ source_id: sourceId, started_at: body.started_at, ended_at: body.ended_at, lang: body.lang ?? "en", text: body.text.slice(0, 20000) }).select("id").single();
  if (error) return fail(error.message, 500);
  return json({ ok: true, id: data.id });
}

/** Worker asks which streams to listen to. */
export async function GET(request: Request) {
  if (!workerAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const { data } = await supabaseAdmin().from("sources").select("id,slug,name,stream_url,lang,country,city").eq("active", true).in("kind", ["radio", "scanner"]).not("stream_url", "is", null);
  return json({ ok: true, sources: data ?? [] });
}
