/**
 * Reporter seat checkout. Card or Ixis, the customer's choice, through the Apixis Wallet.
 * Newsxis holds no Stripe key. If the Wallet route is not shipped yet, this returns a gap
 * and does not mark the person as paid.
 */
import { fail, json, siteUrl } from "@/lib/api";
import { apixisOwner } from "@/lib/apixis-login";
import { startReporterCheckout, startSponsorCheckout, type PayMethod } from "@/lib/billing";
import { NEWSXIS_PRODUCTS } from "@/lib/products";
import { receiptNote } from "@/lib/receipts";
import { ageAllowsUse } from "@/lib/safety";
import { currentProfile, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, profile } = await currentProfile();
  if (!user?.email || !profile) return fail("sign_in_required", 401);
  if (profile.banned || profile.age_blocked) return fail("not_allowed", 403);
  if (!ageAllowsUse(profile)) return fail("age_required", 403);
  const body = await request.json().catch(() => ({})) as { method?: string; product?: string };
  const method: PayMethod | null = body.method === "card" || body.method === "ixis" ? body.method : null;
  if (!method) return fail("method_required");
  const sponsor = body.product === "newsxis.sponsor.briefing";
  if (sponsor && method !== "card") return fail("sponsor_ixis_uses_redeem");
  const owner = (await apixisOwner(user.email)) ?? user.email;
  const origin = siteUrl(request);
  const result = sponsor
    ? await startSponsorCheckout({ owner, successUrl: `${origin}/billing?checkout=return`, cancelUrl: `${origin}/billing?checkout=cancel` })
    : await startReporterCheckout({
      owner,
      method,
      activated: Boolean(profile.activated_at),
      successUrl: `${origin}/billing?checkout=return`,
      cancelUrl: `${origin}/post?checkout=cancel`,
    });
  if (!result.ok) return json({ ok: false, gap: result.gap, todo: result.todo, message: result.message }, result.gap === "endpoint_missing" ? 501 : 503);

  if (!sponsor && result.data.periodEnd && serviceConfigured()) {
    const patch: { reporter_active_until: string; activated_at?: string } = { reporter_active_until: result.data.periodEnd };
    if (!profile.activated_at) patch.activated_at = new Date().toISOString();
    await supabaseAdmin().from("profiles").update(patch).eq("id", user.id);
  }
  if (result.data.receiptId && serviceConfigured()) {
    const db = supabaseAdmin();
    if (sponsor) {
      const item = NEWSXIS_PRODUCTS["newsxis.sponsor.briefing"];
      await db.from("revenue_events").insert({
        kind: "sponsor", user_id: user.id, ixis: item.ixis, usd: item.usd,
        wallet_receipt_id: result.data.receiptId, product_key: "newsxis.sponsor.briefing",
        note: receiptNote("card"),
      });
    } else {
      const activate = NEWSXIS_PRODUCTS["newsxis.activate"];
      const monthly = NEWSXIS_PRODUCTS["newsxis.reporter.monthly"];
      const bundled = !profile.activated_at;
      await db.from("revenue_events").insert({
        kind: bundled ? "activation" : "seat",
        user_id: user.id,
        ixis: bundled ? activate.ixis + monthly.ixis : monthly.ixis,
        usd: bundled ? activate.usd + monthly.usd : monthly.usd,
        wallet_receipt_id: result.data.receiptId,
        product_key: bundled ? "newsxis.activate" : "newsxis.reporter.monthly",
        note: receiptNote(method, bundled ? "Includes activation." : undefined),
      });
    }
  }
  return json({ ok: true, url: result.data.url, receiptId: result.data.receiptId, periodEnd: result.data.periodEnd });
}
