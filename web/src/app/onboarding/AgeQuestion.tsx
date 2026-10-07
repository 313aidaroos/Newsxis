"use client";
import { useState } from "react";

export function AgeQuestion({ blocked }: { blocked: boolean }) {
  const [msg, setMsg] = useState<string | null>(blocked ? "Newsxis is for people 13 and older. This account cannot continue." : null);
  const [busy, setBusy] = useState(false);

  const answer = async (value: "yes" | "no") => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/age", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answer: value }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    if (!r.ok) {
      setBusy(false);
      setMsg(r.error === "age_blocked" ? "Newsxis is for people 13 and older. This account cannot continue." : "Could not save that answer. Try again.");
      return;
    }
    if (r.blocked) {
      await fetch("/auth/signout", { method: "POST" }).catch(() => undefined);
      window.location.href = "/login?error=under_13";
      return;
    }
    window.location.href = "/";
  };

  if (blocked) {
    return (
      <div className="nx-card">
        <h1 className="nx-h1">Newsxis is for ages 13 and up</h1>
        <p className="nx-muted">This account is closed to Newsxis. You can sign out and use other Apixis sites with the same Apixis ID.</p>
        <form action="/auth/signout" method="post"><button className="nx-btn" type="submit">Sign out</button></form>
      </div>
    );
  }

  return (
    <div className="nx-card">
      <h1 className="nx-h1">Are you 13 or older?</h1>
      <p className="nx-muted">Newsxis is a newsroom. Graphic news can appear, blurred and off until you opt in. You need to answer before using a signed-in account. Watching without an account stays free.</p>
      {msg && <div className="nx-alert" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="nx-actions">
        <button className="nx-btn" type="button" disabled={busy} onClick={() => answer("yes")}>Yes, I am 13 or older</button>
        <button className="nx-btn nx-btn-2" type="button" disabled={busy} onClick={() => answer("no")}>No</button>
      </div>
    </div>
  );
}
