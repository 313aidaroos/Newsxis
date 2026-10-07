import { test } from "node:test";
import assert from "node:assert/strict";
import { NEWSXIS_PRODUCTS } from "../products";
import { MASTER_ADMIN_EMAILS, SUPPORT_EMAIL, isOwnerEmail, ownerEmails } from "../owners";
import { ageDecision, insertedStatus, mediaPresentation, showGraphicMedia, statusAfterModeration } from "../safety";
import { profilePatch } from "../profile-patch";
import { classifyBillingStatus, formatMoney, normalizePayments, normalizeSubscription, readCheckoutSuccess } from "../billing";

test("sponsor briefing is in the catalog at 5,000 Ixis", () => {
  const item = NEWSXIS_PRODUCTS["newsxis.sponsor.briefing"];
  assert.equal(item.ixis, 5000);
  assert.equal(item.usd, 50);
  assert.equal(item.lookupKey, "newsxis_sponsor_briefing_onetime");
  assert.equal(NEWSXIS_PRODUCTS["newsxis.activate"].usd, 10);
  assert.equal(NEWSXIS_PRODUCTS["newsxis.reporter.monthly"].ixis, 1000);
});

test("master admins are the two owner emails and not the support mailbox", () => {
  const prev = process.env.OWNER_EMAILS;
  try {
    delete process.env.OWNER_EMAILS;
    assert.deepEqual([...ownerEmails()].sort(), [...MASTER_ADMIN_EMAILS].sort());
    process.env.OWNER_EMAILS = "newsxis@apixis.dev, awad@apixis.dev";
    assert.deepEqual(ownerEmails(), ["awad@apixis.dev"]);
    assert.equal(isOwnerEmail(SUPPORT_EMAIL), false);
    assert.equal(isOwnerEmail("awad@apixis.dev"), true);
    assert.equal(isOwnerEmail("alaidaroosawad@gmail.com"), false);
  } finally {
    if (prev === undefined) delete process.env.OWNER_EMAILS;
    else process.env.OWNER_EMAILS = prev;
  }
});

test("graphic media is hidden until an explicit opt-in, then blurred", () => {
  assert.equal(showGraphicMedia(undefined), false);
  assert.equal(showGraphicMedia(false), false);
  assert.equal(showGraphicMedia(true), true);
  assert.equal(mediaPresentation(false, false), "show");
  assert.equal(mediaPresentation(true, false), "hide");
  assert.equal(mediaPresentation(true, true), "blur");
});

test("age answers are enforced", () => {
  assert.equal(ageDecision("yes", false), "confirm");
  assert.equal(ageDecision("no", false), "block");
  assert.equal(ageDecision("maybe", false), "reject");
  assert.equal(ageDecision("yes", true), "reject");
});

test("posts and comments insert as pending and publish only after a live decision", () => {
  assert.equal(insertedStatus(), "pending");
  assert.equal(statusAfterModeration(null, false), "held");
  assert.equal(statusAfterModeration(null, true), "held");
  assert.equal(statusAfterModeration("live", false), "held");
  assert.equal(statusAfterModeration("live", true), "live");
  assert.equal(statusAfterModeration("removed", true), "removed");
});

test("profile patches cannot change privileged columns", () => {
  const { patch, error } = profilePatch({
    display_name: "Amina",
    is_owner: true,
    activated_at: "2026-10-07",
    banned: false,
    verified_reporter: true,
    reporter_active_until: "2099-01-01",
    apixis_sub: "someone-else",
    age_confirmed_at: "2026-10-07",
    show_graphic_media: true,
    username: "Ab",
  });
  assert.equal(error, "username_too_short");
  assert.equal(patch.display_name, "Amina");
  assert.equal(patch.show_graphic_media, true);
  assert.equal("is_owner" in patch, false);
  assert.equal("activated_at" in patch, false);
  assert.equal("banned" in patch, false);
  assert.equal("apixis_sub" in patch, false);
  assert.equal("age_confirmed_at" in patch, false);
});

test("billing responses that are not real payments stay empty", () => {
  assert.equal(classifyBillingStatus(404), "endpoint_missing");
  assert.equal(classifyBillingStatus(501), "endpoint_missing");
  assert.equal(classifyBillingStatus(200), null);
  assert.equal(normalizePayments({ ok: true }), null);
  assert.deepEqual(normalizePayments({ payments: [] }), []);
  const rows = normalizePayments({
    payments: [{ id: "pay_1", occurred_at: "2026-10-07T00:00:00Z", description: "Reporter seat", method: "card", amount_usd_cents: 1000 }],
  });
  assert.equal(rows?.length, 1);
  assert.equal(rows?.[0].method, "card");
  assert.equal(formatMoney(rows![0]), "$10.00");
  assert.equal(normalizeSubscription({ subscriptions: [] }), null);
  assert.equal(normalizeSubscription({ ok: true }), undefined);
  assert.equal(readCheckoutSuccess({ ok: true }, "card"), null);
  assert.equal(readCheckoutSuccess({ url: "https://apixis-wallet.vercel.app/checkout/cs_test" }, "card")?.url, "https://apixis-wallet.vercel.app/checkout/cs_test");
  assert.equal(readCheckoutSuccess({ ok: true }, "ixis"), null);
  assert.equal(readCheckoutSuccess({ status: "active", renews_at: "2026-11-07T00:00:00Z" }, "ixis")?.periodEnd, "2026-11-07T00:00:00Z");
});
