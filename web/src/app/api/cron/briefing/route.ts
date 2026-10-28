/**
 * Cixy's briefings. ?scope=world → one hourly world briefing (English + Spanish).
 * ?scope=regions → one per Phase-1 region and the home city, every 3 hours.
 * ?scope=breaking → severity-5 stories from the last 6 hours that have no bulletin yet.
 * ?scope=breaking&story=<id> → that story, called by the process step as soon as it is published.
 */
import { cronAuthorized, fail, json } from "@/lib/api";
import { BriefingInputError, runBriefingJob } from "@/lib/briefing-run";
import { aiConfigured } from "@/lib/ai/anthropic";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  if (!aiConfigured()) return fail("ai_not_configured", 503);
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "world";
  const storyId = url.searchParams.get("story");
  try {
    const result = await runBriefingJob(supabaseAdmin(), scope, storyId);
    return json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof BriefingInputError) return fail(error.message, error.status);
    throw error;
  }
}
