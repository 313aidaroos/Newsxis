import { after } from "next/server";
import { cronAuthorized, fail, json } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/anthropic";
import { runBreakingBriefings } from "@/lib/briefing-run";
import { enqueueSocial, process as processMaterial } from "@/lib/ingest/pipeline";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const db = supabaseAdmin();
  const result = await processMaterial(db, 8);
  const queued = await enqueueSocial(db);
  if (result.breaking.length && aiConfigured()) {
    const ids = result.breaking;
    after(async () => {
      await runBreakingBriefings(db, ids).catch(() => undefined);
    });
  }
  return json({ ok: true, ...result, social_queued: queued });
}
