/**
 * Owner actions from /admin (phone-friendly): pin / edit / hold / remove stories, approve or remove
 * user posts, toggle sources, add social accounts, close tickets. Owner = profiles.is_owner.
 */
import { fail, json } from "@/lib/api";
import { encrypt } from "@/lib/crypto";
import { currentProfile, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { profile } = await currentProfile();
  if (!profile?.is_owner) return fail("owner_only", 403);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const db = supabaseAdmin();
  const b = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(b.action ?? "");
  const id = String(b.id ?? "");
  switch (action) {
    case "story.status": {
      const status = String(b.status);
      if (!["live", "held", "removed"].includes(status)) return fail("bad_status");
      await db.from("stories").update({ status }).eq("id", id);
      return json({ ok: true });
    }
    case "story.pin": { await db.from("stories").update({ pinned_until: b.hours ? new Date(Date.now() + Number(b.hours) * 3600e3).toISOString() : null }).eq("id", id); return json({ ok: true }); }
    case "story.edit": {
      const patch: Record<string, unknown> = {};
      for (const k of ["headline", "summary", "severity", "category", "place_name", "country", "region", "city", "lat", "lng", "graphic"]) if (k in b) patch[k] = b[k];
      await db.from("stories").update(patch).eq("id", id);
      await db.from("story_threads").insert({ story_id: id, kind: "update", body: String(b.note ?? "Edited by the Newsxis editor."), sources: [], ai_label: "Editor" });
      return json({ ok: true });
    }
    case "story.correction": { await db.from("story_threads").insert({ story_id: id, kind: "correction", body: String(b.body ?? ""), sources: [], ai_label: "Editor" }); return json({ ok: true }); }
    case "post.status": { await db.from("posts").update({ status: String(b.status) }).eq("id", id); return json({ ok: true }); }
    case "user.ban": { await db.from("profiles").update({ banned: Boolean(b.banned) }).eq("id", id); return json({ ok: true }); }
    case "user.verify": { await db.from("profiles").update({ verified_reporter: Boolean(b.verified) }).eq("id", id); return json({ ok: true }); }
    case "source.toggle": { await db.from("sources").update({ active: Boolean(b.active) }).eq("id", id); return json({ ok: true }); }
    case "source.add": {
      const { data, error } = await db.from("sources").insert({ kind: b.kind, name: b.name, slug: b.slug ?? null, url: b.url ?? null, stream_url: b.stream_url ?? null, lang: b.lang ?? "en", country: b.country ?? null, region: b.region ?? null, city: b.city ?? null, county: b.county ?? null, lat: b.lat ?? null, lng: b.lng ?? null, poll_seconds: b.poll_seconds ?? 300, meta: b.meta ?? {} }).select("id").single();
      if (error) return fail(error.message, 400);
      return json({ ok: true, id: data.id });
    }
    case "social.add": {
      const creds = b.credentials && typeof b.credentials === "object" ? encrypt(b.credentials) : null;
      const { data, error } = await db.from("social_accounts").insert({ platform: b.platform, handle: b.handle, scope: b.scope ?? "world", scope_key: b.scope_key ?? "world", credentials: creds, min_severity: b.min_severity ?? 3, min_gap_seconds: b.min_gap_seconds ?? 600 }).select("id").single();
      if (error) return fail(error.message, 400);
      return json({ ok: true, id: data.id });
    }
    case "social.toggle": { await db.from("social_accounts").update({ active: Boolean(b.active) }).eq("id", id); return json({ ok: true }); }
    case "ticket.update": { await db.from("tickets").update({ status: b.status ?? "closed", owner_note: b.note ?? null }).eq("id", id); return json({ ok: true }); }
    default: return fail("unknown_action");
  }
}
