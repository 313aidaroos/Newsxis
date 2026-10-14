import { test } from "node:test";
import assert from "node:assert/strict";
import { feedReasonFetches, isIdleSpinMove, type FeedReason, type HomeMode } from "../home-feed";

const reasons: FeedReason[] = ["filter", "mode", "pan", "spin", "refresh"];
const modes: HomeMode[] = ["world", "view"];

test("idle spin never fetches, in either mode", () => {
  assert.equal(isIdleSpinMove({ newsxisIdleSpin: true }), true);
  assert.equal(isIdleSpinMove({}), false);
  assert.equal(isIdleSpinMove(undefined), false);
  for (const mode of modes) assert.equal(feedReasonFetches("spin", mode), false);
});

test("a pan refetches only in this view", () => {
  assert.equal(feedReasonFetches("pan", "world"), false);
  assert.equal(feedReasonFetches("pan", "view"), true);
});

test("filters, mode switches, and the timer always refetch", () => {
  for (const mode of modes) {
    assert.equal(feedReasonFetches("filter", mode), true);
    assert.equal(feedReasonFetches("mode", mode), true);
    assert.equal(feedReasonFetches("refresh", mode), true);
  }
  assert.equal(reasons.length, 5);
});
