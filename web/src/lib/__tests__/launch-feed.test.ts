import { test } from "node:test";
import assert from "node:assert/strict";
import { socialText } from "../ai/social-text";
import { centralDateKey, dailyReportDraft, isEightPmCentral } from "../daily-report";
import { profilePatch } from "../profile-patch";
import { socialSkipReason, type SocialEnv } from "../social/gate";
import { socixisFeedEnabled } from "../socixis";
import type { Story } from "../types";

const emptyEnv: SocialEnv = {};

test("socixis stays off until a feed key or an explicit on flag", () => {
  assert.equal(socixisFeedEnabled({}), false);
  assert.equal(socixisFeedEnabled({ APIXIS_WORLD_KEY: "present" }), true);
  assert.equal(socixisFeedEnabled({ APIXIS_WORLD_KEY: "present", SOCIXIS_FEED: "off" }), false);
  assert.equal(socixisFeedEnabled({ SOCIXIS_FEED: "on" }), true);
});

test("8 PM Central is the only hour the daily report runs", () => {
  assert.equal(isEightPmCentral(new Date("2026-07-15T01:00:00.000Z")), true);
  assert.equal(centralDateKey(new Date("2026-07-15T01:00:00.000Z")), "2026-07-14");
  assert.equal(isEightPmCentral(new Date("2026-01-15T02:00:00.000Z")), true);
  assert.equal(isEightPmCentral(new Date("2026-07-15T02:00:00.000Z")), false);
});

test("a daily report is not invented when the model did not write one", () => {
  assert.equal(dailyReportDraft("2026-12-01", 3, null), null);
  assert.equal(dailyReportDraft("2026-12-01", 3, "   "), null);
  const written = dailyReportDraft("2026-12-01", 2, "Two stories, both sourced.");
  assert.equal(written?.ai_label, "Written by Cixy · AI-generated daily report");
  const empty = dailyReportDraft("2026-12-01", 0, null);
  assert.match(empty?.body ?? "", /No live stories/);
  assert.doesNotMatch(empty?.ai_label ?? "", /Written by Cixy/);
});

test("the daily report opt-in is editable and owner flags are not", () => {
  const { patch } = profilePatch({ daily_report_opt_in: true, is_owner: true });
  assert.equal(patch.daily_report_opt_in, true);
  assert.equal("is_owner" in patch, false);
  assert.equal(profilePatch({ daily_report_opt_in: "yes" }).patch.daily_report_opt_in, false);
});

test("social accounts without keys are skipped", () => {
  assert.equal(socialSkipReason("x", { access_token: "tok" }, emptyEnv), "x_not_configured");
  assert.equal(socialSkipReason("x", {}, { xClientId: "id", xClientSecret: "secret" }), "x_not_connected");
  assert.equal(socialSkipReason("x", { access_token: "tok" }, { xClientId: "id", xClientSecret: "secret" }), null);
  assert.equal(socialSkipReason("facebook", { page_id: "1" }, { metaAppId: "a", metaAppSecret: "b" }), "facebook_not_connected");
  assert.equal(socialSkipReason("bluesky", {}, emptyEnv), "bluesky_not_configured");
  assert.equal(socialSkipReason("bluesky", { handle: "newsxis.bsky.social", app_password: "xxxx" }, emptyEnv), null);
});

test("x text stays inside 280 even when the source line is long", () => {
  const s = {
    slug: "storm",
    headline: "H".repeat(240),
    summary: "S".repeat(400),
    severity: 5,
    confirmed: false,
    disputed: false,
    ai_label: `Written by Cixy from ${"Station".repeat(40)}`,
    place_name: "New York",
    country: "US",
  } as Story;
  const text = socialText(s, "https://newsxis.vercel.app", "x");
  assert.ok(text.length <= 280);
  assert.match(text, /^BREAKING/);
  assert.match(text, /AI-written/);
});
