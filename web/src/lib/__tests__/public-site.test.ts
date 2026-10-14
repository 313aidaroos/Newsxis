import { test } from "node:test";
import assert from "node:assert/strict";
import { apixisLoginHref, facebookPageUrl, publicSiteUrl } from "../public-site";

test("facebook page url accepts only an https Facebook path", () => {
  assert.equal(facebookPageUrl(""), null);
  assert.equal(facebookPageUrl(undefined), null);
  assert.equal(facebookPageUrl("http://facebook.com/newsxis"), null);
  assert.equal(facebookPageUrl("https://example.com/newsxis"), null);
  assert.equal(facebookPageUrl("https://facebook.com/"), null);
  assert.equal(facebookPageUrl("https://www.facebook.com/newsxis"), "https://www.facebook.com/newsxis");
});

test("sign-in always starts at the 13+ login page", () => {
  assert.equal(apixisLoginHref("/post"), "/login?next=%2Fpost");
  assert.equal(apixisLoginHref("//evil.example"), "/login?next=%2F");
  assert.equal(publicSiteUrl("https://newsxis.example/"), "https://newsxis.example");
});
