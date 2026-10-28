import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function sql(name: string): string {
  return readFileSync(path.join(root, "supabase/migrations", name), "utf8");
}

test("receipts and the daily report can be applied twice", () => {
  const receipts = sql("005_receipts.sql");
  assert.match(receipts, /add column if not exists method/);
  assert.match(receipts, /drop constraint if exists revenue_events_method_check/);
  assert.match(receipts, /drop policy if exists "buyer reads own revenue"/);
  assert.match(receipts, /for select to authenticated/);
  assert.equal(receipts.includes("create table"), false);

  const report = sql("006_daily_report.sql");
  assert.match(report, /add column if not exists daily_report_opt_in/);
  assert.match(report, /create table if not exists public.daily_reports/);
  assert.match(report, /drop policy if exists "daily reports self read"/);
  assert.match(report, /enable row level security/);
  assert.match(report, /daily_reports_user_id_report_date_key/);
  assert.match(report, /grant select on public.daily_reports to authenticated/);
});

test("radio migration only updates known stations and is safe to re-run", () => {
  const radio = sql("007_radio_browser.sql");
  assert.equal(/create table/i.test(radio), false);
  assert.match(radio, /is distinct from/);
  assert.match(radio, /https:\/\/stream\.live\.vc\.bbcmedia\.co\.uk\/bbc_world_service/);
  for (const slug of ["bbc-world-service", "wbgo", "abc-newsradio", "rfi-english", "wnyc-am", "dw-english", "cbc-radio-one", "rne"]) {
    assert.ok(radio.includes(`'${slug}'`), slug);
  }
  assert.match(radio, /active = false/);
});
