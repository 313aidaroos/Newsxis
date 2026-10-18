import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SeverityChip, StatusChip, ago } from "@/components/StoryCard";
import { Comments } from "@/components/Comments";
import { GraphicMedia } from "@/components/GraphicMedia";
import { showGraphicMedia } from "@/lib/safety";
import { SHARE_IMAGE_PATH } from "@/lib/public-site";
import { socixisFeedEnabled } from "@/lib/socixis";
import { currentProfile, supabaseConfigured, supabaseUser } from "@/lib/supabase/server";
import { CATEGORY_LABEL, type Source, type Story, type StorySource, type StoryThread } from "@/lib/types";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  if (!supabaseConfigured()) return null;
  const db = await supabaseUser();
  const { data: story } = await db.from("stories").select("*").eq("slug", slug).maybeSingle();
  if (!story) return null;
  const [threads, sources, stations] = await Promise.all([
    db.from("story_threads").select("*").eq("story_id", story.id).order("created_at"),
    db.from("story_sources").select("*").eq("story_id", story.id).order("created_at"),
    story.country
      ? db.from("sources").select("*").eq("active", true).eq("country", story.country).in("kind", ["radio", "scanner"]).not("stream_url", "is", null).limit(3)
      : Promise.resolve({ data: [] }),
  ]);
  return {
    story: story as Story,
    threads: (threads.data ?? []) as StoryThread[],
    sources: (sources.data ?? []) as StorySource[],
    stations: (stations.data ?? []) as Source[],
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: "Story" };
  const description = d.story.summary;
  const image = SHARE_IMAGE_PATH;
  return {
    title: d.story.headline,
    description,
    alternates: { canonical: `/story/${slug}` },
    openGraph: { title: d.story.headline, description, url: `/story/${slug}`, images: [image], type: "article" },
    twitter: { card: "summary_large_image", title: d.story.headline, description, images: [image] },
  };
}

const KIND_LABEL: Record<StoryThread["kind"], string> = { research: "What we found", another_side: "Another side", update: "Update", correction: "Correction", context: "Context", cixy_note: "Cixy's note" };

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { story: s, threads, sources, stations } = d;
  const { profile } = await currentProfile();
  const showGraphic = showGraphicMedia(profile?.show_graphic_media);
  const place = [s.place_name ?? s.city, s.county, s.region, s.country].filter(Boolean).join(", ");
  const family = socixisFeedEnabled();
  return (
    <div className="nx-page">
      <div className="nx-story-layout">
        <article>
          <div className="nx-story-meta" style={{ marginBottom: 10 }}>
            <SeverityChip s={s} /><span className="nx-chip">{CATEGORY_LABEL[s.category]}</span><StatusChip s={s} />
            <span>{place}{place ? " · " : ""}{ago(s.published_at)}</span>
          </div>
          <h1 className="nx-h1">{s.headline}</h1>
          <p style={{ fontSize: 18, color: "var(--nx-ink2)", lineHeight: 1.55 }}>{s.summary}</p>
          {s.body && <div className="nx-script">{s.body}</div>}
          {s.source_quote && <blockquote className="nx-card" style={{ margin: "12px 0", fontStyle: "italic", color: "var(--nx-ink2)" }}>“{s.source_quote}”<div className="nx-tiny" style={{ marginTop: 6, fontStyle: "normal" }}>— {s.ai_label.replace("Written by Cixy from ", "")}</div></blockquote>}
          {s.media?.length > 0 && (
            <div className="nx-grid nx-grid-2" style={{ margin: "12px 0" }}>
              {s.media.map((m, i) => <GraphicMedia key={i} url={m.url} kind={m.kind} graphic={Boolean(m.graphic || s.graphic)} showGraphic={showGraphic} />)}
              {s.graphic && showGraphic && <p className="nx-tiny">Graphic news media stays blurred until you hover. Turn it off in <Link href="/settings">settings</Link>.</p>}
              {s.graphic && !showGraphic && <p className="nx-tiny">Graphic media is hidden. <Link href="/settings">Settings</Link> can turn it on.</p>}
            </div>
          )}
          <div className="nx-story-foot" style={{ margin: "12px 0" }}>
            <span className="nx-chip nx-chip-ai">AI · {s.ai_label}</span>
            {s.lat !== null && s.lng !== null && <Link href={`/?lat=${s.lat}&lng=${s.lng}&z=10`}>Open on the globe</Link>}
            {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer">Original source</a>}
          </div>
          <div className="nx-thread">
            {threads.length === 0 && <div className="nx-thread-item kind-research"><h4>What we found</h4><p>Research is queued. Confirmations, the other side, and any corrections appear here as Cixy finds them. Nothing is filled in ahead of that.</p></div>}
            {threads.map((t) => (
              <div key={t.id} className={`nx-thread-item kind-${t.kind}`}>
                <h4>{KIND_LABEL[t.kind]}</h4>
                <p className="nx-tiny" style={{ marginBottom: 6 }}>{t.ai_label} · {ago(t.created_at)}</p>
                <p style={{ whiteSpace: "pre-wrap" }}>{t.body}</p>
                {t.sources?.length > 0 && <ul>{t.sources.map((x, i) => <li key={i}><a href={x.url} target="_blank" rel="noreferrer">{x.title || x.url}</a>{x.publisher ? ` · ${x.publisher}` : ""}</li>)}</ul>}
              </div>
            ))}
            <div className="nx-thread-item">
              <h4>Sources</h4>
              {sources.length === 0 && <p>No source line is stored on this story yet.</p>}
              {sources.length > 0 && <ul style={{ marginTop: 0 }}>{sources.map((x) => <li key={x.id}>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.title || x.url}</a> : x.title}{x.publisher ? ` · ${x.publisher}` : ""} · <em>{x.stance}</em></li>)}</ul>}
            </div>
          </div>
          <div className="nx-card" style={{ marginTop: 20 }}>
            <div className="nx-card-head"><h3>Discussion</h3><Link href={`/support?kind=correction&story=${s.id}`} className="nx-tiny">Report an error</Link></div>
            <Comments storyId={s.id} signedIn={Boolean(profile)} />
          </div>
        </article>
        <aside className="nx-story-side">
          <section className="nx-card">
            <p className="nx-kicker">Cixy</p>
            <h2>On this story</h2>
            <p className="nx-muted">Cixy reads a story in order: what matches, the other side, then anything disputed. No recording is attached to this story.</p>
            <p><Link href="/briefing">Hourly briefings</Link></p>
          </section>
          <section className="nx-card">
            <p className="nx-kicker">Newsxis radio</p>
            <h2>Listen nearby</h2>
            {stations.length === 0 && <p className="nx-muted">No station is tied to this place. <Link href="/radio">All stations</Link> lists what is actually connected.</p>}
            {stations.map((st) => (
              <div key={st.id} className="nx-station">
                <div><strong>{st.name}</strong><small>{[st.city, st.country].filter(Boolean).join(" · ")}</small></div>
                <Link className="nx-btn nx-btn-2 nx-btn-sm" href={`/radio?station=${encodeURIComponent(st.slug ?? st.id)}`}>Listen</Link>
              </div>
            ))}
          </section>
          <section className="nx-card">
            <p className="nx-kicker">Socixis Social</p>
            <h2>Family feed</h2>
            {family ? <p className="nx-muted">The shared Apixis feed is connected. <Link href="/feed?tab=family">Open it</Link>.</p> : <p className="nx-muted">This is the shared Apixis feed. It stays empty until the feed key is connected. Nothing is filled in with posts that are not there.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
