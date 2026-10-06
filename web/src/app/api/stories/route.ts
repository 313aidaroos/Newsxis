/**
 * GET /api/stories?bbox=w,s,e,n&since=ISO&until=ISO&min_severity=1&country=US&q=text&limit=200&cursor=ISO
 * Public. Live stories for the globe and the feed.
 */
import { fail, json } from "@/lib/api";
import { supabaseConfigured, supabaseUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!supabaseConfigured()) return json({ ok: true, items: [], next_cursor: null, configured: false });
  const p = new URL(request.url).searchParams;
  const db = await supabaseUser();
  let q = db.from("stories").select("id,slug,headline,summary,lang,category,severity,breaking,confirmed,disputed,confirmations,country,region,city,county,place_name,lat,lng,source_url,ai_label,image_url,graphic,pinned_until,published_at").eq("status", "live");
  const bbox = p.get("bbox")?.split(",").map(Number);
  if (bbox?.length === 4 && bbox.every(Number.isFinite)) {
    const [w, s, e, n] = bbox;
    q = q.gte("lat", s).lte("lat", n);
    if (w <= e) q = q.gte("lng", w).lte("lng", e); else q = q.or(`lng.gte.${w},lng.lte.${e}`);
  }
  if (p.get("since")) q = q.gte("published_at", p.get("since")!);
  if (p.get("until")) q = q.lte("published_at", p.get("until")!);
  if (p.get("cursor")) q = q.lt("published_at", p.get("cursor")!);
  const minSev = Number(p.get("min_severity") ?? 1);
  if (minSev > 1) q = q.gte("severity", minSev);
  if (p.get("country")) q = q.eq("country", p.get("country")!.toUpperCase());
  if (p.get("category")) q = q.eq("category", p.get("category")!);
  if (p.get("q")) q = q.textSearch("search", p.get("q")!, { type: "websearch", config: "simple" });
  const limit = Math.min(500, Math.max(1, Number(p.get("limit") ?? 100)));
  const sort = p.get("sort") === "severity" ? "severity" : "published_at";
  const { data, error } = await q.order(sort, { ascending: false }).order("published_at", { ascending: false }).limit(limit);
  if (error) return fail(error.message, 500);
  const items = data ?? [];
  return json({ ok: true, items, next_cursor: items.length === limit ? items[items.length - 1].published_at : null, configured: true });
}
