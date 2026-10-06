import { cronAuthorized, fail, json } from "@/lib/api";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import { research } from "@/lib/ingest/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const result = await research(supabaseAdmin(), 2);
  return json({ ok: true, ...result });
}
