"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Post, Source, Story } from "@/lib/types";
import { StoryCard } from "./StoryCard";
import { geocode, type Layers } from "./Globe";

const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false, loading: () => <div className="nx-empty" style={{ paddingTop: 120 }}>Loading the globe…</div> });

const DAY = 86400e3;

export function Home({ initialStories, initialStations, showGraphic }: { initialStories: Story[]; initialStations: Source[]; showGraphic: boolean }) {
  const params = useSearchParams();
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [posts, setPosts] = useState<Post[]>([]);
  const [layers, setLayers] = useState<Layers>({ stories: true, stations: true, posts: true, alerts: true });
  const [minSev, setMinSev] = useState(1);
  const [hoursBack, setHoursBack] = useState(168);   // time slider: 1h … 168h (7 days)
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [view, setView] = useState<{ bbox: [number, number, number, number]; zoom: number; center: { lat: number; lng: number } } | null>(null);
  const [q, setQ] = useState("");
  const [narration, setNarration] = useState<{ text: string | null; loading: boolean; error: string | null } | null>(null);
  const [mode, setMode] = useState<"world" | "view">("world");
  const refresh = useRef<number | null>(null);

  // Deep links: /?lat=&lng=&z=
  useEffect(() => {
    const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng) && params.get("lat")) setFocus({ lat, lng, zoom: Number(params.get("z") ?? 9) });
  }, [params]);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - hoursBack * 3600e3).toISOString();
    const inView = mode === "view" && view && view.zoom >= 3;
    const bbox = inView ? `&bbox=${view!.bbox.join(",")}` : "";
    const [s, p] = await Promise.all([
      fetch(`/api/stories?since=${since}&min_severity=${minSev}&limit=400${bbox}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ items: [] })),
      fetch(`/api/posts?limit=100${inView ? `&bbox=${view!.bbox.join(",")}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ items: [] })),
    ]);
    setStories(s.items ?? []); setPosts(p.items ?? []);
  }, [hoursBack, minSev, mode, view]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    refresh.current = window.setInterval(load, 45_000);
    return () => { if (refresh.current) window.clearInterval(refresh.current); };
  }, [load]);

  const visible = useMemo(() => {
    const list = stories;
    if (mode === "view" && view) {
      const [w, so, e, n] = view.bbox;
      return list.filter((s) => s.lat !== null && s.lng !== null && s.lat >= so && s.lat <= n && (w <= e ? s.lng >= w && s.lng <= e : s.lng >= w || s.lng <= e));
    }
    return list;
  }, [stories, mode, view]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    const hit = await geocode(q.trim()).catch(() => null);
    if (hit) { setFocus({ lat: hit.lat, lng: hit.lng, zoom: hit.zoom }); setMode("view"); }
  };

  const askCixy = async () => {
    if (!view) return;
    setNarration({ text: null, loading: true, error: null });
    const km = Math.max(25, Math.min(2000, 20000 / Math.pow(2, view.zoom)));
    const from = new Date(Date.now() - hoursBack * 3600e3).toISOString();
    const r = await fetch(`/api/timeline?lat=${view.center.lat}&lng=${view.center.lng}&km=${Math.round(km)}&from=${from}&label=${encodeURIComponent(q || "this area")}`).then((x) => x.json()).catch(() => ({ ok: false, error: "network" }));
    if (!r.ok) setNarration({ text: null, loading: false, error: r.error === "ai_not_configured" ? "Cixy's brain is not connected yet." : r.error === "rate_limited" ? "Cixy needs a short break. Try again in a few minutes." : "Cixy could not answer right now." });
    else setNarration({ text: r.text ?? "Nothing recorded here in this window yet.", loading: false, error: null });
  };

  const sliderLabel = hoursBack >= 48 ? `${Math.round(hoursBack / 24)} days` : `${hoursBack} h`;
  return (
    <div className="nx-home">
      <section className="nx-globe-wrap" aria-label="Globe">
        <Globe stories={visible} stations={initialStations} posts={posts} focus={focus} layers={layers} showGraphic={showGraphic}
          onViewChange={(bbox, zoom, center) => setView({ bbox, zoom, center })} />
        <div className="nx-globe-ui top">
          <form className="nx-globe-panel" onSubmit={search} role="search">
            <span aria-hidden="true">⌖</span>
            <input type="search" placeholder="Go anywhere: a city, a county, a street…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search a place" />
            <button className="nx-btn nx-btn-sm" type="submit">Go</button>
          </form>
          <div className="nx-globe-panel">
            {(["stories", "stations", "posts"] as const).map((k) => (
              <label key={k} className="nx-layer"><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />{k === "stories" ? "News" : k === "stations" ? "Live radio" : "Reporters"}</label>
            ))}
            <select className="nx-select" style={{ width: "auto", padding: "4px 8px" }} value={minSev} onChange={(e) => setMinSev(Number(e.target.value))} aria-label="Minimum severity">
              <option value={1}>All news</option><option value={3}>Major +</option><option value={4}>Critical +</option><option value={5}>Breaking only</option>
            </select>
          </div>
        </div>
        <div className="nx-globe-ui bottom">
          <div className="nx-globe-panel nx-slider">
            <span className="nx-tiny">Last</span>
            <input type="range" min={1} max={168} step={1} value={hoursBack} onChange={(e) => setHoursBack(Number(e.target.value))} aria-label="Time window in hours" />
            <strong style={{ minWidth: 56 }}>{sliderLabel}</strong>
            <button className="nx-btn nx-btn-2 nx-btn-sm" type="button" onClick={askCixy} disabled={!view || narration?.loading}>{narration?.loading ? "Cixy is reading…" : "Ask Cixy what happened here"}</button>
          </div>
          <div className="nx-globe-panel">
            <button type="button" className={`nx-btn nx-btn-sm ${mode === "world" ? "" : "nx-btn-2"}`} onClick={() => setMode("world")}>World</button>
            <button type="button" className={`nx-btn nx-btn-sm ${mode === "view" ? "" : "nx-btn-2"}`} onClick={() => setMode("view")}>This view</button>
          </div>
        </div>
        {narration && (narration.text || narration.error) && (
          <div className="nx-globe-ui" style={{ bottom: 70, left: 12, right: 12 }}>
            <div className="nx-globe-panel" style={{ maxWidth: 640, alignItems: "flex-start" }}>
              <div className="nx-cixy-orb" style={{ width: 30, height: 30 }} />
              <div style={{ flex: 1 }}>
                <div className="nx-tiny">CIXY · {sliderLabel}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{narration.error ?? narration.text}</div>
              </div>
              <button type="button" className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => setNarration(null)} aria-label="Close">✕</button>
            </div>
          </div>
        )}
      </section>
      <aside className="nx-feed" aria-label="Live feed">
        <div className="nx-feed-head">
          <h2>{mode === "view" ? "In this view" : "World"} · live</h2>
          <span className="nx-tiny">{visible.length} stories · {sliderLabel}</span>
        </div>
        <div className="nx-feed-list">
          {visible.length === 0 && <div className="nx-empty">{initialStories.length === 0 ? "Cixy is warming up. Stories appear here as soon as the feeds and radio come in." : "Nothing in this view for this window. Zoom out or widen the time slider."}</div>}
          {visible.slice(0, 120).map((s) => <StoryCard key={s.id} s={s} compact onFocus={(x) => x.lat !== null && x.lng !== null ? undefined : undefined} />)}
        </div>
      </aside>
    </div>
  );
}
