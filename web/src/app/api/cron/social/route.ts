import { cronAuthorized, fail, json, siteUrl } from "@/lib/api";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import { runSocialQueue } from "@/lib/social/post";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const result = await runSocialQueue(supabaseAdmin(), siteUrl(request));
  return json({ ok: true, ...result });
}
