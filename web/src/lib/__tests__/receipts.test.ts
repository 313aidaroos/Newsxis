import { test } from "node:test";
import assert from "node:assert/strict";
import { localReceipts, mergeBillingHistory, payMethodFromNote, receiptNote } from "../receipts";
import type { BillingPayment } from "../billing";

test("a stored purchase becomes a receipt and is not dropped when the Wallet history is missing", () => {
  const local = localReceipts([{
    id: "11111111-1111-1111-1111-111111111111",
    ixis: 5000,
    usd: 50,
    wallet_receipt_id: "rcpt_sponsor",
    product_key: "newsxis.sponsor.briefing",
    note: receiptNote("ixis", "Sponsor line: Harbor Books"),
    created_at: "2026-12-02T02:00:00.000Z",
  }]);
  assert.equal(local.length, 1);
  assert.equal(local[0].description, "This briefing is brought to you by… (1 day, 1 region)");
  assert.equal(local[0].method, "ixis");
  assert.equal(local[0].amountUsdCents, 5000);
  assert.equal(local[0].receiptUrl, "/billing/receipt/11111111-1111-1111-1111-111111111111");
  assert.equal(payMethodFromNote("Paid with card."), "card");
  const merged = mergeBillingHistory([], local);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].ixisAmount, 5000);
});

test("wallet rows are kept and a duplicate local receipt is not shown twice", () => {
  const wallet: BillingPayment[] = [{
    id: "rcpt_1",
    occurredAt: "2026-12-01T00:00:00.000Z",
    description: "Reporter seat",
    method: "card",
    amountUsdCents: 1000,
    ixisAmount: 1000,
    lookupKey: "newsxis_reporter_monthly",
    receiptUrl: "https://apixis-wallet.vercel.app/receipts/rcpt_1",
  }];
  const local = localReceipts([{
    id: "22222222-2222-2222-2222-222222222222",
    ixis: 1000,
    usd: "10.00",
    wallet_receipt_id: "rcpt_1",
    product_key: "newsxis.reporter.monthly",
    note: "Paid with card.",
    created_at: "2026-12-01T00:00:00.000Z",
  }]);
  const merged = mergeBillingHistory(wallet, local);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "rcpt_1");
});

test("unknown product keys are not turned into receipts", () => {
  assert.deepEqual(localReceipts([{
    id: "x", ixis: 1, usd: 1, wallet_receipt_id: null, product_key: "made.up", note: null, created_at: "2026-12-01T00:00:00.000Z",
  }]), []);
});
