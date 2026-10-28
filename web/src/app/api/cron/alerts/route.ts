/**
 * Breaking alerts: a live story with severity ≥ a subscription's threshold, inside its
 * radius or country, is sent once. A failed send is retried with backoff, then marked dead.
 */
import { cronAuthorized, fail, json, siteUrl } from "@/lib/api";
import { alertFailedStatus, alertRetryState } from "@/lib/alerts";
import { haversineKm } from "@/lib/geo";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import type { Story } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Sub = { id: string; channel: "push" | "email" | "expo"; endpoint: Record<string, string>; lat: number | null; lng: number | null; radius_km: number; country: string | null; min_severity: number };
type Delivery = { id: string; subscription_id: string; story_id: string; status: string; created_at: string };

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const db = supabaseAdmin();
  const now = Date.now();
  const since = new Date(now - 15 * 60 * 1000).toISOString();
  const { data: stories } = await db.from("stories").select("*").eq("status", "live").gte("published_at", since).gte("severity", 3);
  const { data: subs } = await db.from("alert_subscriptions").select("*").eq("active", true);
  const { data: prior } = await db.from("alert_deliveries").select("id, subscription_id, story_id, status, created_at").neq("status", "sent").neq("status", "dead").order("created_at", { ascending: true }).limit(200);
  const retryRows = ((prior ?? []) as Delivery[]).filter((row) => alertRetryState(row.status, row.created_at, now).due);
  const retryStoryIds = [...new Set(retryRows.map((row) => row.story_id))];
  const known = new Map(((stories ?? []) as Story[]).map((story) => [story.id, story]));
  const missingIds = retryStoryIds.filter((id) => !known.has(id));
  if (missingIds.length) {
    const { data: older } = await db.from("stories").select("*").in("id", missingIds).eq("status", "live");
    for (const story of (older ?? []) as Story[]) known.set(story.id, story);
  }

  let sent = 0;
  let retried = 0;
  const errors: string[] = [];
  const subscriptions = (subs ?? []) as Sub[];
  for (const row of retryRows) {
    if (!known.has(row.story_id)) await db.from("alert_deliveries").update({ status: "dead" }).eq("id", row.id);
  }

  for (const story of known.values()) {
    for (const sub of subscriptions) {
      if (!matches(story, sub)) continue;
      const existing = ((prior ?? []) as Delivery[]).find((row) => row.subscription_id === sub.id && row.story_id === story.id)
        ?? await loadDelivery(db, sub.id, story.id);
      if (existing?.status === "sent" || existing?.status === "dead") continue;
      const state = existing ? alertRetryState(existing.status, existing.created_at, now) : { due: true, attempts: 0, terminal: false };
      if (existing && (!state.due || state.terminal)) continue;
      const isRetry = Boolean(existing);
      try {
        await deliver(sub, story, siteUrl(request));
        if (existing) await db.from("alert_deliveries").update({ status: "sent" }).eq("id", existing.id);
        else {
          const { error } = await db.from("alert_deliveries").insert({ subscription_id: sub.id, story_id: story.id, status: "sent" });
          if (error && !/duplicate|unique/i.test(error.message)) throw error;
        }
        sent++;
        if (isRetry) retried++;
      } catch (e) {
        errors.push((e as Error).message);
        const status = alertFailedStatus(state.attempts, now);
        if (existing) await db.from("alert_deliveries").update({ status }).eq("id", existing.id);
        else await db.from("alert_deliveries").insert({ subscription_id: sub.id, story_id: story.id, status });
      }
    }
  }
  return json({ ok: true, sent, retried, errors });
}

function matches(story: Story, sub: Sub): boolean {
  if (story.severity < sub.min_severity) return false;
  const local = sub.lat !== null && sub.lng !== null && story.lat !== null && story.lng !== null && haversineKm(sub.lat, sub.lng, story.lat, story.lng) <= sub.radius_km;
  const sameCountry = Boolean(sub.country && story.country === sub.country);
  return story.severity >= 5 || local || sameCountry;
}

async function loadDelivery(db: ReturnType<typeof supabaseAdmin>, subscriptionId: string, storyId: string): Promise<Delivery | null> {
  const { data } = await db.from("alert_deliveries").select("id, subscription_id, story_id, status, created_at").eq("subscription_id", subscriptionId).eq("story_id", storyId).maybeSingle();
  return (data as Delivery | null) ?? null;
}

async function deliver(sub: Sub, s: Story, site: string) {
  const title = `${s.severity >= 5 ? "BREAKING: " : ""}${s.headline}`;
  const url = `${site}/story/${s.slug}`;
  if (sub.channel === "expo" && sub.endpoint.expo_token) {
    const r = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: sub.endpoint.expo_token, title, body: s.summary.slice(0, 160), data: { url, slug: s.slug }, sound: "default", priority: "high" }) });
    if (!r.ok) throw new Error(`expo push ${r.status}`);
    return;
  }
  if (sub.channel === "email" && sub.endpoint.email && process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM || "Newsxis <newsxis@apixis.dev>", to: sub.endpoint.email, subject: title, text: `${s.summary}\n\n${[s.place_name, s.country].filter(Boolean).join(", ")}\n${url}\n\n${s.ai_label}. Manage alerts: ${site}/settings` }) });
    if (!r.ok) throw new Error(`resend ${r.status}`);
    return;
  }
  throw new Error(`channel ${sub.channel} not configured`);
}
