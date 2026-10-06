/**
 * Cixy's briefings. ?scope=world → one hourly world briefing (English + Spanish).
 * ?scope=regions → one per Phase-1 region and the home city, every 3 hours, in the region's language.
 * ?scope=breaking&story=<id> → an immediate breaking bulletin (called by the process step for severity 5).
 */
import { cronAuthorized, fail, json } from "@/lib/api";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import { writeBriefing } from "@/lib/ai/briefing";
import { aiConfigured } from "@/lib/ai/anthropic";
import { estimateSeconds, storeAudio, synthesize, ttsConfigured } from "@/lib/tts/elevenlabs";
import { REGIONS, langForPlace } from "@/lib/geo";
import { logRun } from "@/lib/ingest/pipeline";
import type { Story } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Target = { scope: "world" | "country" | "region" | "city"; key: string; label: string; lang: string; kind: "hourly" | "regional" | "breaking"; filter: (s: Story) => boolean };

async function makeBriefing(db: SupabaseClient, t: Target, stories: Story[]) {
  const picked = stories.filter(t.filter).slice(0, 12);
  const { title, script } = await writeBriefing({ scopeLabel: t.label, kind: t.kind, lang: t.lang, stories: picked, maxWords: t.kind === "breaking" ? 120 : 320 });
  const { data, error } = await db.from("briefings").insert({ scope: t.scope, scope_key: t.key, lang: t.lang, kind: t.kind, title, script, duration_s: estimateSeconds(script), story_ids: picked.map((s) => s.id) }).select("id").single();
  if (error) throw error;
  if (ttsConfigured()) {
    try {
      const audio = await synthesize(script, t.lang);
      if (audio) {
        const url = await storeAudio(db, `briefings/${data.id}.mp3`, audio);
        await db.from("briefings").update({ audio_url: url }).eq("id", data.id);
      }
    } catch (e) { await logRun(db, "tts", false, 0, 0, { error: (e as Error).message, briefing: data.id }); }
  }
  return data.id;
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  if (!aiConfigured()) return fail("ai_not_configured", 503);
  const db = supabaseAdmin();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "world";
  const since = new Date(Date.now() - (scope === "regions" ? 3 : 1.5) * 3600 * 1000).toISOString();
  const { data } = await db.from("stories").select("*").eq("status", "live").gte("published_at", since).order("severity", { ascending: false }).order("published_at", { ascending: false }).limit(200);
  const stories = (data ?? []) as Story[];
  const t0 = Date.now();
  const made: string[] = []; const errors: string[] = [];

  const targets: Target[] = [];
  if (scope === "world") {
    targets.push({ scope: "world", key: "world", label: "the world", lang: "en", kind: "hourly", filter: () => true });
    targets.push({ scope: "world", key: "world", label: "el mundo", lang: "es", kind: "hourly", filter: () => true });
  } else if (scope === "regions") {
    for (const [key, r] of Object.entries(REGIONS)) {
      targets.push({ scope: "region", key: `region:${key}`, label: r.name, lang: key === "SA" ? "es" : "en", kind: "regional", filter: (s) => Boolean(s.country && r.countries.includes(s.country)) });
    }
    targets.push({ scope: "city", key: "US-New York", label: "New York City", lang: "en", kind: "regional", filter: (s) => s.city === "New York" || (s.region === "NY" && s.country === "US") });
    targets.push({ scope: "country", key: "US", label: "the United States", lang: "en", kind: "regional", filter: (s) => s.country === "US" });
  } else if (scope === "breaking") {
    const id = url.searchParams.get("story");
    const s = stories.find((x) => x.id === id);
    if (!s) return fail("story_not_found", 404);
    targets.push({ scope: "world", key: "world", label: s.place_name ?? "the world", lang: langForPlace(s.country, "en"), kind: "breaking", filter: (x) => x.id === s.id });
  }

  for (const t of targets) {
    if (t.kind === "regional" && !stories.some(t.filter)) continue;   // quiet region: no empty briefing
    try { made.push(await makeBriefing(db, t, stories)); } catch (e) { errors.push(`${t.key}/${t.lang}: ${(e as Error).message}`); }
  }
  await logRun(db, `briefing.${scope}`, errors.length === 0, made.length, Date.now() - t0, { errors });
  return json({ ok: true, made, errors });
}
