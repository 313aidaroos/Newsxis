"use client";
import { useEffect, useState } from "react";

/** "Your agent is ready. Enter the Apixis world" (family pattern; owner #28). */
export function WorldAgentCard() {
  const [v, setV] = useState<{ status: "ready" | "invite"; agentName: string | null; showWelcome: boolean; enterUrl: string } | null>(null);
  useEffect(() => { fetch("/api/apixis/world-agent", { cache: "no-store" }).then((r) => r.json()).then((d) => d.ok && setV(d)).catch(() => undefined); }, []);
  if (!v) return null;
  const act = async (action: "enter" | "dismiss") => { await fetch("/api/apixis/world-agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => undefined); if (action === "enter") window.open(v.enterUrl, "_blank", "noopener"); else setV({ ...v, showWelcome: false }); };
  return (
    <div className="nx-card" style={{ marginBottom: 16 }}>
      <div className="nx-card-head"><h3>Your Apixis world agent</h3><span className={`nx-chip ${v.status === "ready" ? "nx-chip-ok" : ""}`}>{v.status === "ready" ? `Ready${v.agentName ? ` · ${v.agentName}` : ""}` : "Created when you enter"}</span></div>
      <p className="nx-muted">Every Newsxis account has its own agent in the Apixis world, sharing your one Wallet.</p>
      <div className="nx-actions"><button type="button" className="nx-btn nx-btn-sm" onClick={() => act("enter")}>Enter the Apixis world</button>{v.showWelcome && <button type="button" className="nx-btn nx-btn-2 nx-btn-sm" onClick={() => act("dismiss")}>Not now</button>}</div>
    </div>
  );
}
