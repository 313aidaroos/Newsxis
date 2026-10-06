import { json } from "@/lib/api";
import { supabaseConfigured, supabaseUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public: active sources (radio stations with streams, feeds) for the globe's station layer and /radio. */
export async function GET() {
  if (!supabaseConfigured()) return json({ ok: true, items: [], configured: false });
  const db = await supabaseUser();
  const { data } = await db.from("sources").select("id,kind,name,slug,url,stream_url,lang,country,region,city,county,lat,lng,last_ok_at").eq("active", true).order("kind").order("name");
  return json({ ok: true, items: data ?? [], configured: true });
}
