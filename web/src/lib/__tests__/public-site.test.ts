import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FACEBOOK_PAGE_URL, apixisLoginHref, facebookPageEmbeds, facebookPageUrl, publicSiteUrl } from "../public-site";

test("facebook page url accepts an https Facebook path, including profile.php?id=", () => {
  const previous = process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL;
  delete process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL;
  try {
    assert.equal(facebookPageUrl(), DEFAULT_FACEBOOK_PAGE_URL);
    assert.equal(facebookPageUrl(undefined), DEFAULT_FACEBOOK_PAGE_URL);
    assert.equal(facebookPageUrl(""), DEFAULT_FACEBOOK_PAGE_URL);
    assert.equal(facebookPageUrl("   "), DEFAULT_FACEBOOK_PAGE_URL);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL;
    else process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL = previous;
  }
  assert.equal(facebookPageUrl("http://facebook.com/newsxis"), null);
  assert.equal(facebookPageUrl("https://example.com/newsxis"), null);
  assert.equal(facebookPageUrl("https://facebook.com/"), null);
  assert.equal(facebookPageUrl("https://www.facebook.com/newsxis"), "https://www.facebook.com/newsxis");
  assert.equal(
    facebookPageUrl("https://www.facebook.com/profile.php?id=61595105653913"),
    "https://www.facebook.com/profile.php?id=61595105653913",
  );
  assert.equal(facebookPageEmbeds("https://www.facebook.com/newsxis"), true);
  assert.equal(facebookPageEmbeds(DEFAULT_FACEBOOK_PAGE_URL), false);
  process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL = "https://www.facebook.com/newsxis";
  assert.equal(facebookPageUrl(), "https://www.facebook.com/newsxis");
  process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL = "https://example.com/not-facebook";
  assert.equal(facebookPageUrl(), null);
  if (previous === undefined) delete process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL;
  else process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL = previous;
});

test("sign-in always starts at the 13+ login page", () => {
  assert.equal(apixisLoginHref("/post"), "/login?next=%2Fpost");
  assert.equal(apixisLoginHref("//evil.example"), "/login?next=%2F");
  assert.equal(publicSiteUrl("https://newsxis.example/"), "https://newsxis.example");
});
