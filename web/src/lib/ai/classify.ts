/**
 * Turn raw material (a transcript segment, a feed item, a user post) into a story candidate.
 * Cheap model, strict JSON. Returns null when the material is not news (ads, music, chatter).
 */
import { CIXY_NEWS_SYSTEM } from "./cixy-role";
import { fastJson } from "./anthropic";
import type { StoryCategory } from "@/lib/types";

export type Classified = {
  is_news: boolean;
  headline: string;
  summary: string;
  category: StoryCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  lang: string;
  country: string | null;
  region: string | null;
  city: string | null;
  county: string | null;
  place_name: string | null;
  lat: number | null;
  lng: number | null;
  quote: string | null;
  tags: string[];
  deaths: number | null;
  graphic: boolean;
  confidence: number;
};

export type RawMaterial = {
  kind: "transcript" | "feed" | "post" | "alert";
  source_name: string;
  source_lang?: string;
  source_place?: { country?: string | null; region?: string | null; city?: string | null; county?: string | null; lat?: number | null; lng?: number | null };
  title?: string | null;
  text: string;
  url?: string | null;
  published_at?: string | null;
  known_place?: { lat: number; lng: number; name?: string } | null;   // e.g. USGS epicenter
};

const SCHEMA = `{"is_news":boolean,"headline":string (≤ 110 chars, newsroom style),"summary":string (1–3 sentences, attributed),"category":"war"|"attack"|"assassination"|"terror"|"disaster"|"weather"|"earthquake"|"crime"|"politics"|"government"|"economy"|"strike"|"health"|"tech"|"science"|"sports"|"culture"|"local"|"other","severity":1|2|3|4|5,"lang":ISO-639-1,"country":ISO-3166-alpha-2|null,"region":state/province|null,"city":string|null,"county":string|null,"place_name":string|null,"lat":number|null,"lng":number|null,"quote":string|null (≤ 240 chars, verbatim from the material),"tags":string[],"deaths":number|null,"graphic":boolean,"confidence":0..1}`;

export async function classify(material: RawMaterial, outputLang = "en"): Promise<Classified | null> {
  const place = material.source_place
    ? `Source location (use only if the material does not name a more specific place): ${JSON.stringify(material.source_place)}`
    : "";
  const known = material.known_place ? `Known coordinates for this event: ${JSON.stringify(material.known_place)} (use them).` : "";
  const user = `Material kind: ${material.kind}
Source: ${material.source_name}${material.url ? ` (${material.url})` : ""}${material.published_at ? ` · published ${material.published_at}` : ""}
${place}
${known}
${material.title ? `Title: ${material.title}\n` : ""}Text:
"""
${material.text.slice(0, 6000)}
"""

Write the output in language "${outputLang}". Decide whether this is a news event (not an ad, song, weather chit-chat, promo, or opinion segment). Return ONLY this JSON: ${SCHEMA}
Coordinates: give lat/lng only for a place you are sure about (a named city or a known landmark); otherwise null.`;
  const out = await fastJson<Classified>(CIXY_NEWS_SYSTEM, user, 900);
  if (!out || !out.is_news || !out.headline || !out.summary) return null;
  out.severity = (Math.min(5, Math.max(1, Math.round(Number(out.severity) || 2))) as Classified["severity"]);
  out.confidence = Math.min(1, Math.max(0, Number(out.confidence) || 0.5));
  if (out.lat !== null && (typeof out.lat !== "number" || Math.abs(out.lat) > 90)) out.lat = null;
  if (out.lng !== null && (typeof out.lng !== "number" || Math.abs(out.lng) > 180)) out.lng = null;
  if (out.lat === null || out.lng === null) { out.lat = null; out.lng = null; }
  if (!out.lat && material.known_place) { out.lat = material.known_place.lat; out.lng = material.known_place.lng; }
  if (!out.lat && material.source_place?.lat && material.source_place.lng && !out.city && !out.country) {
    out.lat = material.source_place.lat; out.lng = material.source_place.lng;
  }
  out.country = out.country ? out.country.toUpperCase().slice(0, 2) : material.source_place?.country ?? null;
  return out;
}

/** Owner's breaking rule, applied on top of the model's severity. */
export function applyBreakingRules(c: Classified): Classified {
  const text = `${c.headline} ${c.summary}`.toLowerCase();
  const assassination = c.category === "assassination" || /assassinat/.test(text);
  const officialAttack = (c.category === "attack" || c.category === "terror") && /(president|prime minister|minister|governor|mayor|senator|ambassador|general|king|judge|official)/.test(text);
  const newWar = c.category === "war" && /(declar|invad|invasion|launch|begins|begun|offensive)/.test(text);
  const bigDisaster = (c.category === "disaster" || c.category === "earthquake" || c.category === "weather") && ((c.deaths ?? 0) >= 10 || /(magnitude [7-9]|tsunami|hurricane|typhoon|category [3-5])/.test(text));
  const majorStrike = c.category === "strike" && /(nationwide|general strike|national)/.test(text);
  if ((c.deaths ?? 0) >= 10 || assassination || officialAttack || newWar || bigDisaster || majorStrike) c.severity = 5;
  return c;
}
