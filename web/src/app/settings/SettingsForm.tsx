"use client";
import { useState } from "react";
import { geocode } from "@/components/Globe";
import type { Profile } from "@/lib/supabase/server";

export function SettingsForm({ profile }: { profile: Profile }) {
  const [p, setP] = useState(profile);
  const [msg, setMsg] = useState<string | null>(null);
  const [place, setPlace] = useState(profile.home_place ?? "");
  const save = async (patch: Partial<Profile>) => {
    setMsg(null);
    const r = await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }).then((x) => x.json());
    if (r.ok) { setP(r.profile); setMsg("Saved."); } else setMsg(r.error === "username_taken" ? "That username is taken." : r.error ?? "Could not save.");
  };
  const setHome = async () => {
    const hit = await geocode(place).catch(() => null);
    if (!hit) { setMsg("Place not found."); return; }
    await save({ home_place: hit.name.split(",").slice(0, 3).join(","), home_lat: hit.lat, home_lng: hit.lng });
  };
  const alerts = async () => {
    const r = await fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "email", min_severity: p.alert_min_severity }) }).then((x) => x.json());
    setMsg(r.ok ? "Email alerts on for your home area and world breaking news." : r.error ?? "Could not subscribe.");
  };
  return (
    <div className="nx-grid">
      <div className="nx-card">
        <h3>Profile</h3>
        <label className="nx-label" style={{ marginTop: 10 }}>Display name<input className="nx-input" defaultValue={p.display_name ?? ""} onBlur={(e) => e.target.value !== p.display_name && save({ display_name: e.target.value })} /></label>
        <label className="nx-label">Username<input className="nx-input" defaultValue={p.username ?? ""} onBlur={(e) => e.target.value !== p.username && save({ username: e.target.value })} placeholder="3–24 letters, numbers, _" /></label>
        <label className="nx-label">Bio<textarea className="nx-textarea" style={{ minHeight: 60 }} defaultValue={p.bio ?? ""} onBlur={(e) => e.target.value !== p.bio && save({ bio: e.target.value })} /></label>
      </div>
      <div className="nx-card">
        <h3>Home area</h3>
        <p className="nx-muted">Your feed, alerts and posts default to this place.</p>
        <div style={{ display: "flex", gap: 8 }}><input className="nx-input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="New York, NY" /><button type="button" className="nx-btn nx-btn-sm" onClick={setHome}>Set</button></div>
        {p.home_place && <div className="nx-tiny" style={{ marginTop: 6 }}>Current: {p.home_place}</div>}
      </div>
      <div className="nx-card">
        <h3>Content & alerts</h3>
        <label className="nx-layer" style={{ marginTop: 10 }}><input type="checkbox" checked={p.show_graphic_media} onChange={(e) => save({ show_graphic_media: e.target.checked })} /> Show graphic news media (blurred until hover). Off hides it entirely.</label>
        <label className="nx-label" style={{ marginTop: 10 }}>Alert me from severity
          <select className="nx-select" value={p.alert_min_severity} onChange={(e) => save({ alert_min_severity: Number(e.target.value) })}><option value={3}>Major</option><option value={4}>Critical</option><option value={5}>Breaking only</option></select>
        </label>
        <label className="nx-label">Language<select className="nx-select" value={p.lang} onChange={(e) => save({ lang: e.target.value })}><option value="en">English</option><option value="es">Español</option></select></label>
        <div className="nx-actions"><button type="button" className="nx-btn nx-btn-2 nx-btn-sm" onClick={alerts}>Turn on email alerts</button><a className="nx-btn nx-btn-2 nx-btn-sm" href="/post">Reporter seat</a></div>
      </div>
      {msg && <div className="nx-notice">{msg}</div>}
    </div>
  );
}
