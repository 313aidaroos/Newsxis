import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRss, stripHtml } from "../ingest/fetchers";
import { applyBreakingRules, type Classified } from "../ai/classify";
import { inScope, isSameEvent, wantsBreakingBriefing, type TwinText } from "../ingest/pipeline";
import { socialText } from "../ai/social-text";
import { haversineKm, langForPlace, regionOf, scopeKeys } from "../geo";
import { slugify } from "../slug";
import { parseJson } from "../ai/anthropic";
import type { Story } from "../types";

const base = (): Classified => ({ is_news: true, headline: "h", summary: "s", category: "other", severity: 2, lang: "en", country: "US", region: null, city: null, county: null, place_name: null, lat: null, lng: null, quote: null, tags: [], deaths: null, graphic: false, confidence: 0.6 });

test("parseRss reads RSS items with CDATA and dates", () => {
  const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Quake hits <b>city</b>]]></title><link>https://x.test/a</link><description>&lt;p&gt;Desc&lt;/p&gt;</description><pubDate>Mon, 06 Oct 2026 10:00:00 GMT</pubDate><guid>a1</guid></item></channel></rss>`;
  const items = parseRss(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Quake hits city");
  assert.equal(items[0].url, "https://x.test/a");
  assert.equal(items[0].external_id, "a1");
  assert.equal(items[0].published_at, "2026-10-06T10:00:00.000Z");
  assert.equal(stripHtml("<p>a &amp; b</p>"), "a & b");
});

test("owner's breaking rules force severity 5", () => {
  assert.equal(applyBreakingRules({ ...base(), deaths: 12 }).severity, 5);
  assert.equal(applyBreakingRules({ ...base(), category: "assassination" }).severity, 5);
  assert.equal(applyBreakingRules({ ...base(), category: "attack", headline: "Gunman shoots governor" }).severity, 5);
  assert.equal(applyBreakingRules({ ...base(), category: "war", headline: "Army launches offensive" }).severity, 5);
  assert.equal(applyBreakingRules({ ...base(), category: "strike", headline: "Nationwide strike begins" }).severity, 5);
  assert.equal(applyBreakingRules({ ...base(), category: "weather", headline: "Light rain" }).severity, 2);
});

function place(over: Partial<TwinText> = {}): TwinText {
  return { headline: "Senate passes spending bill after a late vote", summary: "Lawmakers approved the federal spending bill after a late vote in the capital", category: "politics", lat: null, lng: null, city: null, region: null, country: "US", ...over };
}

test("a story with no city does not merge into a different city's story", () => {
  const national = place({ headline: "Bridge collapses in the storm after heavy rain", summary: "A bridge collapsed in the storm after heavy rain and high water", category: "disaster" });
  const city = place({ ...national, city: "New York", region: "NY" });
  assert.equal(isSameEvent(national, city), false);
  assert.equal(isSameEvent(city, national), false);
});

test("same country is not enough when the regions differ or the wording is only loosely alike", () => {
  const national = place();
  assert.equal(isSameEvent(national, place({ region: "TX" })), false);
  assert.equal(isSameEvent(place({ region: "TX" }), place({ region: "CA" })), false);
  assert.equal(isSameEvent(national, place({ headline: "Markets close higher", summary: "Stocks rose in afternoon trading", category: "economy" })), false);
});

test("the same national story, the same city, or a nearby point still dedupes", () => {
  const national = place();
  assert.equal(isSameEvent(national, place({ headline: "Senate passes spending bill after a late night vote" })), true);
  const city = place({ city: "New York", region: "NY", lat: 40.71, lng: -74.0 });
  assert.equal(isSameEvent(city, place({ ...city, headline: "Senate passes the spending bill after a late vote" })), true);
  const nearby = place({ ...city, city: "Jersey City", region: "NJ", lat: 40.73, lng: -74.04, country: "US" });
  assert.equal(isSameEvent(city, nearby), true);
});

test("breaking briefings are requested for a new severity-5 story, not a repeat confirmation", () => {
  assert.equal(wantsBreakingBriefing("story", 5, false), true);
  assert.equal(wantsBreakingBriefing("story", 4, false), false);
  assert.equal(wantsBreakingBriefing("confirmation", 5, false), true);
  assert.equal(wantsBreakingBriefing("confirmation", 5, true), false);
});

test("social scope matching", () => {
  const s = { country: "US", region: "NY", city: "New York" } as Story;
  assert.ok(inScope("world", "world", s));
  assert.ok(inScope("country", "us", s));
  assert.ok(inScope("region", "US-NY", s));
  assert.ok(inScope("city", "US-New York", s));
  assert.ok(!inScope("country", "GB", s));
});

test("social text stays inside platform limits", () => {
  const s = { slug: "a", headline: "H".repeat(200), summary: "S".repeat(400), severity: 5, confirmed: false, disputed: false, ai_label: "Written by Cixy from WNYC", place_name: "New York", country: "US" } as Story;
  assert.ok(socialText(s, "https://newsxis.apixis.dev", "x").length <= 280);
  assert.ok(socialText(s, "https://newsxis.apixis.dev", "bluesky").length <= 300);
  assert.match(socialText(s, "https://newsxis.apixis.dev", "x"), /^BREAKING/);
});

test("geo helpers", () => {
  assert.ok(Math.abs(haversineKm(40.7128, -74.006, 34.0522, -118.2437) - 3936) < 30);
  assert.equal(regionOf("EG"), "ME");
  assert.equal(langForPlace("MX"), "es");
  assert.deepEqual(scopeKeys({ country: "us", region: "NY", city: "New York" }), ["world", "US", "US-NY", "US-New York", "region:NA"]);
  assert.equal(slugify("Héllo, World!! 2026"), "hello-world-2026");
});

test("parseJson tolerates fences and prose", () => {
  assert.deepEqual(parseJson<{ a: number }>("Sure:\n```json\n{\"a\":1}\n```"), { a: 1 });
  assert.deepEqual(parseJson<{ a: number }>("Here you go {\"a\":2} thanks"), { a: 2 });
});
