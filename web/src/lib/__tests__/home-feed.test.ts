import { test } from "node:test";
import assert from "node:assert/strict";
import { cixyReadout, feedIsLive, feedReasonFetches, focusForStory, isIdleSpinMove, LIVE_WINDOW_MS, type FeedReason, type HomeMode } from "../home-feed";

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

test("the Live badge needs a story inside the live window", () => {
  const now = Date.parse("2026-10-17T18:00:00.000Z");
  assert.equal(feedIsLive(["2026-10-17T17:00:00.000Z"], now), true);
  assert.equal(feedIsLive(["2026-10-17T10:00:00.000Z"], now), false);
  assert.equal(feedIsLive([null, undefined], now), false);
  assert.equal(LIVE_WINDOW_MS, 3 * 60 * 60 * 1000);
});

test("globe focus uses a story that has coordinates", () => {
  assert.deepEqual(focusForStory({ lat: 40.7, lng: -74 }), { lat: 40.7, lng: -74, zoom: 6 });
  assert.equal(focusForStory({ lat: null, lng: -74 }), null);
  assert.equal(focusForStory({ lat: Number.NaN, lng: 1 }), null);
});

test("Cixy falls back to stories already on the map", () => {
  assert.match(cixyReadout([], "offline"), /brain is connected/);
  assert.match(cixyReadout([], "empty"), /Nothing is on the map/);
  const text = cixyReadout([{ headline: "Ferry resumes", place: "New York" }], "offline");
  assert.match(text, /Ferry resumes \(New York\)/);
  assert.match(text, /brain is connected/);
});
