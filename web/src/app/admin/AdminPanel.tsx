"use client";
import { useState } from "react";
import { ago } from "@/components/StoryCard";

type Story = { id: string; slug: string; headline: string; severity: number; status: string; confirmed: boolean; disputed: boolean; country: string | null; city: string | null; published_at: string; pinned_until: string | null; ai_label: string };
type Post = { id: string; body: string; status: string; place_name: string | null; created_at: string; moderation: { reason?: string | null }; author: { display_name: string | null; username: string | null } | null };
type Ticket = { id: string; kind: string; from_email: string | null; subject: string; body: string; status: string; agent_reply: string | null; created_at: string };
type Source = { id: string; kind: string; name: string; active: boolean; country: string | null; city: string | null; last_ok_at: string | null; last_error: string | null; stream_url: string | null };
type Social = { id: string; platform: string; handle: string; scope: string; scope_key: string; active: boolean; last_posted_at: string | null; last_error: string | null; min_severity: number; min_gap_seconds: number };
type Run = { agent: string; ok: boolean; items: number; ms: number | null; detail: Record<string, unknown>; created_at: string };

export function AdminPanel({ stories, posts, tickets, sources, social, runs }: { stories: Story[]; posts: Post[]; tickets: Ticket[]; sources: Source[]; social: Social[]; runs: Run[] }) {
  const [tab, setTab] = useState<"stories" | "posts" | "tickets" | "sources" | "social" | "agents">("stories");
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (payload: Record<string, unknown>) => {
    const r = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setMsg(r.ok ? "Done." : r.error ?? "Failed."); if (r.ok) setTimeout(() => location.reload(), 500);
  };
  const addSocial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    let credentials: Record<string, string> = {};
    try { credentials = JSON.parse(String(f.get("credentials") || "{}")); } catch { setMsg("Credentials must be JSON."); return; }
    await act({ action: "social.add", platform: f.get("platform"), handle: f.get("handle"), scope: f.get("scope"), scope_key: f.get("scope_key"), credentials, min_severity: Number(f.get("min_severity")), min_gap_seconds: Number(f.get("min_gap_seconds")) });
  };
  const addSource = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    await act({ action: "source.add", kind: f.get("kind"), name: f.get("name"), slug: f.get("slug") || null, url: f.get("url") || null, stream_url: f.get("stream_url") || null, lang: f.get("lang") || "en", country: f.get("country") || null, region: f.get("region") || null, city: f.get("city") || null, lat: f.get("lat") ? Number(f.get("lat")) : null, lng: f.get("lng") ? Number(f.get("lng")) : null, meta: f.get("format") ? { format: f.get("format") } : {} });
  };
  return (
    <div>
      <div className="nx-tabs">{(["stories", "posts", "tickets", "sources", "social", "agents"] as const).map((k) => <button key={k} type="button" className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{k[0].toUpperCase() + k.slice(1)}{k === "posts" && posts.length ? ` (${posts.length})` : k === "tickets" && tickets.length ? ` (${tickets.length})` : ""}</button>)}</div>
      {msg && <div className="nx-notice" style={{ marginBottom: 10 }}>{msg}</div>}

      {tab === "stories" && <div className="nx-card" style={{ overflowX: "auto" }}><table className="nx-table"><thead><tr><th>Story</th><th>Sev</th><th>State</th><th>Actions</th></tr></thead><tbody>
        {stories.map((s) => <tr key={s.id}><td><a href={`/story/${s.slug}`} target="_blank" style={{ color: "var(--nx-accent)" }}>{s.headline}</a><div className="nx-tiny">{[s.city, s.country].filter(Boolean).join(", ")} · {ago(s.published_at)} · {s.ai_label.replace("Written by Cixy from ", "")}{s.pinned_until ? " · PINNED" : ""}</div></td><td>{s.severity}</td><td>{s.status}{s.disputed ? " · disputed" : s.confirmed ? " · confirmed" : ""}</td>
          <td className="nx-actions">
            <button className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => act({ action: "story.pin", id: s.id, hours: s.pinned_until ? 0 : 24 })}>{s.pinned_until ? "Unpin" : "Pin 24h"}</button>
            <button className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => { const headline = prompt("Headline", s.headline); if (headline) act({ action: "story.edit", id: s.id, headline, note: "Headline edited by the editor." }); }}>Edit</button>
            <button className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => { const body = prompt("Correction text"); if (body) act({ action: "story.correction", id: s.id, body }); }}>Correct</button>
            {s.status === "live" ? <button className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => act({ action: "story.status", id: s.id, status: "held" })}>Hold</button> : <button className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => act({ action: "story.status", id: s.id, status: "live" })}>Publish</button>}
            <button className="nx-btn nx-btn-danger nx-btn-sm" onClick={() => confirm("Remove this story?") && act({ action: "story.status", id: s.id, status: "removed" })}>Remove</button>
          </td></tr>)}
      </tbody></table></div>}

      {tab === "posts" && <div className="nx-grid">{posts.length === 0 && <div className="nx-empty">Nothing waiting.</div>}{posts.map((p) => <div key={p.id} className="nx-card"><div className="nx-tiny">{p.author?.display_name ?? p.author?.username} · {p.place_name} · {ago(p.created_at)} · {p.status}{p.moderation?.reason ? ` · ${p.moderation.reason}` : ""}</div><p style={{ whiteSpace: "pre-wrap" }}>{p.body}</p><div className="nx-actions"><button className="nx-btn nx-btn-sm" onClick={() => act({ action: "post.status", id: p.id, status: "live" })}>Approve</button><button className="nx-btn nx-btn-danger nx-btn-sm" onClick={() => act({ action: "post.status", id: p.id, status: "removed" })}>Remove</button></div></div>)}</div>}

      {tab === "tickets" && <div className="nx-grid">{tickets.length === 0 && <div className="nx-empty">No open tickets.</div>}{tickets.map((t) => <div key={t.id} className="nx-card"><div className="nx-card-head"><h3>{t.kind} · {t.status}</h3><span className="nx-tiny">{t.from_email} · {ago(t.created_at)}</span></div><strong>{t.subject}</strong><p style={{ whiteSpace: "pre-wrap" }}>{t.body}</p>{t.agent_reply && <div className="nx-notice"><div className="nx-tiny">Cixy replied</div>{t.agent_reply}</div>}<div className="nx-actions" style={{ marginTop: 8 }}><button className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => { const note = prompt("Owner note (optional)") ?? ""; act({ action: "ticket.update", id: t.id, status: "closed", note }); }}>Close</button>{t.from_email && <a className="nx-btn nx-btn-2 nx-btn-sm" href={`mailto:${t.from_email}?subject=Re: ${encodeURIComponent(t.subject)}`}>Reply by email</a>}</div></div>)}</div>}

      {tab === "sources" && <div className="nx-grid">
        <div className="nx-card" style={{ overflowX: "auto" }}><table className="nx-table"><thead><tr><th>Source</th><th>Kind</th><th>Health</th><th></th></tr></thead><tbody>
          {sources.map((s) => <tr key={s.id}><td>{s.name}<div className="nx-tiny">{[s.city, s.country].filter(Boolean).join(", ")}</div></td><td>{s.kind}</td><td>{s.last_error ? <span className="nx-chip nx-chip-warn" title={s.last_error}>error</span> : s.last_ok_at ? <span className="nx-chip nx-chip-ok">ok {ago(s.last_ok_at)}</span> : <span className="nx-chip">never</span>}</td><td><button className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => act({ action: "source.toggle", id: s.id, active: !s.active })}>{s.active ? "Pause" : "Enable"}</button></td></tr>)}
        </tbody></table></div>
        <form className="nx-card nx-grid nx-grid-3" onSubmit={addSource}>
          <h3 style={{ gridColumn: "1 / -1" }}>Add a source</h3>
          <select className="nx-select" name="kind" defaultValue="rss"><option value="radio">radio</option><option value="scanner">scanner (licensed)</option><option value="rss">rss</option><option value="gov">gov</option><option value="gdelt">gdelt</option></select>
          <input className="nx-input" name="name" placeholder="Name" required /><input className="nx-input" name="slug" placeholder="slug" />
          <input className="nx-input" name="url" placeholder="Feed / site URL" /><input className="nx-input" name="stream_url" placeholder="Audio stream URL (radio)" /><input className="nx-input" name="format" placeholder="gov format: usgs | nws | gdacs" />
          <input className="nx-input" name="lang" placeholder="lang (en)" /><input className="nx-input" name="country" placeholder="Country ISO" /><input className="nx-input" name="region" placeholder="Region/state" />
          <input className="nx-input" name="city" placeholder="City" /><input className="nx-input" name="lat" placeholder="lat" /><input className="nx-input" name="lng" placeholder="lng" />
          <button className="nx-btn" type="submit">Add</button>
        </form>
      </div>}

      {tab === "social" && <div className="nx-grid">
        <div className="nx-card" style={{ overflowX: "auto" }}><table className="nx-table"><thead><tr><th>Account</th><th>Scope</th><th>Rules</th><th>Last</th><th></th></tr></thead><tbody>
          {social.map((a) => <tr key={a.id}><td>{a.platform} · {a.handle}</td><td>{a.scope}:{a.scope_key}</td><td>sev ≥ {a.min_severity}, gap {Math.round(a.min_gap_seconds / 60)}m</td><td>{a.last_posted_at ? ago(a.last_posted_at) : "—"}{a.last_error && <div className="nx-tiny" style={{ color: "var(--nx-critical)" }}>{a.last_error.slice(0, 80)}</div>}</td><td><button className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => act({ action: "social.toggle", id: a.id, active: !a.active })}>{a.active ? "Pause" : "Enable"}</button></td></tr>)}
          {social.length === 0 && <tr><td colSpan={5} className="nx-empty">No social accounts yet. See docs/SOCIAL_CHECKLIST.md.</td></tr>}
        </tbody></table></div>
        <form className="nx-card nx-grid nx-grid-3" onSubmit={addSocial}>
          <h3 style={{ gridColumn: "1 / -1" }}>Connect an account</h3>
          <select className="nx-select" name="platform" defaultValue="bluesky"><option value="bluesky">Bluesky</option><option value="x">X</option><option value="facebook">Facebook Page</option></select>
          <input className="nx-input" name="handle" placeholder="@newsxis" required />
          <select className="nx-select" name="scope" defaultValue="world"><option value="world">world (main)</option><option value="country">country</option><option value="region">state/region</option><option value="city">city</option></select>
          <input className="nx-input" name="scope_key" placeholder="world · US · US-NY · US-New York" defaultValue="world" />
          <input className="nx-input" name="min_severity" placeholder="min severity" defaultValue={3} /><input className="nx-input" name="min_gap_seconds" placeholder="min gap seconds" defaultValue={600} />
          <textarea className="nx-textarea" name="credentials" style={{ gridColumn: "1 / -1", minHeight: 70 }} placeholder={'Bluesky: {"handle":"newsxis.bsky.social","app_password":"xxxx-xxxx"}\nX: {"access_token":"…","username":"newsxis"}\nFacebook: {"page_id":"123","page_token":"…"}'} />
          <button className="nx-btn" type="submit">Connect (stored encrypted)</button>
        </form>
      </div>}

      {tab === "agents" && <div className="nx-card" style={{ overflowX: "auto" }}><table className="nx-table"><thead><tr><th>Agent</th><th>OK</th><th>Items</th><th>ms</th><th>Detail</th><th>When</th></tr></thead><tbody>
        {runs.map((r, i) => <tr key={i}><td>{r.agent}</td><td>{r.ok ? "✓" : "✕"}</td><td>{r.items}</td><td>{r.ms ?? ""}</td><td className="nx-mono" style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{JSON.stringify(r.detail)}</td><td>{ago(r.created_at)}</td></tr>)}
      </tbody></table></div>}
    </div>
  );
}
