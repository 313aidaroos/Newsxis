/**
 * Support / complaints / corrections / takedowns / ads inquiries. Creates a ticket; Cixy drafts a first
 * reply (support agent) and flags what needs the owner. Everything is organized in /admin/tickets.
 */
import { fail, json } from "@/lib/api";
import { aiConfigured, fastJson } from "@/lib/ai/anthropic";
import { CIXY_NEWS_SYSTEM } from "@/lib/ai/cixy-role";
import { currentUser, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const KINDS = ["support", "complaint", "correction", "takedown", "ads", "partnership", "other"];

export async function POST(request: Request) {
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const b = await request.json().catch(() => ({})) as Record<string, string>;
  const kind = KINDS.includes(b.kind) ? b.kind : "support";
  const subject = (b.subject ?? "").trim().slice(0, 200), body = (b.body ?? "").trim().slice(0, 5000);
  if (!subject || !body) return fail("subject and body required");
  const user = await currentUser();
  const email = user?.email ?? ((b.email ?? "").trim().slice(0, 200) || null);
  const db = supabaseAdmin();
  const hour = Math.floor(Date.now() / 3600e3);
  const ip = (request.headers.get("x-forwarded-for") ?? "anon").split(",")[0];
  const { data: allowed } = await db.rpc("take_request_allowance", { bucket_key: `support:${ip}:${hour}`, max_hits: 5, expiry: new Date((hour + 1) * 3600e3).toISOString() });
  if (allowed === false) return fail("rate_limited", 429);

  let agent_reply: string | null = null, status = "open";
  if (aiConfigured()) {
    try {
      const r = await fastJson<{ reply: string; needs_owner: boolean }>(CIXY_NEWS_SYSTEM, `You are also Newsxis's support agent. A ${kind} ticket arrived${email ? ` from ${email}` : ""}:
Subject: ${subject}
Body: ${body}
Write a short, warm, honest first reply (no promises you cannot keep; corrections and takedowns are reviewed by the owner within 24h; ads and partnerships go to the owner). Return ONLY JSON {"reply": string, "needs_owner": boolean}.`, 600);
      agent_reply = r.reply; status = r.needs_owner || kind === "takedown" || kind === "correction" || kind === "ads" || kind === "partnership" ? "needs_owner" : "agent_replied";
    } catch { status = "open"; }
  }
  const { data, error } = await db.from("tickets").insert({ kind, from_email: email, user_id: user?.id ?? null, subject, body, status, story_id: b.story_id ?? null, agent_reply }).select("id").single();
  if (error) return fail(error.message, 500);
  return json({ ok: true, id: data.id, reply: agent_reply });
}
