import { json } from "@/lib/api";
import { supabaseConfigured, supabaseUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Public: latest briefings. ?scope_key=world&lang=en&limit=20 */
export async function GET(request: Request) {
  if (!supabaseConfigured()) return json({ ok: true, items: [], configured: false });
  const p = new URL(request.url).searchParams;
  const db = await supabaseUser();
  let q = db.from("briefings").select("*").order("created_at", { ascending: false }).limit(Math.min(50, Number(p.get("limit") ?? 20)));
  if (p.get("scope_key")) q = q.eq("scope_key", p.get("scope_key")!);
  if (p.get("lang")) q = q.eq("lang", p.get("lang")!);
  if (p.get("kind")) q = q.eq("kind", p.get("kind")!);
  const { data } = await q;
  return json({ ok: true, items: data ?? [], configured: true });
}
