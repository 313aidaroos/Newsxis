/**
 * Breaking alerts: for every live story (last 15 min) with severity ≥ a subscription's threshold and
 * inside its radius/country, send once. Channels: web push (VAPID, when configured), Expo push, email (Resend).
 */
import { cronAuthorized, fail, json, siteUrl } from "@/lib/api";
import { serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import { haversineKm } from "@/lib/geo";
import type { Story } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Sub = { id: string; channel: "push" | "email" | "expo"; endpoint: Record<string, string>; lat: number | null; lng: number | null; radius_km: number; country: string | null; min_severity: number };

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail("unauthorized", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: stories } = await db.from("stories").select("*").eq("status", "live").gte("published_at", since).gte("severity", 3);
  const { data: subs } = await db.from("alert_subscriptions").select("*").eq("active", true);
  let sent = 0; const errors: string[] = [];
  for (const s of (stories ?? []) as Story[]) {
    for (const sub of (subs ?? []) as Sub[]) {
      if (s.severity < sub.min_severity) continue;
      const local = sub.lat !== null && sub.lng !== null && s.lat !== null && s.lng !== null && haversineKm(sub.lat, sub.lng, s.lat, s.lng) <= sub.radius_km;
      const sameCountry = sub.country && s.country === sub.country;
      if (!(s.severity >= 5 || local || sameCountry)) continue;
      const { data: dup } = await db.from("alert_deliveries").insert({ subscription_id: sub.id, story_id: s.id }).select("id");
      if (!dup?.length) continue;   // already delivered
      try {
        await deliver(sub, s, siteUrl(request));
        sent++;
      } catch (e) { errors.push((e as Error).message); await db.from("alert_deliveries").update({ status: "failed" }).eq("subscription_id", sub.id).eq("story_id", s.id); }
    }
  }
  return json({ ok: true, sent, errors });
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
  // Web push needs VAPID keys + the `web-push` package; wired in the next phase. Record only.
  throw new Error(`channel ${sub.channel} not configured`);
}
