/**
 * Cixy's briefings. World and regional runs come from Vercel cron.
 * A breaking bulletin is written when the process step publishes severity 5,
 * and the breaking cron sweeps any severity-5 story that still has no bulletin.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeBriefing } from "@/lib/ai/briefing";
import { REGIONS, langForPlace } from "@/lib/geo";
import { logRun } from "@/lib/ingest/pipeline";
import { activeSponsorName } from "@/lib/sponsor";
import { estimateSeconds, storeAudio, synthesize, ttsConfigured } from "@/lib/tts/elevenlabs";
import type { Story } from "@/lib/types";

type Target = {
  scope: "world" | "country" | "region" | "city";
  key: string;
  label: string;
  lang: string;
  kind: "hourly" | "regional" | "breaking";
  filter: (s: Story) => boolean;
};

export class BriefingInputError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function sponsorFor(db: SupabaseClient, scopeKey: string): Promise<string | null> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await db.from("revenue_events").select("note, created_at").eq("kind", "sponsor").gte("created_at", since).order("created_at", { ascending: false }).limit(40);
  if (error || !data) return null;
  return activeSponsorName(data as Array<{ note: string | null; created_at: string }>, scopeKey);
}

async function makeBriefing(db: SupabaseClient, t: Target, stories: Story[]) {
  const picked = stories.filter(t.filter).slice(0, 12);
  const sponsor = await sponsorFor(db, t.key);
  const { title, script } = await writeBriefing({ scopeLabel: t.label, kind: t.kind, lang: t.lang, stories: picked, sponsor, maxWords: t.kind === "breaking" ? 120 : 320 });
  const { data, error } = await db.from("briefings").insert({
    scope: t.scope, scope_key: t.key, lang: t.lang, kind: t.kind, title, script,
    duration_s: estimateSeconds(script), story_ids: picked.map((s) => s.id), sponsor,
  }).select("id").single();
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
  return data.id as string;
}

async function coveredBreakingIds(db: SupabaseClient): Promise<Set<string>> {
  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data } = await db.from("briefings").select("story_ids").eq("kind", "breaking").gte("created_at", since);
  const covered = new Set<string>();
  for (const row of data ?? []) {
    const ids = (row as { story_ids?: string[] }).story_ids ?? [];
    for (const id of ids) covered.add(id);
  }
  return covered;
}

async function briefOne(db: SupabaseClient, story: Story, covered: Set<string>): Promise<string | null> {
  if (story.severity < 5 || story.status !== "live" || covered.has(story.id)) return null;
  const target: Target = {
    scope: "world",
    key: "world",
    label: story.place_name ?? "the world",
    lang: langForPlace(story.country, story.lang || "en"),
    kind: "breaking",
    filter: (item) => item.id === story.id,
  };
  const id = await makeBriefing(db, target, [story]);
  covered.add(story.id);
  return id;
}

/** Immediate breaking bulletins for story ids the process step just published. */
export async function runBreakingBriefings(db: SupabaseClient, storyIds: string[]): Promise<{ made: string[]; errors: string[] }> {
  const made: string[] = [];
  const errors: string[] = [];
  const ids = [...new Set(storyIds)].slice(0, 3);
  if (!ids.length) return { made, errors };
  const covered = await coveredBreakingIds(db);
  for (const id of ids) {
    if (covered.has(id)) continue;
    try {
      const { data } = await db.from("stories").select("*").eq("id", id).eq("status", "live").maybeSingle();
      if (!data) continue;
      const briefingId = await briefOne(db, data as Story, covered);
      if (briefingId) made.push(briefingId);
    } catch (e) { errors.push(`${id}: ${(e as Error).message}`); }
  }
  return { made, errors };
}

async function sweepBreaking(db: SupabaseClient): Promise<{ made: string[]; errors: string[] }> {
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data } = await db.from("stories").select("id").eq("status", "live").gte("severity", 5).gte("published_at", since).order("published_at", { ascending: false }).limit(20);
  return runBreakingBriefings(db, ((data ?? []) as Array<{ id: string }>).map((row) => row.id));
}

export async function runBriefingJob(db: SupabaseClient, scope: string, storyId: string | null): Promise<{ made: string[]; errors: string[] }> {
  const t0 = Date.now();
  if (scope === "breaking") {
    if (storyId) {
      const { data } = await db.from("stories").select("*").eq("id", storyId).maybeSingle();
      if (!data) throw new BriefingInputError("story_not_found", 404);
      const story = data as Story;
      if (story.status !== "live" || story.severity < 5) throw new BriefingInputError("not_breaking", 404);
      const result = await runBreakingBriefings(db, [story.id]);
      await logRun(db, "briefing.breaking", result.errors.length === 0, result.made.length, Date.now() - t0, { errors: result.errors, story: story.id });
      return result;
    }
    const result = await sweepBreaking(db);
    await logRun(db, "briefing.breaking", result.errors.length === 0, result.made.length, Date.now() - t0, { errors: result.errors });
    return result;
  }

  const since = new Date(Date.now() - (scope === "regions" ? 3 : 1.5) * 3600 * 1000).toISOString();
  const { data } = await db.from("stories").select("*").eq("status", "live").gte("published_at", since).order("severity", { ascending: false }).order("published_at", { ascending: false }).limit(200);
  const stories = (data ?? []) as Story[];
  const targets: Target[] = [];
  if (scope === "world") {
    targets.push({ scope: "world", key: "world", label: "the world", lang: "en", kind: "hourly", filter: () => true });
    targets.push({ scope: "world", key: "world", label: "el mundo", lang: "es", kind: "hourly", filter: () => true });
  } else if (scope === "regions") {
    for (const [key, region] of Object.entries(REGIONS)) {
      targets.push({ scope: "region", key: `region:${key}`, label: region.name, lang: key === "SA" ? "es" : "en", kind: "regional", filter: (s) => Boolean(s.country && region.countries.includes(s.country)) });
    }
    targets.push({ scope: "city", key: "US-New York", label: "New York City", lang: "en", kind: "regional", filter: (s) => s.city === "New York" || (s.region === "NY" && s.country === "US") });
    targets.push({ scope: "country", key: "US", label: "the United States", lang: "en", kind: "regional", filter: (s) => s.country === "US" });
  }

  const made: string[] = [];
  const errors: string[] = [];
  for (const target of targets) {
    if (target.kind === "regional" && !stories.some(target.filter)) continue;
    try { made.push(await makeBriefing(db, target, stories)); } catch (e) { errors.push(`${target.key}/${target.lang}: ${(e as Error).message}`); }
  }
  await logRun(db, `briefing.${scope}`, errors.length === 0, made.length, Date.now() - t0, { errors });
  return { made, errors };
}
