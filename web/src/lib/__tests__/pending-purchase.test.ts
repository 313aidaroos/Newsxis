import { test } from "node:test";
import assert from "node:assert/strict";
import type { BillingPayment } from "../billing";
import { matchPendingPayment, parsePendingPurchase } from "../pending-purchase";

const now = Date.parse("2026-10-28T12:00:00.000Z");
const storyId = "11111111-1111-4111-8111-111111111111";

function payment(over: Partial<BillingPayment>): BillingPayment {
  return {
    id: "rcpt_1",
    occurredAt: "2026-10-28T12:01:00.000Z",
    description: "Sponsor",
    method: "card",
    amountUsdCents: 5000,
    ixisAmount: 5000,
    lookupKey: "newsxis_sponsor_briefing_onetime",
    receiptUrl: null,
    ...over,
  };
}

test("a pending card purchase is kept only with a real name, scope, and story id", () => {
  const sponsor = parsePendingPurchase(JSON.stringify({ kind: "sponsor", name: "Harbor Books", scope: "world", at: now - 1000 }), now);
  assert.deepEqual(sponsor, { kind: "sponsor", name: "Harbor Books", scope: "world", at: now - 1000 });
  assert.equal(parsePendingPurchase(JSON.stringify({ kind: "sponsor", name: "  ", scope: "world", at: now }), now), null);
  assert.equal(parsePendingPurchase(JSON.stringify({ kind: "sponsor", name: "Harbor", scope: "nope", at: now }), now), null);
  assert.equal(parsePendingPurchase(JSON.stringify({ kind: "boost", storyId, at: now - 60 * 60 * 1000 - 1 }), now), null);
  assert.equal(parsePendingPurchase(JSON.stringify({ kind: "boost", storyId: "nope", at: now }), now), null);
});

test("the line attaches only to an unused Wallet payment for that product", () => {
  const pending = parsePendingPurchase(JSON.stringify({ kind: "sponsor", name: "Harbor Books", scope: "region:EU", at: now }), now);
  assert.ok(pending);
  const hit = payment({});
  assert.equal(matchPendingPayment(pending!, [hit], new Set(), now + 60_000)?.id, "rcpt_1");
  assert.equal(matchPendingPayment(pending!, [hit], new Set(["rcpt_1"]), now + 60_000), null);
  assert.equal(matchPendingPayment(pending!, [payment({ lookupKey: "newsxis_reporter_monthly" })], new Set(), now + 60_000), null);
  const boost = parsePendingPurchase(JSON.stringify({ kind: "boost", storyId, at: now }), now);
  assert.equal(matchPendingPayment(boost!, [payment({ lookupKey: "newsxis_boost_story_onetime", id: "rcpt_pin" })], new Set(), now + 60_000)?.id, "rcpt_pin");
});
