/**
 * Opt-in daily report. Vercel cron is UTC, so this runs hourly and writes only
 * when the clock in America/Chicago says 20:00. No model, no invented summary.
 */
import { cronAuthorized, fail, json } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/anthropic";
import { writeBriefing } from "@/lib/ai/briefing";
import { centralDateKey, dailyReportDraft, isEightPmCentral } from "@/lib/daily-report";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import type { Story } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const now = new Date();
  if (!isEightPmCentral(now)) {
    return json({ ok: true, ran: false, reason: "not_8pm_ct", chicagoDate: centralDateKey(now) });
  }
  const db = supabaseAdmin();
  const { data: people, error: peopleError } = await db.from("profiles").select("id").eq("daily_report_opt_in", true).eq("banned", false).eq("age_blocked", false);
  if (peopleError) {
    const missing = /daily_report_opt_in|daily_reports/.test(peopleError.message);
    return fail(missing ? "migration_required" : peopleError.message, missing ? 503 : 500);
  }
  if (!people?.length) return json({ ok: true, ran: true, written: 0 });

  const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const { data: rows } = await db.from("stories").select("*").eq("status", "live").gte("published_at", since).order("severity", { ascending: false }).limit(12);
  const stories = (rows ?? []) as Story[];
  let script: string | null = null;
  if (stories.length > 0) {
    if (!aiConfigured()) return fail("ai_not_configured", 503);
    const written = await writeBriefing({ scopeLabel: "the world", kind: "recap", lang: "en", stories, maxWords: 220 });
    script = written.script;
  }
  const dateKey = centralDateKey(now);
  const draft = dailyReportDraft(dateKey, stories.length, script);
  if (!draft) return fail("report_not_written", 503);

  let written = 0;
  const errors: string[] = [];
  for (const person of people) {
    const { error } = await db.from("daily_reports").upsert({
      user_id: person.id,
      report_date: dateKey,
      title: draft.title,
      body: draft.body,
      ai_label: draft.ai_label,
    }, { onConflict: "user_id,report_date" });
    if (error) errors.push(error.message.slice(0, 180));
    else written += 1;
  }
  if (written === 0 && errors.length > 0) return fail("migration_required", 503);
  return json({ ok: true, ran: true, written, errors });
}
