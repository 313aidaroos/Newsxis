import { cronAuthorized, fail, json } from "@/lib/api";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import { enqueueSocial, process as processMaterial } from "@/lib/ingest/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const db = supabaseAdmin();
  const result = await processMaterial(db, 8);
  const queued = await enqueueSocial(db);
  return json({ ok: true, ...result, social_queued: queued });
}
