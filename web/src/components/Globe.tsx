"use client";
/**
 * The Newsxis globe: a 3D MapLibre globe that zooms from the world to a street in satellite view.
 * Layers: stories (by severity), radio stations (tap to listen), reporter posts. Time slider over the
 * last 7 days; "Ask Cixy" narrates what happened in view (owner #18). Search jumps to any place.
 * Tiles: MapTiler satellite when NEXT_PUBLIC_MAPTILER_KEY is set, else free OSM raster (no satellite).
 */
import maplibregl, { type Map as MlMap, type StyleSpecification } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post, Source, Story } from "@/lib/types";

export type Layers = { stories: boolean; stations: boolean; posts: boolean; alerts: boolean };
type Props = {
  stories: Story[]; stations: Source[]; posts: Post[];
  focus?: { lat: number; lng: number; zoom?: number } | null;
  onViewChange?: (bbox: [number, number, number, number], zoom: number, center: { lat: number; lng: number }) => void;
  onStory?: (s: Story) => void;
  onStation?: (s: Source) => void;
  layers: Layers;
  showGraphic: boolean;
};

const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

function style(): StyleSpecification | string {
  if (KEY) return `https://api.maptiler.com/maps/hybrid/style.json?key=${KEY}`;
  return {
    version: 8,
    sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors", maxzoom: 19 } },
    layers: [{ id: "bg", type: "background", paint: { "background-color": "#020308" } }, { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.6, "raster-brightness-max": 0.75, "raster-contrast": 0.2 } }],
  };
}

export function Globe({ stories, stations, posts, focus, onViewChange, onStory, onStation, layers, showGraphic }: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({ container: el.current, style: style(), center: [-30, 25], zoom: 1.6, attributionControl: { compact: true }, maxZoom: 19 });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, trackUserLocation: false }), "bottom-right");
    m.on("style.load", () => {
      try { m.setProjection({ type: "globe" }); } catch { /* older maplibre */ }
      try { m.setSky({ "sky-color": "#06102a", "horizon-color": "#0b1a40", "fog-color": "#05070f", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.9, "fog-ground-blend": 0.8 }); } catch { /* optional */ }
      setReady(true);
    });
    const emit = () => {
      if (!onViewChange) return;
      const b = m.getBounds(), c = m.getCenter();
      onViewChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], m.getZoom(), { lat: c.lat, lng: c.lng });
    };
    m.on("moveend", emit);
    map.current = m;
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slow idle spin on the world view, like a newsroom wall.
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    let raf = 0; let stop = false;
    const spin = () => { if (stop) return; if (m.getZoom() < 2.2 && !m.isMoving()) { const c = m.getCenter(); m.setCenter([c.lng + 0.04, c.lat]); } raf = requestAnimationFrame(spin); };
    raf = requestAnimationFrame(spin);
    const halt = () => { stop = true; cancelAnimationFrame(raf); };
    m.once("mousedown", halt); m.once("touchstart", halt); m.once("wheel", halt);
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [ready]);

  useEffect(() => {
    const m = map.current; if (!m || !focus) return;
    m.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 9, duration: 1800, essential: true });
  }, [focus]);

  const popupHtml = useCallback((s: Story) => {
    const place = [s.place_name ?? s.city, s.country].filter(Boolean).join(", ");
    const chip = s.severity >= 5 ? "BREAKING" : s.severity === 4 ? "CRITICAL" : s.severity === 3 ? "MAJOR" : s.category.toUpperCase();
    const status = s.disputed ? "Disputed" : s.confirmed ? "Confirmed" : "Unconfirmed";
    return `<div class="nx-tiny">${chip} · ${status} · ${place}</div><h4>${esc(s.headline)}</h4><p>${esc(s.summary.slice(0, 180))}${s.summary.length > 180 ? "…" : ""}</p><a href="/story/${s.slug}">Open story →</a>`;
  }, []);

  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    markers.current.forEach((k) => k.remove()); markers.current = [];
    if (layers.stories) for (const s of stories) {
      if (s.lat === null || s.lng === null) continue;
      if (s.graphic && !showGraphic) continue;
      const d = document.createElement("div"); d.className = `nx-marker nx-marker-sev${s.severity}`; d.title = s.headline;
      const mk = new maplibregl.Marker({ element: d }).setLngLat([s.lng, s.lat]).setPopup(new maplibregl.Popup({ className: "nx-popup", offset: 12 }).setHTML(popupHtml(s))).addTo(m);
      d.addEventListener("click", () => onStory?.(s));
      markers.current.push(mk);
    }
    if (layers.stations) for (const st of stations) {
      if (st.lat === null || st.lng === null || !st.stream_url) continue;
      const d = document.createElement("div"); d.className = "nx-marker nx-marker-station"; d.title = `${st.name} · tap to listen`;
      const mk = new maplibregl.Marker({ element: d }).setLngLat([st.lng, st.lat]).setPopup(new maplibregl.Popup({ className: "nx-popup", offset: 10 }).setHTML(`<div class="nx-tiny">LIVE RADIO · ${esc(st.city ?? st.country ?? "")}</div><h4>${esc(st.name)}</h4><a href="/radio?station=${esc(st.slug ?? st.id)}">Listen live →</a>`)).addTo(m);
      d.addEventListener("click", () => onStation?.(st));
      markers.current.push(mk);
    }
    if (layers.posts) for (const p of posts) {
      if (p.lat === null || p.lng === null) continue;
      const d = document.createElement("div"); d.className = "nx-marker nx-marker-post"; d.title = "Reporter post";
      const mk = new maplibregl.Marker({ element: d }).setLngLat([p.lng, p.lat]).setPopup(new maplibregl.Popup({ className: "nx-popup", offset: 10 }).setHTML(`<div class="nx-tiny">REPORTER · ${esc(p.author?.display_name ?? p.author?.username ?? "")}${p.author?.verified_reporter ? " ✓" : ""}</div><p>${esc(p.body.slice(0, 200))}</p><a href="/feed?tab=reporters&post=${p.id}">Open →</a>`)).addTo(m);
      markers.current.push(mk);
    }
  }, [stories, stations, posts, layers, showGraphic, ready, popupHtml, onStory, onStation]);

  const attribution = useMemo(() => (KEY ? "Satellite © MapTiler · © OpenStreetMap" : "© OpenStreetMap contributors · add NEXT_PUBLIC_MAPTILER_KEY for satellite"), []);
  return <div ref={el} className="nx-globe" style={{ position: "absolute", inset: 0 }} aria-label={`World map. ${attribution}`} />;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Free place search (Nominatim) → first hit. */
export async function geocode(q: string): Promise<{ lat: number; lng: number; name: string; zoom: number } | null> {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { accept: "application/json" } });
  const j = await r.json().catch(() => []) as Array<{ lat: string; lon: string; display_name: string; type: string; class: string }>;
  if (!j.length) return null;
  const t = j[0].type;
  const zoom = t === "country" ? 4.5 : t === "state" || t === "region" || t === "province" ? 6.5 : t === "city" || t === "town" || t === "administrative" ? 11 : t === "village" || t === "suburb" || t === "neighbourhood" ? 13.5 : 16;
  return { lat: Number(j[0].lat), lng: Number(j[0].lon), name: j[0].display_name, zoom };
}
