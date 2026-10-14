/**
 * Newsxis → Apixis Wallet billing.
 *
 * The Wallet is the only checkout and the only app with Stripe keys. This file calls the
 * endpoints in the 2026-10-06 family billing plan. Those routes are not in the copied
 * Wallet SDK (v3.1) yet. A missing route is a gap: empty data, never a made-up payment.
 *
 * TODO(wallet): ship these on Apixis Wallet, then this client starts working with no change
 * here other than deleting the gap notes:
 *   POST /api/v1/checkout          card Checkout (lookup_key, method:"card", product=newsxis)
 *   POST /api/v1/subscribe         Ixis plan (lookup_key, method:"ixis") with monthly renewal
 *   GET  /api/v1/billing/payments  one row per card charge, renewal, refund, and Ixis payment
 *   GET  /api/v1/billing/subscriptions   status, current_period_end, cancel_at_period_end
 *   POST /api/v1/billing/subscriptions/cancel    cancel at end of the paid period
 * Catalog lookup keys to add (aliases of the dotted SKUs): newsxis_reporter_activation,
 * newsxis_reporter_monthly, newsxis_boost_story_onetime, newsxis_sponsor_briefing_onetime.
 * Every charge must be tagged apixis_product=newsxis.
 */
import { isWalletConfigured, WalletError, type Owner } from "@/lib/apixis-wallet";
import { NEWSXIS_BILLING_PRODUCT, NEWSXIS_PRODUCTS, REPORTER_CHECKOUT_KEYS } from "@/lib/products";

const BASE = (process.env.APIXIS_WALLET_API_URL ?? "https://apixis-wallet.vercel.app").replace(/\/$/, "");

export const WALLET_BILLING_GAPS = [
  { method: "POST", path: "/api/v1/checkout", todo: "Card checkout for a plan. Newsxis sends lookup_keys and method:card. The Wallet opens Stripe Checkout. Newsxis never sees a card." },
  { method: "POST", path: "/api/v1/subscribe", todo: "Ixis subscription. Debit Ixis, write a payment row, set the entitlement, renew each month, email a receipt." },
  { method: "GET", path: "/api/v1/billing/payments", todo: "Billing history for this product: date, amount, description, method card or ixis, receipt link." },
  { method: "GET", path: "/api/v1/billing/subscriptions", todo: "Current plan, next renewal date, and whether cancel is already scheduled." },
  { method: "POST", path: "/api/v1/billing/subscriptions/cancel", todo: "Cancel at period end. Access stays until the paid month ends. Same rule for card and Ixis." },
] as const;

export type BillingGapCode = "wallet_not_configured" | "endpoint_missing" | "wallet_error" | "unexpected_shape";

export type BillingResult<T> =
  | { ok: true; data: T }
  | { ok: false; gap: BillingGapCode; todo: string; message: string };

export type PayMethod = "card" | "ixis";

export type BillingPayment = {
  id: string;
  occurredAt: string;
  description: string;
  method: PayMethod;
  amountUsdCents: number | null;
  ixisAmount: number | null;
  lookupKey: string | null;
  receiptUrl: string | null;
};

export type BillingSubscription = {
  lookupKey: string | null;
  status: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ownerFields(owner: Owner): { owner_id: string } | { owner_email: string } {
  const value = owner.trim();
  return UUID.test(value) ? { owner_id: value } : { owner_email: value };
}

function ownerQuery(owner: Owner): string {
  const fields = ownerFields(owner);
  return "owner_id" in fields ? `owner_id=${encodeURIComponent(fields.owner_id)}` : `owner_email=${encodeURIComponent(fields.owner_email)}`;
}

export function classifyBillingStatus(status: number): BillingGapCode | null {
  if (status === 404 || status === 405 || status === 410 || status === 501) return "endpoint_missing";
  if (status >= 200 && status < 300) return null;
  return "wallet_error";
}

function gapFor(path: string, code: BillingGapCode, message: string): BillingResult<never> {
  const bare = path.split("?")[0];
  const known = WALLET_BILLING_GAPS.find((g) => g.path === bare);
  return { ok: false, gap: code, todo: known?.todo ?? `Wallet ${bare} is not available yet.`, message };
}

async function walletCall(method: "GET" | "POST", path: string, body?: unknown): Promise<BillingResult<unknown>> {
  if (!isWalletConfigured()) {
    return gapFor(path, "wallet_not_configured", "The Wallet is not connected on this site yet (WALLET_API_KEY missing).");
  }
  const key = process.env.WALLET_API_KEY ?? process.env.APIXIS_WALLET_API_KEY ?? "";
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    return gapFor(path, "wallet_error", "The Wallet could not be reached. Nothing was charged.");
  }
  const text = await res.text();
  let json: unknown = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 180) }; }
  const code = classifyBillingStatus(res.status);
  if (code) {
    const msg = typeof json === "object" && json !== null && typeof (json as { error?: unknown }).error === "string"
      ? (json as { error: string }).error
      : code === "endpoint_missing"
        ? "This Wallet billing endpoint is not available yet."
        : `Wallet ${res.status}`;
    return gapFor(path, code, msg);
  }
  return { ok: true, data: json };
}

