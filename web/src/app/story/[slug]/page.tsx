import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SeverityChip, StatusChip, ago } from "@/components/StoryCard";
import { Comments } from "@/components/Comments";
import { GraphicMedia } from "@/components/GraphicMedia";
import { showGraphicMedia } from "@/lib/safety";
import { currentProfile, supabaseConfigured, supabaseUser } from "@/lib/supabase/server";
import { CATEGORY_LABEL, type Story, type StorySource, type StoryThread } from "@/lib/types";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  if (!supabaseConfigured()) return null;
  const db = await supabaseUser();
  const { data: story } = await db.from("stories").select("*").eq("slug", slug).maybeSingle();
  if (!story) return null;
  const [threads, sources] = await Promise.all([
    db.from("story_threads").select("*").eq("story_id", story.id).order("created_at"),
    db.from("story_sources").select("*").eq("story_id", story.id).order("created_at"),
  ]);
  return { story: story as Story, threads: (threads.data ?? []) as StoryThread[], sources: (sources.data ?? []) as StorySource[] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: "Story" };
  return { title: d.story.headline, description: d.story.summary, openGraph: { title: d.story.headline, description: d.story.summary, images: [`/api/card/${slug}`] }, twitter: { card: "summary_large_image" } };
}

const KIND_LABEL: Record<StoryThread["kind"], string> = { research: "What we found", another_side: "Another side", update: "Update", correction: "Correction", context: "Context", cixy_note: "Cixy's note" };

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { story: s, threads, sources } = d;
  const { profile } = await currentProfile();
  const showGraphic = showGraphicMedia(profile?.show_graphic_media);
  const place = [s.place_name ?? s.city, s.county, s.region, s.country].filter(Boolean).join(", ");
  return (
    <div className="nx-page nx-page-narrow">
      <div className="nx-story-meta" style={{ marginBottom: 10 }}>
        <SeverityChip s={s} /><span className="nx-chip">{CATEGORY_LABEL[s.category]}</span><StatusChip s={s} />
        <span>{ago(s.published_at)} · {new Date(s.published_at).toUTCString()}</span>
      </div>
      <h1 className="nx-h1" style={{ lineHeight: 1.15 }}>{s.headline}</h1>
      <p style={{ fontSize: 18, color: "var(--nx-ink)", lineHeight: 1.55 }}>{s.summary}</p>
      {s.body && <div className="nx-script">{s.body}</div>}
      {s.source_quote && <blockquote className="nx-card" style={{ margin: "12px 0", fontStyle: "italic", color: "var(--nx-ink2)" }}>“{s.source_quote}”<div className="nx-tiny" style={{ marginTop: 6, fontStyle: "normal" }}>— {s.ai_label.replace("Written by Cixy from ", "")}</div></blockquote>}
      {s.media?.length > 0 && (
        <div className="nx-grid nx-grid-2" style={{ margin: "12px 0" }}>
          {s.media.map((m, i) => <GraphicMedia key={i} url={m.url} kind={m.kind} graphic={Boolean(m.graphic || s.graphic)} showGraphic={showGraphic} />)}
          {s.graphic && showGraphic && <p className="nx-tiny">Graphic news media stays blurred until you hover. Turn it off in <Link href="/settings">settings</Link>.</p>}
          {s.graphic && !showGraphic && <p className="nx-tiny">Graphic media is hidden. <Link href="/settings">Settings</Link> can turn it on.</p>}
        </div>
      )}
      <div className="nx-story-foot" style={{ margin: "10px 0 6px" }}>
        <span className="nx-chip nx-chip-ai">AI · {s.ai_label}</span>
        {place && <span>📍 {place}</span>}
        {s.lat !== null && s.lng !== null && <Link href={`/?lat=${s.lat}&lng=${s.lng}&z=10`}>Open on the globe</Link>}
        {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer">Original source ↗</a>}
      </div>

      <div className="nx-thread">
        {threads.length === 0 && <div className="nx-thread-item kind-cixy_note"><h4>Cixy</h4><p>Research is queued. Confirmations, the other side and any corrections appear here as Cixy finds them.</p></div>}
        {threads.map((t) => (
          <div key={t.id} className={`nx-thread-item kind-${t.kind}`}>
            <h4>{KIND_LABEL[t.kind]} · {t.ai_label} · {ago(t.created_at)}</h4>
            <p style={{ whiteSpace: "pre-wrap" }}>{t.body}</p>
            {t.sources?.length > 0 && <ul>{t.sources.map((x, i) => <li key={i}><a href={x.url} target="_blank" rel="noreferrer">{x.title || x.url}</a>{x.publisher ? ` · ${x.publisher}` : ""}</li>)}</ul>}
          </div>
        ))}
        {sources.length > 0 && (
          <div className="nx-thread-item">
            <h4>Sources ({sources.length})</h4>
            <ul style={{ marginTop: 0 }}>{sources.map((x) => <li key={x.id}>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.title || x.url}</a> : x.title}{x.publisher ? ` · ${x.publisher}` : ""} · <em>{x.stance}</em></li>)}</ul>
          </div>
        )}
      </div>

      <div className="nx-card" style={{ marginTop: 20 }}>
        <div className="nx-card-head"><h3>Discussion</h3><Link href={`/support?kind=correction&story=${s.id}`} className="nx-tiny">Report an error</Link></div>
        <Comments storyId={s.id} signedIn={Boolean(profile)} />
      </div>
    </div>
  );
}
