/** Time-slider narration: Cixy explains what happened in an area over a window (owner #18). Rate-limited, cached per hour-bucket. */
import { fail, json } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/anthropic";
import { narrateTimeline } from "@/lib/ai/briefing";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import type { Story } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  if (!aiConfigured()) return fail("ai_not_configured", 503);
  const p = new URL(request.url).searchParams;
  const lat = Number(p.get("lat")), lng = Number(p.get("lng")), km = Math.min(2000, Number(p.get("km") ?? 300));
  const from = p.get("from") ?? new Date(Date.now() - 7 * 86400e3).toISOString(), to = p.get("to") ?? new Date().toISOString();
  const lang = (p.get("lang") ?? "en").slice(0, 2);
  const label = p.get("label") ?? "this area";
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail("bad_request");
  const db = supabaseAdmin();
  const hour = Math.floor(Date.now() / 3600e3);
  const ip = (request.headers.get("x-forwarded-for") ?? "anon").split(",")[0];
  const { data: allowed } = await db.rpc("take_request_allowance", { bucket_key: `timeline:${ip}:${hour}`, max_hits: 12, expiry: new Date((hour + 1) * 3600e3).toISOString() });
  if (allowed === false) return fail("rate_limited", 429);
  const { data } = await db.rpc("stories_near", { p_lat: lat, p_lng: lng, p_km: km, p_limit: 40 });
  const stories = ((data ?? []) as Story[]).filter((s) => s.published_at >= from && s.published_at <= to).sort((a, b) => a.published_at.localeCompare(b.published_at));
  if (!stories.length) return json({ ok: true, text: null, count: 0 });
  const text = await narrateTimeline({ placeLabel: label, lang, stories, from, to });
  return json({ ok: true, text, count: stories.length });
}
