/**
 * The newsroom pipeline, step by step (each step is one cron route so Vercel's time limits hold):
 *   ingest()   poll every due feed → ingest_items (deduped by external id)
 *   process()  unprocessed ingest_items + transcripts → classify → story (or confirmation of an existing one)
 *   research() stories worth it (severity ≥ 3, or 2+ sources) → thread: What we found / Another side / Disputed / Correction
 *   enqueueSocial() stories → social_posts per account scope
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyBreakingRules, classify, type Classified, type RawMaterial } from "@/lib/ai/classify";
import { researchStory } from "@/lib/ai/research";
import { aiConfigured } from "@/lib/ai/anthropic";
import { fetchSource } from "./fetchers";
import { haversineKm, langForPlace } from "@/lib/geo";
import { storySlug } from "@/lib/slug";
import type { Source, Story } from "@/lib/types";

export async function logRun(db: SupabaseClient, agent: string, ok: boolean, items: number, ms: number, detail: Record<string, unknown> = {}) {
  await db.from("agent_runs").insert({ agent, ok, items, ms, detail }).then(() => undefined, () => undefined);
}

// ---------------------------------------------------------------- ingest
export async function ingest(db: SupabaseClient, limitSources = 12): Promise<{ polled: number; inserted: number; errors: string[] }> {
  const t0 = Date.now();
  const { data: sources } = await db.from("sources").select("*").eq("active", true).in("kind", ["rss", "gov", "gdelt"]).order("last_polled_at", { ascending: true, nullsFirst: true }).limit(limitSources);
  let inserted = 0; const errors: string[] = []; let polled = 0;
  for (const s of (sources ?? []) as Source[]) {
    const due = !s.last_polled_at || Date.now() - Date.parse(s.last_polled_at) >= s.poll_seconds * 1000;
    if (!due) continue;
    polled++;
    try {
      const items = await fetchSource(s);
      const rows = items.slice(0, 60).map((i) => ({ source_id: s.id, external_id: i.external_id, title: i.title, url: i.url, published_at: i.published_at, raw: { ...(i.raw ?? {}), text: i.text, known_place: i.known_place ?? null, severity_hint: i.severity_hint ?? null, category_hint: i.category_hint ?? null } }));
      if (rows.length) {
        const { data } = await db.from("ingest_items").upsert(rows, { onConflict: "source_id,external_id", ignoreDuplicates: true }).select("id");
        inserted += data?.length ?? 0;
      }
      await db.from("sources").update({ last_polled_at: new Date().toISOString(), last_ok_at: new Date().toISOString(), last_error: null }).eq("id", s.id);
    } catch (e) {
      errors.push(`${s.name}: ${(e as Error).message}`);
      await db.from("sources").update({ last_polled_at: new Date().toISOString(), last_error: (e as Error).message.slice(0, 500) }).eq("id", s.id);
    }
  }
  await logRun(db, "ingest", errors.length === 0, inserted, Date.now() - t0, { polled, errors });
  return { polled, inserted, errors };
}

// ---------------------------------------------------------------- process
type IngestRow = { id: string; source_id: string | null; title: string | null; url: string | null; published_at: string | null; raw: Record<string, unknown> };
type TranscriptRow = { id: string; source_id: string; started_at: string; ended_at: string; lang: string; text: string };

export async function process(db: SupabaseClient, limit = 8): Promise<{ stories: number; confirmations: number; skipped: number; errors: string[] }> {
  if (!aiConfigured()) return { stories: 0, confirmations: 0, skipped: 0, errors: ["ai_not_configured"] };
  const t0 = Date.now();
  const out = { stories: 0, confirmations: 0, skipped: 0, errors: [] as string[] };
  const { data: sourcesData } = await db.from("sources").select("*");
  const sources = new Map(((sourcesData ?? []) as Source[]).map((s) => [s.id, s]));

  const { data: items } = await db.from("ingest_items").select("id,source_id,title,url,published_at,raw").eq("processed", false).order("created_at", { ascending: true }).limit(limit);
  for (const it of (items ?? []) as IngestRow[]) {
    const src = it.source_id ? sources.get(it.source_id) : undefined;
    // Feed items older than 36h are noise at launch; mark and move on.
    if (it.published_at && Date.now() - Date.parse(it.published_at) > 36 * 3600 * 1000) { await db.from("ingest_items").update({ processed: true }).eq("id", it.id); out.skipped++; continue; }
    try {
      const raw = it.raw ?? {};
      const material: RawMaterial = {
        kind: src?.kind === "gov" ? "alert" : "feed", source_name: src?.name ?? "feed", source_lang: src?.lang,
        source_place: src ? { country: src.country, region: src.region, city: src.city, county: src.county, lat: src.lat, lng: src.lng } : undefined,
        title: it.title, text: String(raw.text ?? it.title ?? ""), url: it.url, published_at: it.published_at,
        known_place: (raw.known_place as RawMaterial["known_place"]) ?? null,
      };
      const r = await handleMaterial(db, material, src ?? null, { severityHint: Number(raw.severity_hint) || undefined, categoryHint: typeof raw.category_hint === "string" ? raw.category_hint : undefined });
      await db.from("ingest_items").update({ processed: true, story_id: r.storyId }).eq("id", it.id);
      if (r.kind === "story") out.stories++; else if (r.kind === "confirmation") out.confirmations++; else out.skipped++;
    } catch (e) { out.errors.push(`${it.id}: ${(e as Error).message}`); await db.from("ingest_items").update({ processed: true }).eq("id", it.id); }
  }

  const { data: trs } = await db.from("transcripts").select("id,source_id,started_at,ended_at,lang,text").eq("processed", false).order("started_at", { ascending: true }).limit(Math.max(2, Math.floor(limit / 2)));
  for (const tr of (trs ?? []) as TranscriptRow[]) {
    const src = sources.get(tr.source_id);
    try {
      if (!src || tr.text.trim().split(/\s+/).length < 25) { await db.from("transcripts").update({ processed: true }).eq("id", tr.id); out.skipped++; continue; }
      const material: RawMaterial = {
        kind: "transcript", source_name: src.name, source_lang: tr.lang,
        source_place: { country: src.country, region: src.region, city: src.city, county: src.county, lat: src.lat, lng: src.lng },
        text: tr.text, url: src.url, published_at: tr.started_at,
      };
      const r = await handleMaterial(db, material, src, {});
      await db.from("transcripts").update({ processed: true, story_id: r.storyId }).eq("id", tr.id);
      if (r.kind === "story") out.stories++; else if (r.kind === "confirmation") out.confirmations++; else out.skipped++;
    } catch (e) { out.errors.push(`tr ${tr.id}: ${(e as Error).message}`); await db.from("transcripts").update({ processed: true }).eq("id", tr.id); }
  }
  await logRun(db, "process", out.errors.length === 0, out.stories + out.confirmations, Date.now() - t0, out);
  return out;
}

async function handleMaterial(db: SupabaseClient, material: RawMaterial, src: Source | null, hints: { severityHint?: number; categoryHint?: string }): Promise<{ kind: "story" | "confirmation" | "skip"; storyId: string | null }> {
  const outLang = material.source_lang === "es" ? "es" : "en";
  let c = await classify(material, outLang);
  if (!c) return { kind: "skip", storyId: null };
  c = applyBreakingRules(c);
  if (hints.severityHint && hints.severityHint > c.severity) c.severity = hints.severityHint as Classified["severity"];
  if (hints.categoryHint && c.category === "other") c.category = hints.categoryHint as Classified["category"];

  const twin = await findTwin(db, c);
  if (twin) {
    await db.from("story_sources").insert({ story_id: twin.id, source_id: src?.id ?? null, url: material.url, title: material.title ?? c.headline, publisher: material.source_name, stance: "confirms", quote: c.quote });
    const confirmations = twin.confirmations + 1;
    await db.from("stories").update({ confirmations, confirmed: confirmations >= 2, severity: Math.max(twin.severity, c.severity), breaking: twin.breaking || c.severity >= 5 }).eq("id", twin.id);
    return { kind: "confirmation", storyId: twin.id };
  }

  const row = {
    slug: storySlug(c.headline), headline: c.headline, summary: c.summary, lang: c.lang || outLang, status: "live", category: c.category,
    severity: c.severity, breaking: c.severity >= 5, confirmed: false, disputed: false, confirmations: 1, confidence: c.confidence,
    country: c.country, region: c.region, city: c.city, county: c.county, place_name: c.place_name, lat: c.lat, lng: c.lng,
    source_id: src?.id ?? null, source_url: material.url ?? src?.url ?? null, source_quote: c.quote,
    ai_label: `Written by Cixy from ${material.source_name}`, graphic: c.graphic,
    event_started_at: material.published_at ?? null, published_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("stories").insert(row).select("id").single();
  if (error) throw error;
  await db.from("story_sources").insert({ story_id: data.id, source_id: src?.id ?? null, url: material.url, title: material.title ?? c.headline, publisher: material.source_name, stance: "origin", quote: c.quote });
  return { kind: "story", storyId: data.id };
}

/** Same event already in the last 48h? Trigram similarity on headline + same place (≤ 150 km or same city/country). */
async function findTwin(db: SupabaseClient, c: Classified): Promise<Pick<Story, "id" | "confirmations" | "severity" | "breaking"> | null> {
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data } = await db.from("stories").select("id,headline,summary,confirmations,severity,breaking,lat,lng,city,country,category").gte("published_at", since).eq("status", "live").order("published_at", { ascending: false }).limit(300);
  const words = tokens(`${c.headline} ${c.summary}`);
  let best: { row: Story; score: number } | null = null;
  for (const row of (data ?? []) as Story[]) {
    const samePlace = (c.lat && row.lat && row.lng && haversineKm(c.lat, c.lng!, row.lat, row.lng) <= 150) || (c.city && row.city && c.city.toLowerCase() === row.city.toLowerCase()) || (!c.city && c.country && row.country === c.country);
    if (!samePlace) continue;
    const score = jaccard(words, tokens(`${row.headline} ${row.summary}`));
    const sameCat = row.category === c.category || row.category === "other" || c.category === "other";
    if (score >= (sameCat ? 0.42 : 0.55) && (!best || score > best.score)) best = { row, score };
  }
  return best?.row ?? null;
}

