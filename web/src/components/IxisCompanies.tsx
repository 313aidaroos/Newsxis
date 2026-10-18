"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

// Ixis companies shown in the footer "Ixis companies" card.
// Same list, briefs, and URLs as Deduxis.dev PR #10. Live domains only; never *.vercel.app.
export type IxisCompany = { name: string; brief: string; url: string };

export const IXIS_COMPANIES: readonly IxisCompany[] = [
  { name: "Apixis", brief: "Virtual world and economy for AI agents.", url: "https://www.apixis.dev" },
  { name: "Apixis Wallet", brief: "One wallet for payments across the Ixis family.", url: "https://wallet.apixis.dev" },
  { name: "Socixis", brief: "AI marketing and social media agent.", url: "https://socixis.dev" },
  { name: "Renoxis", brief: "Real estate personal assistant.", url: "https://renoxis.dev" },
  { name: "Rawixis", brief: "Marketplace for raw materials.", url: "https://rawixis.dev" },
  { name: "Contraxis", brief: "Connects homeowners and contractors with AI.", url: "https://contraxis.dev" },
  { name: "Pinixis", brief: "Custom arcade and pinball machines, built to order.", url: "https://pinixis.dev" },
  { name: "Ominixis", brief: "Marketplace and transaction layer for the AI economy.", url: "https://ominixis.apixis.dev" },
  { name: "Lyrixis", brief: "Music metadata, lyrics, and catalog intelligence.", url: "https://lyrixis.apixis.dev" },
  { name: "Halaxis", brief: "Halal and Sharia-compliant investing.", url: "https://halaxis.apixis.dev" },
  { name: "Geoxis", brief: "Live 3D map of everything a company has moving.", url: "https://geoxis.apixis.dev" },
  { name: "Wattixis", brief: "Marketplace for spare energy.", url: "https://wattixis.apixis.dev" },
  { name: "Launchixis", brief: "Launch tools for new companies.", url: "https://launchixis.apixis.dev" },
  { name: "Newsxis", brief: "Real-time news from every place on Earth.", url: "https://newsxis.apixis.dev" },
];

const THEME = { "--ixis-bg": "#ffffff", "--ixis-fg": "#10182c", "--ixis-muted": "#6b7c99", "--ixis-accent": "#1e5bb8", "--ixis-hover": "#e7eef6", "--ixis-line": "#cdd9ea" };

const CSS = `
.ixis-menu.ixis-menu{position:relative;display:inline-block;font:inherit}
.ixis-menu.ixis-menu .ixis-trigger{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;display:inline-flex;gap:5px;align-items:center}
.ixis-menu.ixis-menu .ixis-trigger span{font-size:.75em}
.ixis-menu.ixis-menu:hover .ixis-trigger,.ixis-menu.ixis-menu.is-open .ixis-trigger,.ixis-menu.ixis-menu .ixis-trigger:focus-visible{color:var(--ixis-accent)}
.ixis-menu.ixis-menu .ixis-panel{position:absolute;left:0;bottom:calc(100% + 12px);width:min(360px,calc(100vw - 32px));max-height:min(440px,70vh);overflow-y:auto;background:var(--ixis-bg);color:var(--ixis-fg);border:1px solid var(--ixis-line);border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.28);padding:14px 10px 10px;opacity:0;visibility:hidden;transform:translateY(6px);transition:opacity .15s,transform .15s,visibility .15s;z-index:60;text-align:left;font-size:12px;line-height:1.35;letter-spacing:normal;text-transform:none}
.ixis-menu.ixis-menu.ixis-right .ixis-panel{left:auto;right:0}
.ixis-menu.ixis-menu .ixis-panel::after{content:"";position:absolute;left:0;right:0;bottom:-14px;height:14px}
@media (hover:hover){.ixis-menu.ixis-menu:hover .ixis-panel{opacity:1;visibility:visible;transform:none}}
.ixis-menu.ixis-menu:focus-within .ixis-panel,.ixis-menu.ixis-menu.is-open .ixis-panel{opacity:1;visibility:visible;transform:none}
.ixis-menu.ixis-menu .ixis-panel-title{margin:0 8px 8px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ixis-muted)}
.ixis-menu.ixis-menu .ixis-panel ul{list-style:none;margin:0;padding:0}
.ixis-menu.ixis-menu .ixis-panel li{margin:0;padding:0}
.ixis-menu.ixis-menu .ixis-panel a,.ixis-menu.ixis-menu .ixis-panel .ixis-here{display:grid;gap:2px;padding:8px;border-radius:10px;color:var(--ixis-fg);text-decoration:none}
.ixis-menu.ixis-menu .ixis-panel a:hover,.ixis-menu.ixis-menu .ixis-panel a:focus-visible{background:var(--ixis-hover)}
.ixis-menu.ixis-menu .ixis-panel strong{font-size:13px;font-weight:600;color:var(--ixis-fg)}
.ixis-menu.ixis-menu .ixis-panel .ixis-brief{color:var(--ixis-muted)}
.ixis-menu.ixis-menu .ixis-panel .ixis-here{background:var(--ixis-hover)}
.ixis-menu.ixis-menu .ixis-panel .ixis-badge{margin-left:6px;font-size:10px;font-weight:600;color:var(--ixis-accent)}
@media (max-width:760px){.ixis-menu.ixis-menu .ixis-panel{position:fixed;left:16px;right:16px;bottom:16px;width:auto;max-height:70vh}.ixis-menu.ixis-menu .ixis-panel::after{display:none}}
`;

/** Footer "Ixis companies" trigger. Hover or focus opens a card (desktop); tap opens a bottom sheet (mobile). Outside click or Esc closes. */
export function IxisCompanies({ current, align = "left" }: { current?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className={`ixis-menu${align === "right" ? " ixis-right" : ""}${open ? " is-open" : ""}`} style={THEME as CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <button type="button" className="ixis-trigger" aria-expanded={open} aria-controls="ixis-panel" onClick={() => setOpen((v) => !v)}>
        Ixis companies <span aria-hidden="true">▴</span>
      </button>
      <div id="ixis-panel" className="ixis-panel" role="region" aria-label="Ixis companies">
        <p className="ixis-panel-title">The Ixis family</p>
        <ul>
          {IXIS_COMPANIES.map((c) => (
            <li key={c.name}>
              {c.name === current ? (
                <div className="ixis-here" aria-current="page">
                  <strong>
                    {c.name}
                    <span className="ixis-badge">You are here</span>
                  </strong>
                  <span className="ixis-brief">{c.brief}</span>
                </div>
              ) : (
                <a href={c.url} target="_blank" rel="noopener noreferrer">
                  <strong>{c.name}</strong>
                  <span className="ixis-brief">{c.brief}</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
