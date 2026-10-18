import { Suspense } from "react";
import { Home } from "@/components/Home";
import { showGraphicMedia } from "@/lib/safety";
import { currentProfile, supabaseConfigured, supabaseUser } from "@/lib/supabase/server";
import type { Briefing, Source, Story } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let stories: Story[] = [], stations: Source[] = [], briefing: Briefing | null = null;
  const { profile } = await currentProfile();
  if (supabaseConfigured()) {
    try {
      const db = await supabaseUser();
      const since = new Date(Date.now() - 7 * 86400e3).toISOString();
      const [s, st, b] = await Promise.all([
        db.from("stories").select("*").eq("status", "live").gte("published_at", since).order("published_at", { ascending: false }).limit(400),
        db.from("sources").select("*").eq("active", true).in("kind", ["radio", "scanner"]).not("stream_url", "is", null),
        db.from("briefings").select("*").order("created_at", { ascending: false }).limit(1),
      ]);
      stories = (s.data ?? []) as Story[];
      stations = (st.data ?? []) as Source[];
      briefing = ((b.data ?? [])[0] as Briefing | undefined) ?? null;
    } catch { /* show an empty globe rather than an error page */ }
  }
  return (
    <Suspense fallback={<div className="nx-empty">Loading…</div>}>
      <Home initialStories={stories} initialStations={stations} initialBriefing={briefing} showGraphic={showGraphicMedia(profile?.show_graphic_media)} />
    </Suspense>
  );
}
