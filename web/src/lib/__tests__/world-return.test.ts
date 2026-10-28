import { test } from "node:test";
import assert from "node:assert/strict";
import { enterApixisUrl } from "../apixis-world";

test("the Apixis world link carries Newsxis so the back link can be built", () => {
  const url = new URL(enterApixisUrl("newsxis"));
  assert.equal(url.origin, "https://www.apixis.dev");
  assert.equal(url.pathname, "/enter");
  assert.equal(url.searchParams.get("from"), "newsxis");
});
