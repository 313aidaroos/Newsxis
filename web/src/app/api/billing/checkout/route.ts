/**
 * Card checkout through the Apixis Wallet. Newsxis holds no Stripe key.
 * A sponsor line and a story pin are stored when the Wallet returns a receipt,
 * or later when billing sees a real payment for that lookup key.
 * If the Wallet route is not shipped yet, this returns a gap and does not mark anyone paid.
 */
import { cookies } from "next/headers";
import { fail, json, siteUrl } from "@/lib/api";
import { apixisOwner } from "@/lib/apixis-login";
import { startBoostCheckout, startReporterCheckout, startSponsorCheckout, type PayMethod } from "@/lib/billing";
import { PENDING_PURCHASE_COOKIE, type PendingPurchase } from "@/lib/pending-purchase";
import { NEWSXIS_PRODUCTS } from "@/lib/products";
import { receiptNote, saveRevenueEvent } from "@/lib/receipts";
import { ageAllowsUse } from "@/lib/safety";
import { cleanSponsorName, sponsorNote, sponsorScopeKey } from "@/lib/sponsor";
import { currentProfile, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PIN_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const { user, profile } = await currentProfile();
  if (!user?.email || !profile) return fail("sign_in_required", 401);
  if (profile.banned || profile.age_blocked) return fail("not_allowed", 403);
  if (!ageAllowsUse(profile)) return fail("age_required", 403);
  const body = await request.json().catch(() => ({})) as { method?: string; product?: string; sponsorName?: string; sponsorScope?: string; storyId?: string };
  const method: PayMethod | null = body.method === "card" || body.method === "ixis" ? body.method : null;
  if (!method) return fail("method_required");
  const sponsor = body.product === "newsxis.sponsor.briefing";
  const boost = body.product === "newsxis.boost.story";
  if (sponsor && method !== "card") return fail("sponsor_ixis_uses_redeem");
  if (boost && method !== "card") return fail("boost_ixis_uses_redeem");

  let sponsorName = "";
  let sponsorScope = "";
  if (sponsor) {
    sponsorName = cleanSponsorName(body.sponsorName);
    sponsorScope = sponsorScopeKey(body.sponsorScope) ?? "";
    if (!sponsorName) return fail("sponsor_name_required");
    if (!sponsorScope) return fail("sponsor_scope_required");
  }

  let storyId = "";
  let storySlug = "";
  if (boost) {
    storyId = typeof body.storyId === "string" ? body.storyId : "";
    if (!UUID.test(storyId)) return fail("story_required");
    if (!serviceConfigured()) return fail("db_not_configured", 503);
    const { data: story } = await supabaseAdmin().from("stories").select("id, slug").eq("id", storyId).eq("status", "live").maybeSingle();
    if (!story?.slug) return fail("story_not_found", 404);
    storySlug = story.slug;
  }

  const owner = (await apixisOwner(user.email)) ?? user.email;
  const origin = siteUrl(request);
  const result = sponsor
    ? await startSponsorCheckout({ owner, successUrl: `${origin}/billing?checkout=return`, cancelUrl: `${origin}/billing?checkout=cancel` })
    : boost
      ? await startBoostCheckout({ owner, successUrl: `${origin}/billing?checkout=return`, cancelUrl: `${origin}/story/${storySlug}?checkout=cancel` })
      : await startReporterCheckout({
        owner,
        method,
        activated: Boolean(profile.activated_at),
        successUrl: `${origin}/billing?checkout=return`,
        cancelUrl: `${origin}/post?checkout=cancel`,
      });
  if (!result.ok) return json({ ok: false, gap: result.gap, todo: result.todo, message: result.message }, result.gap === "endpoint_missing" ? 501 : 503);

  if (!sponsor && !boost && result.data.periodEnd && serviceConfigured()) {
    const patch: { reporter_active_until: string; activated_at?: string } = { reporter_active_until: result.data.periodEnd };
    if (!profile.activated_at) patch.activated_at = new Date().toISOString();
    await supabaseAdmin().from("profiles").update(patch).eq("id", user.id);
  }

  const jar = await cookies();
  if (result.data.receiptId && serviceConfigured()) {
    const db = supabaseAdmin();
    if (sponsor) {
      const item = NEWSXIS_PRODUCTS["newsxis.sponsor.briefing"];
      await saveRevenueEvent(db, {
        kind: "sponsor", user_id: user.id, ixis: item.ixis, usd: item.usd, method: "card",
        wallet_receipt_id: result.data.receiptId, product_key: "newsxis.sponsor.briefing",
        note: sponsorNote("card", sponsorName, sponsorScope),
      });
    } else if (boost) {
      const item = NEWSXIS_PRODUCTS["newsxis.boost.story"];
      await saveRevenueEvent(db, {
        kind: "boost", user_id: user.id, ixis: item.ixis, usd: item.usd, method: "card",
        wallet_receipt_id: result.data.receiptId, product_key: "newsxis.boost.story",
        note: receiptNote("card", `Story: ${storyId}`),
      });
      await db.from("stories").update({ pinned_until: new Date(Date.now() + PIN_MS).toISOString() }).eq("id", storyId).eq("status", "live");
    } else {
      const activate = NEWSXIS_PRODUCTS["newsxis.activate"];
      const monthly = NEWSXIS_PRODUCTS["newsxis.reporter.monthly"];
      const bundled = !profile.activated_at;
      await saveRevenueEvent(db, {
        kind: bundled ? "activation" : "seat",
        user_id: user.id,
        ixis: bundled ? activate.ixis + monthly.ixis : monthly.ixis,
        usd: bundled ? activate.usd + monthly.usd : monthly.usd,
        method,
        wallet_receipt_id: result.data.receiptId,
        product_key: bundled ? "newsxis.activate" : "newsxis.reporter.monthly",
        note: receiptNote(method, bundled ? "Includes activation." : undefined),
      });
    }
    jar.delete(PENDING_PURCHASE_COOKIE);
  } else if ((sponsor || boost) && result.data.url) {
    const pending: PendingPurchase = sponsor
      ? { kind: "sponsor", name: sponsorName, scope: sponsorScope, at: Date.now() }
      : { kind: "boost", storyId, at: Date.now() };
    jar.set(PENDING_PURCHASE_COOKIE, JSON.stringify(pending), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return json({ ok: true, url: result.data.url, receiptId: result.data.receiptId, periodEnd: result.data.periodEnd });
}
