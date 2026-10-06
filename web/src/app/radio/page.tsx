import { Suspense } from "react";
import { RadioPage } from "./RadioPage";
import { supabaseConfigured, supabaseUser } from "@/lib/supabase/server";
import type { Briefing, Source } from "@/lib/types";

export const metadata = { title: "Radio" };
export const dynamic = "force-dynamic";

export default async function Page() {
  let stations: Source[] = [], briefings: Briefing[] = [];
  if (supabaseConfigured()) {
    try {
      const db = await supabaseUser();
      const [s, b] = await Promise.all([
        db.from("sources").select("*").eq("active", true).in("kind", ["radio", "scanner"]).not("stream_url", "is", null).order("country").order("name"),
        db.from("briefings").select("*").not("audio_url", "is", null).order("created_at", { ascending: false }).limit(24),
      ]);
      stations = (s.data ?? []) as Source[]; briefings = (b.data ?? []) as Briefing[];
    } catch { /* empty page states */ }
  }
  return (
    <div className="nx-page">
      <h1 className="nx-h1">Radio</h1>
      <p className="nx-sub">Newsxis Radio: Cixy's latest briefings back to back, plus every public station Cixy listens to, live.</p>
      <Suspense><RadioPage stations={stations} briefings={briefings} /></Suspense>
    </div>
  );
}
