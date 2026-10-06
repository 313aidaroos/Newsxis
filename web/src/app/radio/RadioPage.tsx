"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Briefing, Source } from "@/lib/types";
import { ago } from "@/components/StoryCard";

export function RadioPage({ stations, briefings }: { stations: Source[]; briefings: Briefing[] }) {
  const params = useSearchParams();
  const [station, setStation] = useState<Source | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const want = params.get("station");
    if (want) setStation(stations.find((s) => s.slug === want || s.id === want) ?? null);
  }, [params, stations]);
  const byCountry = useMemo(() => {
    const m = new Map<string, Source[]>();
    for (const s of stations) { const k = s.country ?? "World"; m.set(k, [...(m.get(k) ?? []), s]); }
    return [...m.entries()].sort((a, b) => (a[0] === "US" ? -1 : b[0] === "US" ? 1 : a[0].localeCompare(b[0])));
  }, [stations]);
  const current = briefings[idx];
  return (
    <div className="nx-grid nx-grid-2">
      <section className="nx-card">
        <div className="nx-cixy" style={{ marginBottom: 12 }}>
          <div className="nx-cixy-orb" />
          <div><h2 style={{ textTransform: "none", letterSpacing: 0, fontSize: 18, color: "var(--nx-ink)" }}>Newsxis Radio · Cixy</h2><div className="nx-tiny">Hourly world briefings, regional briefings every 3 hours, breaking bulletins as they happen.</div></div>
        </div>
        {briefings.length === 0 ? (
          <div className="nx-notice">No audio briefings yet. Text briefings are on the <a href="/briefing" style={{ color: "var(--nx-accent)" }}>Cixy page</a>; audio starts once her voice is connected.</div>
        ) : (
          <div className="nx-player">
            <div className="nx-story-meta"><span className="nx-chip nx-chip-ai">{current.kind.toUpperCase()} · {current.lang.toUpperCase()}</span><span>{current.title}</span><span>· {ago(current.created_at)}</span></div>
            <audio ref={audio} src={current.audio_url ?? undefined} controls autoPlay={playing} onEnded={() => { if (idx < briefings.length - 1) { setIdx(idx + 1); setPlaying(true); } }} />
            <div className="nx-actions">
              <button type="button" className="nx-btn nx-btn-sm" onClick={() => { setIdx(0); setPlaying(true); setTimeout(() => audio.current?.play(), 50); }}>▶ Play the station</button>
              <button type="button" className="nx-btn nx-btn-2 nx-btn-sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Newer</button>
              <button type="button" className="nx-btn nx-btn-2 nx-btn-sm" disabled={idx >= briefings.length - 1} onClick={() => setIdx(idx + 1)}>Older</button>
            </div>
            <details><summary className="nx-tiny" style={{ cursor: "pointer" }}>Read the script</summary><div className="nx-script" style={{ marginTop: 8 }}>{current.script}</div></details>
          </div>
        )}
      </section>
      <section className="nx-card">
        <div className="nx-card-head"><h3>Live stations Cixy listens to</h3><span className="nx-tiny">{stations.length}</span></div>
        {station && (
          <div className="nx-notice" style={{ marginBottom: 12 }}>
            <strong>{station.name}</strong> · {[station.city, station.country].filter(Boolean).join(", ")}
            <audio src={station.stream_url ?? undefined} controls autoPlay style={{ width: "100%", marginTop: 8 }} />
            <div className="nx-tiny">Streams are played from the station's own server. If it does not start, the station may block browser playback; open it on <a href={station.url ?? "#"} target="_blank" rel="noreferrer" style={{ color: "var(--nx-accent)" }}>their site</a>.</div>
          </div>
        )}
        <div className="nx-grid" style={{ gap: 8 }}>
          {byCountry.map(([country, list]) => (
            <div key={country}>
              <div className="nx-tiny" style={{ margin: "6px 0" }}>{country}</div>
              {list.map((s) => (
                <div key={s.id} className="nx-station" style={{ marginBottom: 6 }}>
                  <div><strong>{s.name}</strong><small>{[s.city, s.region].filter(Boolean).join(", ")} · {s.lang.toUpperCase()}{s.last_ok_at ? ` · heard ${ago(s.last_ok_at)}` : ""}</small></div>
                  <button type="button" className={`nx-btn nx-btn-sm ${station?.id === s.id ? "" : "nx-btn-2"}`} onClick={() => setStation(s)}>{station?.id === s.id ? "Playing" : "Listen"}</button>
                </div>
              ))}
            </div>
          ))}
          {stations.length === 0 && <div className="nx-empty">No stations configured yet.</div>}
        </div>
      </section>
    </div>
  );
}
