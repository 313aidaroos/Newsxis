/**
 * Free feed fetchers. Each returns normalized items; nothing here calls the model.
 * RSS/Atom (tiny regex parser, no dependency), USGS GeoJSON, NWS alerts, GDACS RSS, GDELT doc API.
 */
import type { Source } from "@/lib/types";

export type FeedItem = {
  external_id: string;
  title: string;
  text: string;
  url: string | null;
  published_at: string | null;
  known_place?: { lat: number; lng: number; name?: string } | null;
  severity_hint?: number;
  category_hint?: string;
  raw?: Record<string, unknown>;
};

const UA = "Newsxis/0.1 (+https://newsxis.vercel.app; news aggregation; contact newsxis@apixis.dev)";

async function get(url: string, accept = "*/*"): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export function stripHtml(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? stripHtml(m[1]) : null;
}

function attr(block: string, name: string, attrName: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*\\s${attrName}=["']([^"']+)["']`, "i"));
  return m ? m[1] : null;
}

/** RSS 2.0 / Atom / RDF. */
export function parseRss(xml: string): FeedItem[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return items.map((b) => {
    const title = tag(b, "title") ?? "";
    const link = tag(b, "link") || attr(b, "link", "href") || tag(b, "guid") || null;
    const desc = tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content:encoded") ?? tag(b, "content") ?? "";
    const date = tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date") ?? null;
    const guid = tag(b, "guid") ?? tag(b, "id") ?? link ?? title;
    const lat = tag(b, "geo:lat") ?? tag(b, "geo:point")?.split(" ")[0] ?? null;
    const lng = tag(b, "geo:long") ?? tag(b, "geo:point")?.split(" ")[1] ?? null;
    const published = date ? new Date(date) : null;
    return {
      external_id: (guid ?? title).slice(0, 500),
      title,
      text: desc.slice(0, 5000),
      url: link,
      published_at: published && !Number.isNaN(published.getTime()) ? published.toISOString() : null,
      known_place: lat && lng && Number.isFinite(Number(lat)) ? { lat: Number(lat), lng: Number(lng) } : null,
    };
  }).filter((i) => i.title);
}

export async function fetchRss(source: Source): Promise<FeedItem[]> {
  const xml = await get(source.url!, "application/rss+xml, application/atom+xml, application/xml, text/xml");
  return parseRss(xml);
}

/** USGS earthquakes GeoJSON. */
export async function fetchUsgs(source: Source): Promise<FeedItem[]> {
  const json = JSON.parse(await get(source.url!, "application/json")) as { features: Array<{ id: string; properties: Record<string, unknown>; geometry: { coordinates: [number, number, number] } }> };
  return (json.features ?? []).map((f) => {
    const p = f.properties, mag = Number(p.mag ?? 0);
    const [lng, lat, depth] = f.geometry.coordinates;
    const when = typeof p.time === "number" ? new Date(p.time).toISOString() : null;
    return {
      external_id: f.id,
      title: String(p.title ?? `M ${mag} earthquake`),
      text: `USGS reports a magnitude ${mag.toFixed(1)} earthquake ${p.place ?? ""}, at a depth of ${Math.round(depth)} km, at ${when ?? "unknown time"}. ${p.tsunami ? "A tsunami flag is set. " : ""}${p.alert ? `PAGER alert level: ${p.alert}. ` : ""}${p.felt ? `${p.felt} people reported feeling it.` : ""}`,
      url: typeof p.url === "string" ? p.url : null,
      published_at: when,
      known_place: { lat, lng, name: String(p.place ?? "") },
      severity_hint: mag >= 7 ? 5 : mag >= 6 ? 4 : mag >= 5.5 ? 3 : 2,
      category_hint: "earthquake",
      raw: { mag, depth, alert: p.alert ?? null, tsunami: p.tsunami ?? 0 },
    };
  });
}

/** NWS active alerts (US). */
export async function fetchNws(source: Source): Promise<FeedItem[]> {
  const json = JSON.parse(await get(source.url!, "application/geo+json")) as { features: Array<{ id: string; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } | null }> };
  return (json.features ?? []).map((f) => {
    const p = f.properties;
    const sev = String(p.severity ?? "");
    const centroid = polygonCentroid(f.geometry);
    return {
      external_id: f.id,
      title: String(p.headline ?? p.event ?? "Weather alert"),
      text: `${p.event ?? ""} (${sev}, ${p.urgency ?? ""}, ${p.certainty ?? ""}). Area: ${p.areaDesc ?? ""}. ${p.description ?? ""} ${p.instruction ?? ""}`.slice(0, 5000),
      url: typeof p["@id"] === "string" ? (p["@id"] as string) : null,
      published_at: typeof p.sent === "string" ? new Date(p.sent).toISOString() : null,
      known_place: centroid,
      severity_hint: sev === "Extreme" ? 4 : 3,
      category_hint: "weather",
      raw: { event: p.event, areaDesc: p.areaDesc, severity: sev },
    };
  });
}

function polygonCentroid(geom: { type: string; coordinates: unknown } | null): { lat: number; lng: number } | null {
  if (!geom) return null;
  const pts: number[][] = geom.type === "Polygon" ? (geom.coordinates as number[][][])[0] : geom.type === "MultiPolygon" ? (geom.coordinates as number[][][][])[0][0] : geom.type === "Point" ? [geom.coordinates as number[]] : [];
  if (!pts.length) return null;
  const s = pts.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
  return { lat: s[1] / pts.length, lng: s[0] / pts.length };
}

/** GDACS disasters RSS (has geo tags + alert level). */
export async function fetchGdacs(source: Source): Promise<FeedItem[]> {
  const xml = await get(source.url!);
  const items = parseRss(xml);
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.map((it, i) => {
    const b = blocks[i] ?? "";
    const level = (tag(b, "gdacs:alertlevel") ?? "").toLowerCase();
    const type = tag(b, "gdacs:eventtype") ?? "";
    return { ...it, severity_hint: level === "red" ? 5 : level === "orange" ? 4 : 2, category_hint: type === "EQ" ? "earthquake" : "disaster", raw: { level, type } };
  });
}

/** GDELT doc API (articles about conflict in the last 30 min). */
export async function fetchGdelt(source: Source): Promise<FeedItem[]> {
  const text = await get(source.url!, "application/json");
  let json: { articles?: Array<Record<string, unknown>> } = {};
  try { json = JSON.parse(text); } catch { return []; }
  return (json.articles ?? []).map((a) => ({
    external_id: String(a.url ?? a.title),
    title: String(a.title ?? ""),
    text: `${a.title ?? ""}. Reported by ${a.domain ?? "unknown"} (${a.sourcecountry ?? ""}).`,
    url: typeof a.url === "string" ? a.url : null,
    published_at: typeof a.seendate === "string" ? gdeltDate(a.seendate) : null,
    raw: { domain: a.domain, sourcecountry: a.sourcecountry, language: a.language },
  })).filter((i) => i.title);
}

function gdeltDate(s: string): string | null {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
}

export async function fetchSource(source: Source): Promise<FeedItem[]> {
  const format = String(source.meta?.format ?? "");
  if (source.kind === "gov" && format === "usgs") return fetchUsgs(source);
  if (source.kind === "gov" && format === "nws") return fetchNws(source);
  if (source.kind === "gov" && format === "gdacs") return fetchGdacs(source);
  if (source.kind === "gdelt") return fetchGdelt(source);
  if (source.kind === "rss") return fetchRss(source);
  return [];
}
