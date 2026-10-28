"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apixisLoginHref } from "@/lib/public-site";
import { NEWSXIS_PRODUCTS } from "@/lib/products";

export function BoostStory({ storyId, returnPath, pinnedUntil, signedIn }: { storyId: string; returnPath: string; pinnedUntil: string | null; signedIn: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<"card" | "ixis">("card");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const price = NEWSXIS_PRODUCTS["newsxis.boost.story"];
  const until = pinnedUntil && Date.parse(pinnedUntil) > Date.now() ? new Date(pinnedUntil).toLocaleString() : null;

  const buy = async () => {
    setBusy(true); setMsg(null); setOk(false);
    const r = method === "card"
      ? await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method: "card", product: "newsxis.boost.story", storyId }) }).then((x) => x.json()).catch(() => ({ ok: false, message: "Could not reach the Wallet." }))
      : await fetch("/api/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productKey: "newsxis.boost.story", attemptId: crypto.randomUUID(), storyId }) }).then((x) => x.json()).catch(() => ({ ok: false, message: "Could not reach the Wallet." }));
    setBusy(false);
    if (r.ok && r.url) { window.location.href = r.url; return; }
    if (r.ok) {
      setOk(true);
      setMsg(r.receiptUrl ? `Pinned for 24 hours. Receipt: ${r.receiptUrl}` : "Pinned for 24 hours. The receipt is on the billing page.");
      router.refresh();
      return;
    }
    setMsg(r.gap === "endpoint_missing"
      ? "Card checkout for a pin is not available yet. The Wallet has not shipped it, so nothing was charged."
      : r.message ?? r.error ?? "The Wallet could not start this purchase. Nothing was charged.");
  };

  return (
    <section className="nx-card">
      <p className="nx-kicker">Pin</p>
      <h2>Pin this story for 24 hours</h2>
      <p className="nx-muted">{price.ixis.toLocaleString("en-US")} Ixis (${price.usd}). It goes first in the feed while the pin lasts. Card or Ixis, through the Apixis Wallet. The pin is this story only.</p>
      {until && <p className="nx-tiny">Pinned until {until}.</p>}
      {!signedIn && <a className="nx-btn" href={apixisLoginHref(returnPath)}>Sign in with Apixis</a>}
      {signedIn && (
        <div className="nx-actions">
          <label className="nx-layer"><input type="radio" name="boost-pay" checked={method === "card"} onChange={() => setMethod("card")} /> Card</label>
          <label className="nx-layer"><input type="radio" name="boost-pay" checked={method === "ixis"} onChange={() => setMethod("ixis")} /> Ixis</label>
          <button className="nx-btn" type="button" disabled={busy} onClick={buy}>{busy ? "Contacting the Wallet…" : "Pin this story"}</button>
        </div>
      )}
      {msg && <p className={ok ? "nx-notice" : "nx-alert"}>{msg}</p>}
    </section>
  );
}