const STOP = new Set(["the", "a", "an", "of", "in", "on", "at", "to", "and", "or", "for", "with", "by", "from", "as", "is", "are", "was", "were", "be", "has", "have", "that", "this", "it", "its", "after", "over", "into", "near", "says", "said", "reports", "reported", "el", "la", "de", "en", "y", "los", "las", "un", "una", "por", "con"]);
function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

// ---------------------------------------------------------------- research
export async function research(db: SupabaseClient, limit = 3): Promise<{ researched: number; errors: string[] }> {
  if (!aiConfigured()) return { researched: 0, errors: ["ai_not_configured"] };
  const t0 = Date.now();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  // Stories not yet researched: no 'research' thread. Prefer high severity, then multi-source.
  const { data: candidates } = await db.from("stories").select("*, story_threads(kind)").eq("status", "live").gte("published_at", since).or("severity.gte.3,confirmations.gte.2").order("severity", { ascending: false }).order("published_at", { ascending: false }).limit(40);
  const todo = ((candidates ?? []) as Array<Story & { story_threads: Array<{ kind: string }> }>).filter((s) => !s.story_threads?.some((t) => t.kind === "research")).slice(0, limit);
  let researched = 0; const errors: string[] = [];
  for (const s of todo) {
    try {
      const r = await researchStory(s, s.ai_label.replace(/^Written by Cixy from /, ""));
      const threads: Array<Record<string, unknown>> = [{ story_id: s.id, kind: "research", body: r.what_we_found, sources: r.sources.filter((x) => x.stance !== "disputes") }];
      if (r.another_side) threads.push({ story_id: s.id, kind: "another_side", body: r.another_side, sources: r.sources.filter((x) => x.stance === "disputes") });
      if (r.correction) threads.push({ story_id: s.id, kind: "correction", body: r.correction, sources: [] });
      await db.from("story_threads").insert(threads);
      if (r.sources.length) await db.from("story_sources").insert(r.sources.map((x) => ({ story_id: s.id, url: x.url, title: x.title, publisher: x.publisher, stance: x.stance })));
      await db.from("stories").update({ confirmed: r.confirmed || s.confirmations >= 2, disputed: r.disputed, confirmations: Math.max(s.confirmations, r.confirmations) }).eq("id", s.id);
      researched++;
    } catch (e) {
      errors.push(`${s.slug}: ${(e as Error).message}`);
      // Mark so we don't retry forever on a hard failure: a Cixy note the reader can see.
      await db.from("story_threads").insert({ story_id: s.id, kind: "research", body: "Cixy could not complete the research round for this story yet. It will be retried.", sources: [] }).then(() => undefined, () => undefined);
    }
  }
  await logRun(db, "research", errors.length === 0, researched, Date.now() - t0, { errors });
  return { researched, errors };
}

// ---------------------------------------------------------------- social queue
export async function enqueueSocial(db: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data: accounts } = await db.from("social_accounts").select("*").eq("active", true);
  const { data: stories } = await db.from("stories").select("*").eq("status", "live").eq("graphic", false).gte("published_at", since).order("severity", { ascending: false }).limit(100);
  let queued = 0;
  for (const a of accounts ?? []) {
    for (const s of (stories ?? []) as Story[]) {
      if (s.severity < a.min_severity) continue;
      if (!inScope(a.scope, a.scope_key, s)) continue;
      const { data } = await db.from("social_posts").upsert({ account_id: a.id, story_id: s.id, status: "queued", text: "" }, { onConflict: "account_id,story_id", ignoreDuplicates: true }).select("id");
      queued += data?.length ?? 0;
    }
  }
  return queued;
}

export function inScope(scope: string, key: string, s: Story): boolean {
  if (scope === "world") return true;
  if (scope === "country") return (s.country ?? "").toUpperCase() === key.toUpperCase();
  if (scope === "region") return `${s.country}-${s.region}`.toUpperCase() === key.toUpperCase();
  if (scope === "city") return `${s.country}-${s.city}`.toLowerCase() === key.toLowerCase();
  return false;
}

export { langForPlace };
