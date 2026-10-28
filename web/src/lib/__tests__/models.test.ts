import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_FAST_MODEL, DEFAULT_SMART_MODEL, WEB_SEARCH_TOOL_TYPE } from "../ai/anthropic";

const example = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env.example"), "utf8");

test("the smart model default matches .env.example and the web search tool id is the 2026 dynamic filter", () => {
  const smart = example.match(/^ANTHROPIC_SMART_MODEL=(.+)$/m)?.[1];
  assert.equal(smart, DEFAULT_SMART_MODEL);
  assert.equal(DEFAULT_SMART_MODEL, "claude-sonnet-5-5");
  assert.equal(DEFAULT_FAST_MODEL, "claude-haiku-4-5");
  assert.match(example, /^ANTHROPIC_FAST_MODEL=claude-haiku-4-5-20251001$/m);
  assert.equal(WEB_SEARCH_TOOL_TYPE, "web_search_20260209");
});
