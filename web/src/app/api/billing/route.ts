/**
 * Billing history for the signed-in person, read from the Wallet.
 * Missing Wallet routes come back as gaps with an empty list. No sample rows.
 */
import { cookies } from "next/headers";
import { fail, json } from "@/lib/api";
import { apixisOwner } from "@/lib/apixis-login";
import { entitlements, walletBalance, WalletError } from "@/lib/apixis-wallet";
import { billingPayments, billingSubscription, WALLET_BILLING_GAPS, type BillingGapCode } from "@/lib/billing";
import { matchPendingPayment, parsePendingPurchase, PENDING_PURCHASE_COOKIE } from "@/lib/pending-purchase";
import { NEWSXIS_BILLING_PRODUCT, NEWSXIS_PRODUCTS } from "@/lib/products";
import { localReceipts, mergeBillingHistory, receiptNote, saveRevenueEvent, type RevenueRow } from "@/lib/receipts";
import { sponsorNote } from "@/lib/sponsor";
import { currentProfile, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, profile } = await currentProfile();
  if (!user?.email || !profile) return fail("sign_in_required", 401);
  const owner = (await apixisOwner(user.email)) ?? user.email;

  const [payments, subscription] = await Promise.all([
    billingPayments(owner),
    billingSubscription(owner),
  ]);

  let renewsAt: string | null = null;
  let entitlementError: string | null = null;
  try {
    const list = await entitlements(owner, NEWSXIS_BILLING_PRODUCT);
    const seat = list.find((e) => e.product_key.includes("reporter") && e.status === "active");
    renewsAt = seat?.renews_at ?? null;
    if (seat?.renews_at && Date.parse(seat.renews_at) > Date.now() && serviceConfigured()) {
      const patch: { reporter_active_until: string; activated_at?: string } = { reporter_active_until: seat.renews_at };
      if (!profile.activated_at) patch.activated_at = new Date().toISOString();
      await supabaseAdmin().from("profiles").update(patch).eq("id", user.id);
    }
  } catch (error) {
    entitlementError = error instanceof WalletError ? error.message : "entitlements_unavailable";
  }

  let ixisActivity: { id: string; description: string; amount: number; createdAt: string; method: "ixis" }[] = [];
  let ixisError: string | null = null;
  try {
    const balance = await walletBalance(owner, { history: 20 });
    ixisActivity = (balance.history ?? [])
      .filter((row) => row.app === "newsxis" || (row.productKey ?? "").startsWith("newsxis"))
      .map((row) => ({ id: row.id, description: row.description, amount: row.amount, createdAt: row.createdAt, method: "ixis" as const }));
  } catch (error) {
    ixisError = error instanceof WalletError ? error.message : "balance_unavailable";
  }

  let recorded: ReturnType<typeof localReceipts> = [];
  const jar = await cookies();
  if (serviceConfigured()) {
    const db = supabaseAdmin();
    const { data } = await db.from("revenue_events").select("id, ixis, usd, wallet_receipt_id, product_key, note, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    const rows = (data ?? []) as RevenueRow[];
    const pending = parsePendingPurchase(jar.get(PENDING_PURCHASE_COOKIE)?.value);
    if (pending && payments.ok) {
      const used = new Set(rows.map((row) => row.wallet_receipt_id).filter((id): id is string => Boolean(id)));
      const match = matchPendingPayment(pending, payments.data, used);
      if (match) {
        if (pending.kind === "sponsor") {
          const item = NEWSXIS_PRODUCTS["newsxis.sponsor.briefing"];
          await saveRevenueEvent(db, {
            kind: "sponsor", user_id: user.id, ixis: item.ixis, usd: item.usd, method: "card",
            wallet_receipt_id: match.id, product_key: "newsxis.sponsor.briefing",
            note: sponsorNote("card", pending.name, pending.scope),
          });
        } else {
          const item = NEWSXIS_PRODUCTS["newsxis.boost.story"];
          await saveRevenueEvent(db, {
            kind: "boost", user_id: user.id, ixis: item.ixis, usd: item.usd, method: "card",
            wallet_receipt_id: match.id, product_key: "newsxis.boost.story",
            note: receiptNote("card", `Story: ${pending.storyId}`),
          });
          await db.from("stories").update({ pinned_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }).eq("id", pending.storyId).eq("status", "live");
        }
        jar.delete(PENDING_PURCHASE_COOKIE);
        const again = await db.from("revenue_events").select("id, ixis, usd, wallet_receipt_id, product_key, note, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
        recorded = localReceipts((again.data ?? []) as RevenueRow[]);
      } else recorded = localReceipts(rows);
    } else {
      if (!pending && jar.get(PENDING_PURCHASE_COOKIE)?.value) jar.delete(PENDING_PURCHASE_COOKIE);
      recorded = localReceipts(rows);
    }
  }

  const gaps: { path: string; gap: BillingGapCode; todo: string; message: string }[] = [];
  if (!payments.ok) gaps.push({ path: "GET /api/v1/billing/payments", gap: payments.gap, todo: payments.todo, message: payments.message });
  if (!subscription.ok) gaps.push({ path: "GET /api/v1/billing/subscriptions", gap: subscription.gap, todo: subscription.todo, message: subscription.message });

  const walletPayments = payments.ok ? payments.data : [];
  return json({
    ok: true,
    product: NEWSXIS_BILLING_PRODUCT,
    accessUntil: profile.reporter_active_until,
    activated: Boolean(profile.activated_at),
    renewsAt: subscription.ok ? subscription.data?.renewsAt ?? renewsAt : renewsAt,
    cancelAtPeriodEnd: subscription.ok ? Boolean(subscription.data?.cancelAtPeriodEnd) : false,
    subscriptionKnown: subscription.ok,
    payments: mergeBillingHistory(walletPayments, recorded),
    paymentsKnown: payments.ok || recorded.length > 0,
    recordedCount: recorded.length,
    ixisActivity,
    ixisError,
    entitlementError,
    gaps,
    planned: WALLET_BILLING_GAPS,
  });
}
