"use client";
import { useState } from "react";

export function LoginCard({ next, error }: { next: string; error?: string }) {
  const [ofAge, setOfAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const errors: Record<string, string> = {
    login_expired: "That sign-in link expired. Try again.",
    apixis_unavailable: "Apixis ID is busy right now. Try again in a moment.",
    account_error: "We could not create your account. Contact newsxis@apixis.dev.",
    session_error: "Sign-in did not complete. Try again.",
    age_required: "Confirm that you are 13 or older before signing in.",
    under_13: "Newsxis is for people 13 and older. This account cannot continue.",
  };

  const go = async () => {
    if (!ofAge) { setLocalError("Newsxis is for people 13 and older."); return; }
    setBusy(true); setLocalError(null);
    const r = await fetch("/api/age/attest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ofAge: true, next }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    if (r.ok && typeof r.url === "string") { window.location.href = r.url; return; }
    setBusy(false);
    setLocalError("Confirm that you are 13 or older before signing in.");
  };

  return (
    <div className="nx-card" style={{ textAlign: "center", padding: 28 }}>
      <div className="nx-brand" style={{ justifyContent: "center", marginBottom: 10 }}><span className="nx-brand-dot" />NEWSXIS</div>
      <h1 className="nx-h1" style={{ fontSize: 24 }}>One Apixis account for every family site</h1>
      <p className="nx-muted">Watching Newsxis is free, no account needed. Sign in to post from the ground, chat, pick your home area and get breaking alerts. Every new account gets its own agent in the Apixis world with the shared Wallet.</p>
      {(error || localError) && <div className="nx-alert" style={{ margin: "12px 0" }}>{localError ?? errors[error ?? ""] ?? "Sign-in failed. Try again."}</div>}
      <label className="nx-layer" style={{ margin: "14px 0", justifyContent: "center" }}>
        <input type="checkbox" checked={ofAge} onChange={(e) => setOfAge(e.target.checked)} />
        I am 13 or older
      </label>
      <button className="nx-btn" type="button" disabled={!ofAge || busy} onClick={go} style={{ width: "100%" }}>{busy ? "Continuing…" : "Sign in with Apixis"}</button>
      <p className="nx-tiny">By signing in you accept the Newsxis terms: AI-written news is labeled, posts are moderated, and a reporter seat is $10 to activate plus $10 a month, by card or Ixis, through the Apixis Wallet.</p>
    </div>
  );
}
