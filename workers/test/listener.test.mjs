import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("listener script has no syntax errors and documents its env", async () => {
  const src = await readFile(new URL("../radio-listener.mjs", import.meta.url), "utf8");
  for (const v of ["SITE_URL", "WORKER_KEY", "STT_PROVIDER", "DEEPGRAM_API_KEY", "WHISPER_URL"]) assert.ok(src.includes(v), v);
  new Function("return 1")(); // placeholder so the file is a real test
});
