/**
 * Reporter activation + monthly seat, paid in Ixis through the Apixis Wallet (family rule: reserve →
 * provision → capture; never our own Stripe). SKUs: newsxis.activate (one-time), newsxis.reporter.monthly (30 days).
 */
import { fail, json, siteUrl } from "@/lib/api";
import { buyIxisUrl, isWalletConfigured, redeem, WalletError } from "@/lib/apixis-wallet";
import { apixisOwner } from "@/lib/apixis-login";
import { currentProfile, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import { NEWSXIS_PRODUCTS, type NewsxisProduct } from "@/lib/products";

export const dynamic = "force-dynamic";


export async function POST(request: Request) {
  const { user, profile } = await currentProfile();
  if (!user?.email || !profile) return fail("sign_in_required", 401);
  if (!serviceConfigured()) return fail("db_not_configured", 503);
  const body = await request.json().catch(() => ({})) as { productKey?: string; attemptId?: string; storyId?: string };
  const productKey = body.productKey as NewsxisProduct;
  if (!productKey || !(productKey in NEWSXIS_PRODUCTS)) return fail("unknown_product");
  if (!body.attemptId || body.attemptId.length > 48) return fail("attemptId required");
  if (!isWalletConfigured()) return fail("wallet_not_configured", 503);
  if (productKey === "newsxis.reporter.monthly" && !profile.activated_at) return fail("activate_first", 409);

  const db = supabaseAdmin();
  const idempotencyKey = `newsxis-${productKey.replace(/\./g, "-")}-${user.id.slice(0, 8)}-${body.attemptId}`.slice(0, 80);
  const owner = (await apixisOwner(user.email)) ?? user.email;
  let previous: Record<string, unknown> = {};

  try {
    const result = await redeem({
      owner, productKey, idempotencyKey,
      provision: async () => {
        if (productKey === "newsxis.activate") {
          previous = { activated_at: profile.activated_at };
          await db.from("profiles").update({ activated_at: new Date().toISOString() }).eq("id", user.id);
        } else if (productKey === "newsxis.reporter.monthly") {
          previous = { reporter_active_until: profile.reporter_active_until };
          const base = profile.reporter_active_until && Date.parse(profile.reporter_active_until) > Date.now() ? Date.parse(profile.reporter_active_until) : Date.now();
          await db.from("profiles").update({ reporter_active_until: new Date(base + 30 * 86400e3).toISOString() }).eq("id", user.id);
        } else if (productKey === "newsxis.boost.story" && body.storyId) {
          await db.from("stories").update({ pinned_until: new Date(Date.now() + 86400e3).toISOString() }).eq("id", body.storyId);
        }
        return true;
      },
      unprovision: async () => {
        if (productKey === "newsxis.boost.story" && body.storyId) await db.from("stories").update({ pinned_until: null }).eq("id", body.storyId);
        else await db.from("profiles").update(previous).eq("id", user.id);
      },
    });
    if (!result.ok) return json({ ok: false, error: "insufficient_ixis", needed: result.needed, buy: buyIxisUrl("newsxis", `${siteUrl(request)}/post`) }, 402);
    const p = NEWSXIS_PRODUCTS[productKey];
    await db.from("revenue_events").insert({ kind: productKey === "newsxis.activate" ? "activation" : productKey === "newsxis.reporter.monthly" ? "seat" : "boost", user_id: user.id, ixis: p.ixis, usd: p.ixis / 100, wallet_receipt_id: result.receiptId, product_key: productKey });
    return json({ ok: true, productKey, receiptId: result.receiptId });
  } catch (e) {
    if (e instanceof WalletError) return fail(e.message, e.status === 402 ? 402 : 502, { buy: buyIxisUrl("newsxis", `${siteUrl(request)}/post`) });
    return fail((e as Error).message, 500);
  }
}