export type CheckoutSuccess = {
  url: string | null;
  receiptId: string | null;
  periodEnd: string | null;
};

export async function startReporterCheckout(opts: {
  owner: Owner;
  method: PayMethod;
  activated: boolean;
  successUrl: string;
  cancelUrl: string;
}): Promise<BillingResult<CheckoutSuccess>> {
  const lookupKeys = opts.activated
    ? [NEWSXIS_PRODUCTS["newsxis.reporter.monthly"].lookupKey]
    : [...REPORTER_CHECKOUT_KEYS];
  const path = opts.method === "card" ? "/api/v1/checkout" : "/api/v1/subscribe";
  const result = await walletCall("POST", path, {
    lookup_key: lookupKeys[lookupKeys.length - 1],
    lookup_keys: lookupKeys,
    method: opts.method,
    product: NEWSXIS_BILLING_PRODUCT,
    apixis_product: NEWSXIS_BILLING_PRODUCT,
    apixis_tier: "reporter",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    ...ownerFields(opts.owner),
  });
  if (!result.ok) return result;
  const parsed = readCheckoutSuccess(result.data, opts.method);
  if (!parsed) {
    return gapFor(path, "unexpected_shape", "The Wallet answered in a shape Newsxis does not understand. You were not marked as paid. Check the Wallet before trying again.");
  }
  return { ok: true, data: parsed };
}

export function readCheckoutSuccess(data: unknown, method: PayMethod): CheckoutSuccess | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const url = checkoutUrl(data);
  const receiptId = stringField(rec, ["receiptId", "receipt_id"]);
  const periodEnd = stringField(rec, ["current_period_end", "currentPeriodEnd", "renews_at", "renewsAt", "period_end", "periodEnd"]);
  if (method === "card") return url ? { url, receiptId, periodEnd } : null;
  const status = stringField(rec, ["status"]);
  const accepted = Boolean(receiptId || periodEnd || url || status === "active" || status === "subscribed");
  return accepted ? { url, receiptId, periodEnd } : null;
}

function checkoutUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { url?: unknown; checkout_url?: unknown; checkoutUrl?: unknown };
  for (const value of [row.url, row.checkout_url, row.checkoutUrl]) {
    if (typeof value === "string" && /^https:\/\//.test(value)) return value;
  }
  return null;
}

export async function billingPayments(owner: Owner): Promise<BillingResult<BillingPayment[]>> {
  const path = "/api/v1/billing/payments";
  const result = await walletCall("GET", `${path}?product=${NEWSXIS_BILLING_PRODUCT}&${ownerQuery(owner)}`);
  if (!result.ok) return result;
  const rows = normalizePayments(result.data);
  if (!rows) return gapFor(path, "unexpected_shape", "The Wallet answered in a shape Newsxis does not understand. No payments are shown.");
  return { ok: true, data: rows };
}

export async function billingSubscription(owner: Owner): Promise<BillingResult<BillingSubscription | null>> {
  const path = "/api/v1/billing/subscriptions";
  const result = await walletCall("GET", `${path}?product=${NEWSXIS_BILLING_PRODUCT}&${ownerQuery(owner)}`);
  if (!result.ok) return result;
  const sub = normalizeSubscription(result.data);
  if (sub === undefined) return gapFor(path, "unexpected_shape", "The Wallet answered in a shape Newsxis does not understand. No renewal date is shown.");
  return { ok: true, data: sub };
}

