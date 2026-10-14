/**
 * Receipts Newsxis recorded after a Wallet call succeeded.
 * Rows come from revenue_events. Missing Wallet history is not filled with samples.
 */
import type { BillingPayment, PayMethod } from "@/lib/billing";
import { NEWSXIS_PRODUCTS, type NewsxisProduct } from "@/lib/products";

export type RevenueRow = {
  id: string;
  ixis: number | null;
  usd: number | string | null;
  wallet_receipt_id: string | null;
  product_key: string | null;
  note: string | null;
  created_at: string;
};

export type LocalReceipt = BillingPayment & { walletReceiptId: string | null };

export function payMethodFromNote(note: string | null | undefined): PayMethod {
  return (note ?? "").toLowerCase().includes("card") ? "card" : "ixis";
}

export function receiptNote(method: PayMethod, extra?: string): string {
  const head = method === "card" ? "Paid with card." : "Paid with Ixis.";
  const rest = extra?.replace(/\s+/g, " ").trim().slice(0, 160);
  return rest ? `${head} ${rest}` : head;
}

export function localReceipts(rows: RevenueRow[]): LocalReceipt[] {
  const out: LocalReceipt[] = [];
  for (const row of rows) {
    const key = row.product_key;
    if (!key || !(key in NEWSXIS_PRODUCTS) || !row.created_at) continue;
    const product = NEWSXIS_PRODUCTS[key as NewsxisProduct];
    const usd = typeof row.usd === "string" ? Number(row.usd) : row.usd;
    const bundled = (row.note ?? "").includes("Includes activation");
    out.push({
      id: row.id,
      occurredAt: row.created_at,
      description: bundled ? "Reporter activation and monthly seat" : product.name,
      method: payMethodFromNote(row.note),
      amountUsdCents: typeof usd === "number" && Number.isFinite(usd) ? Math.round(usd * 100) : product.usd * 100,
      ixisAmount: typeof row.ixis === "number" ? row.ixis : product.ixis,
      lookupKey: product.lookupKey,
      receiptUrl: `/billing/receipt/${row.id}`,
      walletReceiptId: row.wallet_receipt_id,
    });
  }
  return out;
}

/** Wallet rows win when they share an id with a receipt Newsxis stored. */
export function mergeBillingHistory(wallet: BillingPayment[], local: LocalReceipt[]): BillingPayment[] {
  const seen = new Set<string>();
  for (const row of wallet) {
    seen.add(row.id);
    if (row.receiptUrl) seen.add(row.receiptUrl);
  }
  const extra = local.filter((row) => !seen.has(row.id) && !(row.walletReceiptId && seen.has(row.walletReceiptId)));
  return [...wallet, ...extra].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
