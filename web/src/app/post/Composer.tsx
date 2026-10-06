"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { geocode } from "@/components/Globe";

type Media = { url: string; kind: "image" | "video" | "audio" };

export function Composer({ activated, seatUntil, canPost, home, userId }: { activated: boolean; seatUntil: string | null; canPost: boolean; home: { lat: number | null; lng: number | null; name: string | null }; userId: string }) {
  const [body, setBody] = useState("");
  const [place, setPlace] = useState(home.name ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(home.lat !== null && home.lng !== null ? { lat: home.lat, lng: home.lng } : null);
  const [media, setMedia] = useState<Media[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; buy?: string } | null>(null);

  const pay = async (productKey: "newsxis.activate" | "newsxis.reporter.monthly") => {
    setBusy(productKey); setMsg(null);
    const r = await fetch("/api/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productKey, attemptId: crypto.randomUUID() }) }).then((x) => x.json()).catch(() => ({ ok: false, error: "network" }));
    setBusy(null);
    if (r.ok) { setMsg({ kind: "ok", text: "Done. Your Ixis were redeemed through the Apixis Wallet." }); setTimeout(() => location.reload(), 900); }
    else if (r.error === "insufficient_ixis") setMsg({ kind: "err", text: `You need ${r.needed ?? 1000} Ixis for this. Buy Ixis on the Apixis Wallet and come back.`, buy: r.buy });
    else if (r.error === "wallet_not_configured") setMsg({ kind: "err", text: "The Wallet connection is not set up on this site yet." });
    else setMsg({ kind: "err", text: r.error ?? "Payment failed. Nothing was charged." });
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("upload");
    try {
      const sb = supabaseBrowser();
      const out: Media[] = [];
      for (const f of Array.from(files).slice(0, 6)) {
        if (f.size > 200 * 1024 * 1024) { setMsg({ kind: "err", text: `${f.name} is over 200 MB.` }); continue; }
        const path = `${userId}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await sb.storage.from("media").upload(path, f, { contentType: f.type, upsert: false });
        if (error) { setMsg({ kind: "err", text: `Upload failed: ${error.message}` }); continue; }
        out.push({ url: sb.storage.from("media").getPublicUrl(path).data.publicUrl, kind: f.type.startsWith("video") ? "video" : f.type.startsWith("audio") ? "audio" : "image" });
      }
      setMedia((m) => [...m, ...out]);
    } finally { setBusy(null); }
  };

  const locate = () => navigator.geolocation?.getCurrentPosition((p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setPlace((x) => x || "My location"); }, () => setMsg({ kind: "err", text: "Location not available." }));
  const findPlace = async () => { const hit = await geocode(place).catch(() => null); if (hit) { setCoords({ lat: hit.lat, lng: hit.lng }); setPlace(hit.name.split(",").slice(0, 2).join(",")); } };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy("post"); setMsg(null);
    const r = await fetch("/api/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body, media, place_name: place || null, lat: coords?.lat, lng: coords?.lng }) }).then((x) => x.json()).catch(() => ({ ok: false, error: "network" }));
    setBusy(null);
    if (r.ok) { setBody(""); setMedia([]); setMsg({ kind: "ok", text: r.status === "live" ? "Posted. It is live on the globe and the Reporters feed. +5 reporter points." : "Posted. Cixy held it for a quick review before it goes live." }); }
    else setMsg({ kind: "err", text: r.error === "post_rejected" ? `Cixy could not post that${r.reason ? `: ${r.reason}` : ""}.` : r.error === "reporter_seat_required" ? "Your reporter seat is not active." : r.error ?? "Could not post." });
  };

  return (
    <div className="nx-grid">
      <div className="nx-card">
        <div className="nx-card-head"><h3>Reporter seat</h3><span className={`nx-chip ${canPost ? "nx-chip-ok" : ""}`}>{canPost ? `Active${seatUntil ? ` until ${new Date(seatUntil).toLocaleDateString()}` : ""}` : activated ? "Seat expired" : "Not activated"}</span></div>
        <p className="nx-muted">Posting costs <strong>1,000 Ixis ($10) once</strong> to activate, then <strong>1,000 Ixis a month</strong>. Paid from your one Apixis Wallet balance. Reporters earn points for live posts; verified reporters get the ✓.</p>
        <div className="nx-actions">
          {!activated && <button className="nx-btn" type="button" disabled={busy !== null} onClick={() => pay("newsxis.activate")}>{busy === "newsxis.activate" ? "Redeeming…" : "Activate · 1,000 Ixis"}</button>}
          {activated && <button className="nx-btn" type="button" disabled={busy !== null} onClick={() => pay("newsxis.reporter.monthly")}>{busy === "newsxis.reporter.monthly" ? "Redeeming…" : canPost ? "Add 30 days · 1,000 Ixis" : "Renew seat · 1,000 Ixis"}</button>}
          <a className="nx-btn nx-btn-2" href="https://apixis-wallet.vercel.app/buy?product=newsxis">Buy Ixis</a>
        </div>
      </div>
      {msg && <div className={msg.kind === "ok" ? "nx-notice" : "nx-alert"}>{msg.text} {msg.buy && <a href={msg.buy} style={{ color: "var(--nx-accent)", fontWeight: 700 }}>Buy Ixis →</a>}</div>}
      <form className="nx-card" onSubmit={submit}>
        <label className="nx-label">What is happening? <textarea className="nx-textarea" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder="Who, what, where, when. Say what you saw yourself and what you heard from others." disabled={!canPost} /></label>
        <label className="nx-label">Where
          <div style={{ display: "flex", gap: 8 }}>
            <input className="nx-input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="City, neighborhood, address…" disabled={!canPost} />
            <button type="button" className="nx-btn nx-btn-2 nx-btn-sm" onClick={findPlace} disabled={!place || !canPost}>Find</button>
            <button type="button" className="nx-btn nx-btn-2 nx-btn-sm" onClick={locate} disabled={!canPost}>📍 Here</button>
          </div>
          {coords && <span className="nx-tiny">Pinned at {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>}
        </label>
        <label className="nx-label">Photos, video, voice (up to 6, 200 MB each)
          <input type="file" multiple accept="image/*,video/*,audio/*" onChange={(e) => upload(e.target.files)} disabled={!canPost || busy === "upload"} />
        </label>
        {media.length > 0 && <div className="nx-actions" style={{ marginBottom: 10 }}>{media.map((m, i) => <span key={i} className="nx-chip">{m.kind} <button type="button" onClick={() => setMedia(media.filter((_, j) => j !== i))} style={{ background: "none", border: 0, cursor: "pointer", color: "inherit" }}>✕</button></span>)}</div>}
        <div className="nx-actions">
          <button className="nx-btn" type="submit" disabled={!canPost || busy !== null || (!body.trim() && media.length === 0)}>{busy === "post" ? "Checking with Cixy…" : "Post"}</button>
          <span className="nx-tiny">Graphic real-news media is allowed and blurred by default. No private people's details. 13+.</span>
        </div>
      </form>
    </div>
  );
}