export async function cancelReporterPlan(owner: Owner): Promise<BillingResult<{ cancelAtPeriodEnd: boolean }>> {
  const path = "/api/v1/billing/subscriptions/cancel";
  const result = await walletCall("POST", path, {
    product: NEWSXIS_BILLING_PRODUCT,
    apixis_product: NEWSXIS_BILLING_PRODUCT,
    lookup_key: NEWSXIS_PRODUCTS["newsxis.reporter.monthly"].lookupKey,
    cancel_at_period_end: true,
    ...ownerFields(owner),
  });
  if (!result.ok) return result;
  return { ok: true, data: { cancelAtPeriodEnd: true } };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function rowList(data: unknown, key: string): unknown[] | null {
  if (Array.isArray(data)) return data;
  const rec = asRecord(data);
  if (!rec) return null;
  if (Array.isArray(rec[key])) return rec[key] as unknown[];
  if (Array.isArray(rec.items)) return rec.items as unknown[];
  return null;
}

/** Returns null when the payload is not a list we can trust. An empty list is a real empty history. */
export function normalizePayments(data: unknown): BillingPayment[] | null {
  const list = rowList(data, "payments");
  if (!list) return null;
  const out: BillingPayment[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) return null;
    const method = row.method === "card" || row.method === "ixis" ? row.method : null;
    const occurredAt = stringField(row, ["occurred_at", "occurredAt", "created_at", "createdAt"]);
    const description = stringField(row, ["description", "name"]);
    if (!method || !occurredAt || !description) return null;
    const cents = numberField(row, ["amount_usd_cents", "amountUsdCents"]);
    const ixis = numberField(row, ["ixis_amount", "ixisAmount", "ixis"]);
    out.push({
      id: stringField(row, ["id", "reference"]) ?? occurredAt,
      occurredAt,
      description,
      method,
      amountUsdCents: cents,
      ixisAmount: ixis,
      lookupKey: stringField(row, ["lookup_key", "lookupKey"]),
      receiptUrl: stringField(row, ["receipt_url", "receiptUrl"]),
    });
  }
  return out;
}

/** undefined = not a shape we know. null = the person has no subscription row. */
export function normalizeSubscription(data: unknown): BillingSubscription | null | undefined {
  const list = rowList(data, "subscriptions");
  if (list) {
    if (list.length === 0) return null;
    const row = asRecord(list[0]);
    return row ? subscriptionFrom(row) : undefined;
  }
  const rec = asRecord(data);
  if (!rec) return undefined;
  const nested = asRecord(rec.subscription);
  if (nested) return subscriptionFrom(nested);
  if ("status" in rec || "renews_at" in rec || "renewsAt" in rec || "current_period_end" in rec || "currentPeriodEnd" in rec) {
    return subscriptionFrom(rec);
  }
  return undefined;
}

function subscriptionFrom(row: Record<string, unknown>): BillingSubscription {
  return {
    lookupKey: stringField(row, ["lookup_key", "lookupKey"]),
    status: stringField(row, ["status"]),
    renewsAt: stringField(row, ["renews_at", "renewsAt", "current_period_end", "currentPeriodEnd"]),
    cancelAtPeriodEnd: row.cancel_at_period_end === true || row.cancelAtPeriodEnd === true,
  };
}

function stringField(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function numberField(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

export function formatMoney(payment: Pick<BillingPayment, "method" | "amountUsdCents" | "ixisAmount">): string {
  if (payment.method === "ixis" && payment.ixisAmount !== null) {
    const usd = payment.amountUsdCents !== null ? ` ($${(payment.amountUsdCents / 100).toFixed(2)})` : "";
    return `${payment.ixisAmount.toLocaleString("en-US")} Ixis${usd}`;
  }
  if (payment.amountUsdCents !== null) return `$${(payment.amountUsdCents / 100).toFixed(2)}`;
  return "Amount unavailable";
}

/** So a caught WalletError from the existing SDK is not turned into a fake success. */
export function walletErrorMessage(error: unknown): string {
  if (error instanceof WalletError) return error.message;
  return "The Wallet could not be reached. Nothing was charged.";
}
