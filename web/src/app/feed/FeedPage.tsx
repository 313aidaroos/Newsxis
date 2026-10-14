"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createFeedClient } from "@/feed-client/api";
import { FeedView, type FeedSkin } from "@/feed-client/FeedView";
import { GraphicMedia } from "@/components/GraphicMedia";
import { StoryCard, ago } from "@/components/StoryCard";
import type { Post, Story } from "@/lib/types";

// Newsxis skin for the shared family feed: only Newsxis's own classes (globals.css). Layout in ./feed.css.
const skin: FeedSkin = {
  tabs: "nx-tabs", tab: "", tabActive: "active",
  card: "nx-card", cardHead: "nx-card-head", title: "",
  button: "nx-btn", buttonSecondary: "nx-btn nx-btn-2", buttonSmall: "nx-btn-sm",
  chip: "nx-chip", aiChip: "nx-chip nx-chip-ai", input: "nx-input", label: "nx-label",
  muted: "nx-muted", alert: "nx-alert", notice: "nx-notice", empty: "nx-empty", listRow: "nx-station",
  signInUrl: "/auth/apixis/start?next=%2Ffeed%3Ftab%3Dfamily",
  buyIxisUrl: "https://apixis-wallet.vercel.app/buy?product=newsxis",
};

type Tab = "news" | "reporters" | "family";

export function FeedPage({ showGraphic = false }: { showGraphic?: boolean }) {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "news");
  const [stories, setStories] = useState<Story[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<{ q: string; minSev: number; country: string }>({ q: "", minSev: 1, country: "" });
  const [loading, setLoading] = useState(false);
  const client = useMemo(() => createFeedClient({ client: "newsxis", sessionUrl: "/api/feed-session" }), []);

  const loadStories = useCallback(async (reset: boolean) => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "40", min_severity: String(filter.minSev) });
    if (filter.q) p.set("q", filter.q); if (filter.country) p.set("country", filter.country);
    if (!reset && cursor) p.set("cursor", cursor);
    const r = await fetch(`/api/stories?${p}`, { cache: "no-store" }).then((x) => x.json()).catch(() => ({ items: [], next_cursor: null }));
    setStories((cur) => (reset ? r.items : [...cur, ...r.items]));
    setCursor(r.next_cursor); setLoading(false);
  }, [filter, cursor]);

  useEffect(() => { if (tab === "news") loadStories(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, filter]);
  useEffect(() => { if (tab === "reporters") fetch("/api/posts?limit=60", { cache: "no-store" }).then((r) => r.json()).then((d) => setPosts(d.items ?? [])).catch(() => setPosts([])); }, [tab]);
  useEffect(() => {
    if (tab !== "news") return;
    const t = setInterval(() => loadStories(true), 60_000);
    return () => clearInterval(t);
  }, [tab, loadStories]);

  return (
    <div>
      <div className="nx-tabs" role="tablist">
        {(["news", "reporters", "family"] as Tab[]).map((k) => <button key={k} type="button" role="tab" className={tab === k ? "active" : ""} aria-selected={tab === k} onClick={() => setTab(k)}>{k === "news" ? "Cixy · News" : k === "reporters" ? "Reporters" : "Socixis Social"}</button>)}
      </div>
      {tab === "news" && (
        <div className="nx-grid" style={{ gridTemplateColumns: "minmax(0,1fr) 280px" }}>
          <div className="nx-grid">
            {stories.length === 0 && !loading && <div className="nx-empty">No stories match yet.</div>}
            {stories.map((s) => <StoryCard key={s.id} s={s} />)}
            {cursor && <button className="nx-btn nx-btn-2" type="button" disabled={loading} onClick={() => loadStories(false)}>{loading ? "Loading…" : "More"}</button>}
          </div>
          <aside className="nx-card" style={{ alignSelf: "start", position: "sticky", top: 76 }}>
            <h3>Filter</h3>
            <label className="nx-label" style={{ marginTop: 10 }}>Search<input className="nx-input" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="Words, places…" /></label>
            <label className="nx-label">Country (ISO)<input className="nx-input" value={filter.country} onChange={(e) => setFilter({ ...filter, country: e.target.value.toUpperCase().slice(0, 2) })} placeholder="US, GB, EG…" /></label>
            <label className="nx-label">Minimum severity
              <select className="nx-select" value={filter.minSev} onChange={(e) => setFilter({ ...filter, minSev: Number(e.target.value) })}>
                <option value={1}>All</option><option value={3}>Major +</option><option value={4}>Critical +</option><option value={5}>Breaking</option>
              </select>
            </label>
            <p className="nx-tiny">Every Cixy story is AI-written from a named source and carries its research thread. Disagreement is shown as "Another side"; conflicting facts are marked Disputed.</p>
          </aside>
        </div>
      )}
      {tab === "reporters" && (
        <div className="nx-grid">
          {posts.length === 0 && <div className="nx-empty">No reporter posts yet. <a href="/post" style={{ color: "var(--nx-accent)" }}>Be the first.</a></div>}
          {posts.map((p) => (
            <article key={p.id} className="nx-story" id={p.id}>
              <div className="nx-story-meta"><span className="nx-chip nx-chip-ok">Reporter{p.author?.verified_reporter ? " ✓" : ""}</span><span>{p.author?.display_name ?? p.author?.username ?? "Someone"}</span><span>· {ago(p.created_at)}</span>{p.place_name && <span>· {p.place_name}</span>}</div>
              <p style={{ color: "var(--nx-ink)", whiteSpace: "pre-wrap" }}>{p.body}</p>
              {p.media?.length > 0 && (
                <div className="nx-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                  {p.media.map((m, i) => <GraphicMedia key={i} url={m.url} kind={m.kind} graphic={Boolean(m.graphic)} showGraphic={showGraphic} />)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === "family" && <FeedView client={client} skin={skin} siteName="Newsxis" />}
    </div>
  );
}
