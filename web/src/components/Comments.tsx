"use client";
import { useEffect, useState } from "react";
import { ago } from "./StoryCard";

type C = { id: string; body: string; created_at: string; author: { display_name: string | null; username: string | null; verified_reporter: boolean } | null };

export function Comments({ storyId, postId, signedIn }: { storyId?: string; postId?: string; signedIn: boolean }) {
  const [items, setItems] = useState<C[]>([]);
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const key = storyId ? `story=${storyId}` : `post=${postId}`;
  const load = () => fetch(`/api/comments?${key}`, { cache: "no-store" }).then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => undefined);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    const r = await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body, story_id: storyId, post_id: postId }) }).then((x) => x.json());
    if (!r.ok) {
      setMsg(r.error === "sign_in_required" ? "Sign in to comment." : r.error === "age_required" ? "Confirm that you are 13 or older before commenting." : r.error === "comment_rejected" ? "That comment can't be posted." : "Could not post. Try again.");
      return;
    }
    setBody("");
    if (r.status === "held" || r.status === "pending") setMsg("Your comment is waiting for a quick review.");
    load();
  };
  return (
    <div className="nx-grid" style={{ gap: 10 }}>
      {items.length === 0 && <div className="nx-tiny">No comments yet.</div>}
      {items.map((c) => <div key={c.id} className="nx-station" style={{ display: "block" }}><div className="nx-tiny">{c.author?.display_name ?? c.author?.username ?? "Someone"}{c.author?.verified_reporter ? " ✓" : ""} · {ago(c.created_at)}</div><div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{c.body}</div></div>)}
      {signedIn ? (
        <form onSubmit={send} className="nx-grid" style={{ gap: 8 }}>
          <textarea className="nx-textarea" style={{ minHeight: 70 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add what you know. Be specific; say where it came from." maxLength={2000} />
          <div className="nx-actions"><button className="nx-btn nx-btn-sm" type="submit" disabled={!body.trim()}>Comment</button>{msg && <span className="nx-tiny">{msg}</span>}</div>
        </form>
      ) : <a className="nx-btn nx-btn-2 nx-btn-sm" href="/login" style={{ justifySelf: "start" }}>Sign in to comment</a>}
    </div>
  );
}
