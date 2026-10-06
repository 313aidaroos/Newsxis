import { supabaseConfigured, supabaseUser } from "@/lib/supabase/server";
import { ago } from "@/components/StoryCard";
import type { Briefing } from "@/lib/types";

export const metadata = { title: "Cixy" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ scope?: string; lang?: string }> }) {
  const sp = await searchParams;
  let items: Briefing[] = [];
  if (supabaseConfigured()) {
    try {
      const db = await supabaseUser();
      let q = db.from("briefings").select("*").order("created_at", { ascending: false }).limit(30);
      if (sp.scope) q = q.eq("scope_key", sp.scope);
      if (sp.lang) q = q.eq("lang", sp.lang);
      items = ((await q).data ?? []) as Briefing[];
    } catch { /* empty */ }
  }
  const scopes = [["", "All"], ["world", "World"], ["US", "United States"], ["US-New York", "New York"], ["region:ME", "Middle East"], ["region:EU", "Europe"], ["region:AF", "Africa"]];
  return (
    <div className="nx-page nx-page-narrow">
      <div className="nx-cixy" style={{ marginBottom: 16 }}>
        <div className="nx-cixy-orb" />
        <div><h1 className="nx-h1" style={{ margin: 0 }}>Cixy</h1><p className="nx-sub" style={{ margin: 0 }}>The Newsxis anchor. One voice, every language, no leaning. Every word is attributed.</p></div>
      </div>
      <div className="nx-tabs">
        {scopes.map(([k, label]) => <a key={k} href={k ? `/briefing?scope=${encodeURIComponent(k)}` : "/briefing"} className={(sp.scope ?? "") === k ? "active" : ""}>{label}</a>)}
        <a href={`/briefing?${new URLSearchParams({ ...(sp.scope ? { scope: sp.scope } : {}), lang: "es" })}`} className={sp.lang === "es" ? "active" : ""}>Español</a>
      </div>
      {items.length === 0 && <div className="nx-card nx-empty">No briefings yet. The first world briefing is written at the top of the hour once Cixy's brain is connected.</div>}
      <div className="nx-grid">
        {items.map((b) => (
          <article key={b.id} className="nx-card">
            <div className="nx-story-meta"><span className={`nx-chip ${b.kind === "breaking" ? "nx-chip-sev5" : "nx-chip-ai"}`}>{b.kind.toUpperCase()}</span><span>{b.scope_key}</span><span>· {b.lang.toUpperCase()}</span><span>· {ago(b.created_at)}</span>{b.duration_s && <span>· ~{Math.round(b.duration_s / 60)} min</span>}</div>
            <h2 style={{ textTransform: "none", letterSpacing: 0, fontSize: 18, color: "var(--nx-ink)", margin: "6px 0 8px" }}>{b.title}</h2>
            {b.audio_url ? <audio src={b.audio_url} controls preload="none" style={{ width: "100%", marginBottom: 8 }} /> : <div className="nx-tiny" style={{ marginBottom: 8 }}>Audio not generated (voice not connected).</div>}
            <details><summary className="nx-tiny" style={{ cursor: "pointer" }}>Script</summary><div className="nx-script" style={{ marginTop: 8 }}>{b.script}</div></details>
            {b.sponsor && <div className="nx-tiny" style={{ marginTop: 8 }}>Sponsored by {b.sponsor}</div>}
          </article>
        ))}
      </div>
    </div>
  );
}
