/**
 * Billing history for the signed-in person, read from the Wallet.
 * Missing Wallet routes come back as gaps with an empty list. No sample rows.
 */
import { fail, json } from "@/lib/api";
import { apixisOwner } from "@/lib/apixis-login";
import { entitlements, walletBalance, WalletError } from "@/lib/apixis-wallet";
import { billingPayments, billingSubscription, WALLET_BILLING_GAPS, type BillingGapCode } from "@/lib/billing";
import { NEWSXIS_BILLING_PRODUCT } from "@/lib/products";
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

  const gaps: { path: string; gap: BillingGapCode; todo: string; message: string }[] = [];
  if (!payments.ok) gaps.push({ path: "GET /api/v1/billing/payments", gap: payments.gap, todo: payments.todo, message: payments.message });
  if (!subscription.ok) gaps.push({ path: "GET /api/v1/billing/subscriptions", gap: subscription.gap, todo: subscription.todo, message: subscription.message });

  return json({
    ok: true,
    product: NEWSXIS_BILLING_PRODUCT,
    accessUntil: profile.reporter_active_until,
    activated: Boolean(profile.activated_at),
    renewsAt: subscription.ok ? subscription.data?.renewsAt ?? renewsAt : renewsAt,
    cancelAtPeriodEnd: subscription.ok ? Boolean(subscription.data?.cancelAtPeriodEnd) : false,
    subscriptionKnown: subscription.ok,
    payments: payments.ok ? payments.data : [],
    paymentsKnown: payments.ok,
    ixisActivity,
    ixisError,
    entitlementError,
    gaps,
    planned: WALLET_BILLING_GAPS,
  });
}
