"use client";
import { useState } from "react";

export function SupportForm({ kind, storyId }: { kind?: string; storyId?: string }) {
  const [f, setF] = useState({ kind: kind ?? "support", email: "", subject: "", body: "" });
  const [res, setRes] = useState<{ ok: boolean; reply?: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const r = await fetch("/api/support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, story_id: storyId }) }).then((x) => x.json()).catch(() => ({ ok: false, error: "network" }));
    setRes(r); setBusy(false);
  };
  if (res?.ok) return <div className="nx-card"><h3>Received</h3><p style={{ marginTop: 10 }}>{res.reply ?? "Thank you. The editor will reply by email."}</p><p className="nx-tiny">Ticket recorded. Corrections and takedowns are reviewed by a person.</p></div>;
  return (
    <form className="nx-card" onSubmit={submit}>
      <label className="nx-label">What is this about?
        <select className="nx-select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          <option value="support">Support</option><option value="complaint">Complaint</option><option value="correction">Correction (a story is wrong)</option><option value="takedown">Takedown request</option><option value="ads">Advertising / sponsorship</option><option value="partnership">Partnership</option><option value="other">Other</option>
        </select>
      </label>
      <label className="nx-label">Your email<input className="nx-input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label className="nx-label">Subject<input className="nx-input" required maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
      <label className="nx-label">Details<textarea className="nx-textarea" required maxLength={5000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder={f.kind === "correction" ? "Which story, what is wrong, and where we can verify the correct information." : ""} /></label>
      {res?.error && <div className="nx-alert" style={{ marginBottom: 10 }}>{res.error === "rate_limited" ? "Too many messages. Try again in an hour." : "Could not send. Email newsxis@apixis.dev instead."}</div>}
      <button className="nx-btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Send"}</button>
    </form>
  );
}
