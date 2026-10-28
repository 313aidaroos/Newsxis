/**
 * Card checkout often returns a Wallet URL before a receipt exists.
 * The sponsor line and the story id wait in an httpOnly cookie until a real
 * Wallet payment with the matching lookup key shows up. No payment, no row.
 */
import type { BillingPayment } from "@/lib/billing";
import { NEWSXIS_PRODUCTS } from "@/lib/products";
import { sponsorScopeKey, cleanSponsorName } from "@/lib/sponsor";

export const PENDING_PURCHASE_COOKIE = "nx_pending_purchase";
export const PENDING_PURCHASE_MS = 60 * 60 * 1000;
const SKEW_MS = 5 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PendingPurchase =
  | { kind: "sponsor"; name: string; scope: string; at: number }
  | { kind: "boost"; storyId: string; at: number };

export function parsePendingPurchase(raw: string | undefined | null, now = Date.now()): PendingPurchase | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const row = value as { kind?: unknown; name?: unknown; scope?: unknown; storyId?: unknown; at?: unknown };
  const at = typeof row.at === "number" ? row.at : Number.NaN;
  if (!Number.isFinite(at) || now - at > PENDING_PURCHASE_MS || at > now + SKEW_MS) return null;
  if (row.kind === "sponsor") {
    const name = cleanSponsorName(row.name);
    const scope = sponsorScopeKey(row.scope);
    if (!name || !scope) return null;
    return { kind: "sponsor", name, scope, at };
  }
  if (row.kind === "boost" && typeof row.storyId === "string" && UUID.test(row.storyId)) {
    return { kind: "boost", storyId: row.storyId, at };
  }
  return null;
}

export function matchPendingPayment(
  pending: PendingPurchase,
  payments: BillingPayment[],
  usedReceiptIds: Set<string>,
  now = Date.now(),
): BillingPayment | null {
  const key = pending.kind === "sponsor"
    ? NEWSXIS_PRODUCTS["newsxis.sponsor.briefing"].lookupKey
    : NEWSXIS_PRODUCTS["newsxis.boost.story"].lookupKey;
  const windowStart = pending.at - SKEW_MS;
  const hits = payments.filter((payment) => {
    if (payment.lookupKey !== key) return false;
    if (usedReceiptIds.has(payment.id)) return false;
    const at = Date.parse(payment.occurredAt);
    return Number.isFinite(at) && at >= windowStart && at <= now + SKEW_MS;
  });
  hits.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return hits[0] ?? null;
}
