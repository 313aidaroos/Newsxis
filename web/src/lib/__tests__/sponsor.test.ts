import { test } from "node:test";
import assert from "node:assert/strict";
import { receiptNote } from "../receipts";
import { activeSponsorName, parseSponsorNote, sponsorNote, sponsorScopeKey } from "../sponsor";

test("a sponsor line is read back for its scope and only for one day", () => {
  const now = Date.parse("2026-10-28T12:00:00.000Z");
  const world = sponsorNote("card", "Harbor Books", "world");
  const region = sponsorNote("ixis", "Northline", "region:ME");
  assert.equal(parseSponsorNote(world)?.name, "Harbor Books");
  assert.equal(parseSponsorNote(receiptNote("ixis", "Sponsor line: Harbor Books"))?.scope, "world");
  assert.equal(parseSponsorNote(region)?.scope, "region:ME");
  assert.equal(sponsorScopeKey("region:NOPE"), null);
  const rows = [
    { note: world, created_at: "2026-10-28T11:00:00.000Z" },
    { note: region, created_at: "2026-10-28T11:30:00.000Z" },
    { note: sponsorNote("card", "Yesterday", "world"), created_at: "2026-10-27T11:00:00.000Z" },
  ];
  assert.equal(activeSponsorName(rows, "world", now), "Harbor Books");
  assert.equal(activeSponsorName(rows, "region:ME", now), "Northline");
  assert.equal(activeSponsorName(rows, "US", now), null);
});
