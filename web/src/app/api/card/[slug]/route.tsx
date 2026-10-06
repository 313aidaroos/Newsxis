/** Auto-generated social image card for a story (1200×630 PNG). Used by the social posters and as og:image. */
import { ImageResponse } from "next/og";
import { supabaseConfigured, supabaseUser } from "@/lib/supabase/server";
import { CATEGORY_LABEL, type Story } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let story: Partial<Story> = { headline: "Newsxis", summary: "Real-time news for every place on Earth, read by Cixy.", severity: 2 };
  if (supabaseConfigured()) {
    const db = await supabaseUser();
    const { data } = await db.from("stories").select("headline,summary,severity,category,place_name,country,city,confirmed,disputed,ai_label,published_at").eq("slug", slug).maybeSingle();
    if (data) story = data as Story;
  }
  const sev = story.severity ?? 2;
  const accent = sev >= 5 ? "#ff3b5c" : sev === 4 ? "#ff8a3d" : sev === 3 ? "#ffd23d" : "#38e8ff";
  const tag = sev >= 5 ? "BREAKING" : sev === 4 ? "CRITICAL" : CATEGORY_LABEL[story.category ?? "other"].toUpperCase();
  const place = [story.place_name ?? story.city, story.country].filter(Boolean).join(", ");
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 56, background: "linear-gradient(135deg, #05070f 0%, #0b1024 60%, #121a3a 100%)", color: "#e8f0ff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 16, height: 16, borderRadius: 999, background: accent, boxShadow: `0 0 24px ${accent}` }} />
          <div style={{ fontSize: 28, letterSpacing: 6, color: accent, fontWeight: 700 }}>{tag}</div>
          <div style={{ fontSize: 24, color: "#8ea2c8", marginLeft: "auto" }}>{place}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: (story.headline ?? "").length > 90 ? 44 : 56, fontWeight: 800, lineHeight: 1.1 }}>{story.headline}</div>
          <div style={{ fontSize: 26, color: "#b8c6e6", lineHeight: 1.35 }}>{(story.summary ?? "").slice(0, 190)}{(story.summary ?? "").length > 190 ? "…" : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 22, color: "#8ea2c8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>NEWSXIS</div>
            <div>· read by Cixy · {story.ai_label?.replace("Written by Cixy from ", "source: ") ?? "AI-written"}</div>
          </div>
          <div>{story.disputed ? "Disputed" : story.confirmed ? "Confirmed" : "Unconfirmed"}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
