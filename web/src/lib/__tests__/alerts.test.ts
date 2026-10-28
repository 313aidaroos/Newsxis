import { test } from "node:test";
import assert from "node:assert/strict";
import { ALERT_BACKOFF_MS, ALERT_MAX_ATTEMPTS, alertFailedStatus, alertRetryState } from "../alerts";

const created = "2026-10-28T12:00:00.000Z";
const t0 = Date.parse(created);

test("a legacy failed row waits out the first backoff, then is retried", () => {
  assert.equal(alertRetryState("failed", created, t0 + ALERT_BACKOFF_MS[0] - 1).due, false);
  const due = alertRetryState("failed", created, t0 + ALERT_BACKOFF_MS[0]);
  assert.equal(due.due, true);
  assert.equal(due.attempts, 1);
  assert.match(alertFailedStatus(due.attempts, t0 + ALERT_BACKOFF_MS[0]), /^failed:2:\d+$/);
});

test("backoff grows and the last failed attempt is not retried", () => {
  const now = t0 + 10_000;
  const first = alertFailedStatus(0, now);
  assert.equal(first, `failed:1:${now + ALERT_BACKOFF_MS[0]}`);
  assert.equal(alertRetryState(first, created, now).due, false);
  assert.equal(alertRetryState(first, created, now + ALERT_BACKOFF_MS[0]).due, true);
  const fourth = alertFailedStatus(3, now);
  assert.match(fourth, /^failed:4:/);
  assert.equal(alertFailedStatus(4, now), "dead");
  assert.equal(alertRetryState("dead", created, now + 86400e3).terminal, true);
  assert.equal(alertRetryState("sent", created, now).due, false);
  assert.equal(ALERT_MAX_ATTEMPTS, 5);
});
