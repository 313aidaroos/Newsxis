"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Briefing, Post, Source, Story } from "@/lib/types";
import { cixyReadout, feedIsLive, feedReasonFetches, focusForStory, HOME_REFRESH_MS, VIEW_PAN_DEBOUNCE_MS, type FeedReason } from "@/lib/home-feed";
import { StoryCard } from "./StoryCard";
import { geocode, type Layers } from "./Globe";

const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false, loading: () => <div className="nx-empty" style={{ paddingTop: 120 }}>Loading the globe…</div> });

const DAY = 86400e3;

export function Home({ initialStories, initialStations, initialBriefing, showGraphic }: { initialStories: Story[]; initialStations: Source[]; initialBriefing: Briefing | null; showGraphic: boolean }) {
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
  const modeRef = useRef(mode);
  const viewRef = useRef(view);
  const hoursRef = useRef(hoursBack);
  const sevRef = useRef(minSev);
  const req = useRef(0);
  const modeMounted = useRef(false);
  modeRef.current = mode;
  viewRef.current = view;
  hoursRef.current = hoursBack;
  sevRef.current = minSev;

  // Deep links: /?lat=&lng=&z=
  useEffect(() => {
    const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng) && params.get("lat")) setFocus({ lat, lng, zoom: Number(params.get("z") ?? 9) });
  }, [params]);

  const load = useCallback(async (reason: FeedReason) => {
    const modeNow = modeRef.current;
    if (!feedReasonFetches(reason, modeNow)) return;
    const viewNow = viewRef.current;
    const since = new Date(Date.now() - hoursRef.current * 3600e3).toISOString();
    const inView = modeNow === "view" && viewNow && viewNow.zoom >= 3;
    const bbox = inView ? `&bbox=${viewNow.bbox.join(",")}` : "";
    const id = ++req.current;
    const [s, p] = await Promise.all([
      fetch(`/api/stories?since=${since}&min_severity=${sevRef.current}&limit=400${bbox}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ items: [] })),
      fetch(`/api/posts?limit=100${inView ? `&bbox=${viewNow.bbox.join(",")}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ items: [] })),
    ]);
    if (id !== req.current) return;
    setStories(s.items ?? []); setPosts(p.items ?? []);
  }, []);

  useEffect(() => { void load("filter"); }, [hoursBack, minSev, load]);
  useEffect(() => {
    if (!modeMounted.current) { modeMounted.current = true; return; }
    void load("mode");
  }, [mode, load]);
  useEffect(() => {
    const id = window.setTimeout(() => { void load("pan"); }, VIEW_PAN_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [view, load]);
  useEffect(() => {
    const id = window.setInterval(() => { void load("refresh"); }, HOME_REFRESH_MS);
    return () => window.clearInterval(id);
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
    const here = visible.slice(0, 8).map((s) => ({ headline: s.headline, place: [s.place_name ?? s.city, s.country].filter(Boolean).join(", ") }));
    setNarration({ text: null, loading: true, error: null });
    const km = Math.max(25, Math.min(2000, 20000 / Math.pow(2, view.zoom)));
    const from = new Date(Date.now() - hoursBack * 3600e3).toISOString();
    const r = await fetch(`/api/timeline?lat=${view.center.lat}&lng=${view.center.lng}&km=${Math.round(km)}&from=${from}&label=${encodeURIComponent(q || "this area")}`).then((x) => x.json()).catch(() => ({ ok: false, error: "network" }));
    if (r.ok && r.text) setNarration({ text: r.text, loading: false, error: null });
    else if (r.ok) setNarration({ text: cixyReadout(here, "empty"), loading: false, error: null });
    else setNarration({ text: cixyReadout(here, r.error === "rate_limited" ? "rate" : "offline"), loading: false, error: null });
  };

  const sliderLabel = hoursBack >= 48 ? `${Math.round(hoursBack / 24)} days` : `${hoursBack} h`;
  const live = feedIsLive(visible.map((s) => s.published_at));
  const stations = initialStations.slice(0, 4);
  return (
    <div className="nx-desk">
      <form className="nx-toolbar" onSubmit={search} role="search">
        <div className="nx-search">
          <span aria-hidden="true">⌖</span>
          <input type="search" placeholder="Go anywhere: a city, a county, a street…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search a place" />
          <button className="nx-btn nx-btn-sm" type="submit">Go</button>
        </div>
        <div className="nx-filters">
          {(["stories", "stations", "posts"] as const).map((k) => (
            <label key={k} className="nx-layer"><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />{k === "stories" ? "News" : k === "stations" ? "Live radio" : "Reporters"}</label>
          ))}
          <label className="nx-slider">
            <span>Last</span>
            <input type="range" min={1} max={168} step={1} value={hoursBack} onChange={(e) => setHoursBack(Number(e.target.value))} aria-label="Time window in hours" />
            <strong>{sliderLabel}</strong>
          </label>
          <select className="nx-select" style={{ width: "auto" }} value={minSev} onChange={(e) => setMinSev(Number(e.target.value))} aria-label="Minimum severity">
            <option value={1}>All news</option><option value={3}>Major +</option><option value={4}>Critical +</option><option value={5}>Breaking only</option>
          </select>
        </div>
      </form>
      <div className="nx-home">
        <section className="nx-globe-wrap" aria-label="Globe">
          <Globe stories={visible} stations={initialStations} posts={posts} focus={focus} layers={layers} showGraphic={showGraphic}
            onViewChange={(bbox, zoom, center) => setView({ bbox, zoom, center })} />
          <div className="nx-globe-ui bottom">
            <button className="nx-btn nx-btn-2 nx-btn-sm" type="button" onClick={askCixy} disabled={!view || narration?.loading}>{narration?.loading ? "Cixy is reading…" : "Ask Cixy what happened here"}</button>
            <div className="nx-globe-panel">
              <button type="button" className={`nx-btn nx-btn-sm ${mode === "world" ? "" : "nx-btn-2"}`} onClick={() => setMode("world")}>World</button>
              <button type="button" className={`nx-btn nx-btn-sm ${mode === "view" ? "" : "nx-btn-2"}`} onClick={() => setMode("view")}>This view</button>
            </div>
          </div>
          {narration?.text && (
            <div className="nx-globe-ui" style={{ top: 12, left: 12, right: 12 }}>
              <div className="nx-globe-panel" style={{ maxWidth: 640, alignItems: "flex-start" }}>
                <img className="nx-cixy-orb" src="/cixy/cixy-newsxis-avatar.webp" alt="" width={30} height={30} style={{ width: 30, height: 30 }} />
                <div style={{ flex: 1 }}>
                  <div className="nx-kicker">Cixy · {sliderLabel}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{narration.text}</div>
                </div>
                <button type="button" className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => setNarration(null)} aria-label="Close">Close</button>
              </div>
            </div>
          )}
        </section>
        <aside className="nx-feed" aria-label="Stories">
          <div className="nx-feed-head">
            <h2>{mode === "view" ? "In this view" : "World"}{live ? " · live" : ""}</h2>
            <a className="nx-chip nx-chip-side" href="/feed?tab=family">Socixis Social</a>
          </div>
          <div className="nx-tiny" style={{ padding: "0 14px 6px" }}>{visible.length} {visible.length === 1 ? "story" : "stories"} · {sliderLabel}</div>
          <div className="nx-feed-list">
            {visible.length === 0 && <div className="nx-empty">{initialStories.length === 0 ? "No stories yet. They show up here when a feed or a station actually sends one." : "Nothing in this view for this window. Zoom out or widen the time slider."}</div>}
            {visible.slice(0, 40).map((s) => <StoryCard key={s.id} s={s} onFocus={(story) => { const next = focusForStory(story); if (next) setFocus(next); }} />)}
          </div>
        </aside>
      </div>
      <div className="nx-lower">
        <section className="nx-card" aria-label="Hourly briefing">
          <p className="nx-kicker">Cixy · hourly world briefing</p>
          {initialBriefing ? (
            <div>
              <h2>{initialBriefing.title}</h2>
              <p className="nx-muted">{initialBriefing.script.slice(0, 280)}{initialBriefing.script.length > 280 ? "…" : ""}</p>
              {initialBriefing.audio_url ? <audio src={initialBriefing.audio_url} controls preload="none" style={{ width: "100%", marginTop: 8 }} /> : <p className="nx-tiny">No recording is attached. The script above is the briefing.</p>}
            </div>
          ) : (
            <div>
              <h2>The hour, when Cixy writes it</h2>
              <p className="nx-muted">No hourly briefing is on file. Cixy writes one at the top of the hour once her brain is connected. Nothing is read in its place.</p>
            </div>
          )}
        </section>
        <section className="nx-card" aria-label="Stations">
          <div className="nx-card-head">
            <div><p className="nx-kicker">Newsxis radio</p><h2>Stations Cixy listens to</h2></div>
            <a className="nx-tiny" href="/radio">All stations</a>
          </div>
          {stations.length === 0 && <p className="nx-muted">No station is connected yet. The list stays empty until one is.</p>}
          {stations.map((s) => (
            <div key={s.id} className="nx-station">
              <div><strong>{s.name}</strong><small>{[s.city, s.country].filter(Boolean).join(" · ")}</small></div>
              <a className="nx-btn nx-btn-2 nx-btn-sm" href={`/radio?station=${encodeURIComponent(s.slug ?? s.id)}`}>Listen</a>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
