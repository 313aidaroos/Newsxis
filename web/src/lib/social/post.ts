/**
 * Posters for X, Facebook Pages and Bluesky. Each takes the account's decrypted credentials, the text
 * and an optional PNG card, and returns the external id/url. Rate rules live in the queue runner.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";
import { socialText } from "@/lib/ai/social-text";
import type { Story } from "@/lib/types";

export type Posted = { id: string; url: string | null };
type Creds = Record<string, string>;

// ---------------------------------------------------------------- Bluesky (AT Protocol, app password)
export async function postBluesky(creds: Creds, text: string, image: Buffer | null, alt: string): Promise<Posted> {
  const handle = creds.handle ?? process.env.BLUESKY_HANDLE, pass = creds.app_password ?? process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !pass) throw new Error("bluesky_not_configured");
  const base = "https://bsky.social/xrpc";
  const s = await (await fetch(`${base}/com.atproto.server.createSession`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: handle, password: pass }) })).json() as { did: string; accessJwt: string; error?: string };
  if (!s.accessJwt) throw new Error(`bluesky auth: ${s.error ?? "failed"}`);
  const auth = { authorization: `Bearer ${s.accessJwt}` };
  let embed: Record<string, unknown> | undefined;
  if (image) {
    const up = await (await fetch(`${base}/com.atproto.repo.uploadBlob`, { method: "POST", headers: { ...auth, "content-type": "image/png" }, body: new Uint8Array(image) })).json() as { blob?: unknown };
    if (up.blob) embed = { $type: "app.bsky.embed.images", images: [{ alt, image: up.blob }] };
  }
  const facets = linkFacets(text);
  const res = await (await fetch(`${base}/com.atproto.repo.createRecord`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", record: { $type: "app.bsky.feed.post", text, facets, embed, createdAt: new Date().toISOString(), langs: ["en"] } }) })).json() as { uri?: string; error?: string; message?: string };
  if (!res.uri) throw new Error(`bluesky post: ${res.error ?? res.message ?? "failed"}`);
  const rkey = res.uri.split("/").pop();
  return { id: res.uri, url: `https://bsky.app/profile/${handle}/post/${rkey}` };
}

function linkFacets(text: string) {
  const enc = new TextEncoder(); const out: Array<Record<string, unknown>> = [];
  for (const m of text.matchAll(/https?:\/\/\S+/g)) {
    const start = enc.encode(text.slice(0, m.index)).length, end = start + enc.encode(m[0]).length;
    out.push({ index: { byteStart: start, byteEnd: end }, features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }] });
  }
  return out;
}

// ---------------------------------------------------------------- X (API v2, OAuth 2.0 user token)
export async function postX(creds: Creds, text: string, image: Buffer | null): Promise<Posted> {
  const token = creds.access_token;
  if (!token) throw new Error("x_not_connected");
  let media_ids: string[] | undefined;
  if (image) {
    // v2 media upload (chunked endpoint accepts a single small PNG in one INIT/APPEND/FINALIZE; keep it simple with the legacy simple upload)
    const form = new FormData(); form.append("media_data", image.toString("base64")); form.append("media_category", "tweet_image");
    const up = await fetch("https://upload.twitter.com/1.1/media/upload.json", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
    const j = await up.json().catch(() => ({})) as { media_id_string?: string };
    if (j.media_id_string) media_ids = [j.media_id_string];
  }
  const res = await fetch("https://api.x.com/2/tweets", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ text, ...(media_ids ? { media: { media_ids } } : {}) }) });
  const j = await res.json().catch(() => ({})) as { data?: { id: string }; detail?: string; title?: string };
  if (!res.ok || !j.data?.id) throw new Error(`x post ${res.status}: ${j.detail ?? j.title ?? "failed"}`);
  return { id: j.data.id, url: creds.username ? `https://x.com/${creds.username}/status/${j.data.id}` : null };
}

// ---------------------------------------------------------------- Facebook Page (Graph API, page token)
export async function postFacebook(creds: Creds, text: string, imageUrl: string | null): Promise<Posted> {
  const token = creds.page_token, pageId = creds.page_id;
  if (!token || !pageId) throw new Error("facebook_not_connected");
  const v = process.env.META_GRAPH_VERSION || "v21.0";
  const endpoint = imageUrl ? `https://graph.facebook.com/${v}/${pageId}/photos` : `https://graph.facebook.com/${v}/${pageId}/feed`;
  const body = new URLSearchParams(imageUrl ? { url: imageUrl, caption: text, access_token: token } : { message: text, access_token: token });
  const res = await fetch(endpoint, { method: "POST", body });
  const j = await res.json().catch(() => ({})) as { id?: string; post_id?: string; error?: { message: string } };
  const id = j.post_id ?? j.id;
  if (!res.ok || !id) throw new Error(`facebook post: ${j.error?.message ?? "failed"}`);
  return { id, url: `https://www.facebook.com/${id}` };
}

// ---------------------------------------------------------------- queue runner
type Account = { id: string; platform: "x" | "facebook" | "bluesky"; handle: string; credentials: string | null; min_gap_seconds: number; last_posted_at: string | null };

export async function runSocialQueue(db: SupabaseClient, siteUrl: string, limit = 6): Promise<{ posted: number; failed: number; waiting: number }> {
  const out = { posted: 0, failed: 0, waiting: 0 };
  const { data: accounts } = await db.from("social_accounts").select("*").eq("active", true);
  for (const a of (accounts ?? []) as Account[]) {
    const gapOk = !a.last_posted_at || Date.now() - Date.parse(a.last_posted_at) >= a.min_gap_seconds * 1000;
    const { data: queue } = await db.from("social_posts").select("id, story:stories(*)").eq("account_id", a.id).eq("status", "queued").order("created_at", { ascending: true }).limit(limit);
    if (!queue?.length) continue;
    // Breaking (sev 5) skips the gap; everything else waits for it. One post per account per run.
    const next = (queue as unknown as Array<{ id: string; story: Story }>).sort((x, y) => y.story.severity - x.story.severity)[0];
    if (!gapOk && next.story.severity < 5) { out.waiting++; continue; }
    const text = socialText(next.story, siteUrl, a.platform);
    const cardUrl = `${siteUrl.replace(/\/$/, "")}/api/card/${next.story.slug}`;
    try {
      let creds: Creds = {};
      if (a.credentials) creds = decrypt<Creds>(a.credentials);
      let card: Buffer | null = null;
      if (a.platform !== "facebook") {
        try { const r = await fetch(cardUrl, { signal: AbortSignal.timeout(15_000) }); if (r.ok) card = Buffer.from(await r.arrayBuffer()); } catch { card = null; }
      }
      const posted = a.platform === "bluesky" ? await postBluesky(creds, text, card, next.story.headline)
        : a.platform === "x" ? await postX(creds, text, card)
        : await postFacebook(creds, text, cardUrl);
      await db.from("social_posts").update({ status: "posted", text, image_url: cardUrl, external_id: posted.id, external_url: posted.url, posted_at: new Date().toISOString() }).eq("id", next.id);
      await db.from("social_accounts").update({ last_posted_at: new Date().toISOString(), last_error: null }).eq("id", a.id);
      out.posted++;
    } catch (e) {
      await db.from("social_posts").update({ status: "failed", text, error: (e as Error).message.slice(0, 500) }).eq("id", next.id);
      await db.from("social_accounts").update({ last_error: (e as Error).message.slice(0, 500) }).eq("id", a.id);
      out.failed++;
    }
  }
  return out;
}
