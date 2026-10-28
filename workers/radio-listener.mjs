#!/usr/bin/env node
/**
 * Newsxis radio listener: listens to every active radio/scanner stream 24/7, transcribes it, and
 * posts transcript segments to the site, where Cixy turns them into stories.
 *
 * Runs anywhere with Node 20+ and ffmpeg (one small VPS or the Oracle free tier). No Supabase keys
 * here: it only talks to the site with WORKER_KEY.
 *
 * Speech-to-text (STT_PROVIDER):
 *   deepgram   DEEPGRAM_API_KEY, nova-3, pay per minute (simplest; ~$0.0043/min ≈ $190/station/month)
 *   whisper    WHISPER_URL → an OpenAI-compatible /v1/audio/transcriptions server you run yourself
 *              (faster-whisper-server / whisper.cpp server). Open source, ~$10–30/station/month in CPU.
 *
 * Env: SITE_URL (https://newsxis.apixis.dev), WORKER_KEY, STT_PROVIDER, DEEPGRAM_API_KEY | WHISPER_URL,
 *      SEGMENT_SECONDS (default 45), MAX_STREAMS (default 6), ONLY (comma list of source slugs, optional).
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chooseSources, deepgramListenUrl, ffmpegArgs, isSilence, maxStreams, nextBackoff,
  onlySlugs, providerFromEnv, segmentSeconds, shouldPostTranscript, transcriptPayload,
  whisperEndpoint, DEFAULT_BACKOFF_MS,
} from "./listener-lib.mjs";

const SITE = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.WORKER_KEY || "";
const PROVIDER = providerFromEnv(process.env);
const SEGMENT = segmentSeconds(process.env.SEGMENT_SECONDS);
const MAX = maxStreams(process.env.MAX_STREAMS);
const ONLY = onlySlugs(process.env.ONLY);

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function api(apiPath, init = {}) {
  const res = await fetch(`${SITE}${apiPath}`, { ...init, headers: { "x-worker-key": KEY, "content-type": "application/json", ...(init.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${apiPath} → ${res.status} ${body.error || ""}`);
  return body;
}

async function transcribe(wavPath, lang) {
  const audio = await readFile(wavPath);
  if (isSilence(audio.length)) return "";
  if (PROVIDER === "deepgram") {
    const res = await fetch(deepgramListenUrl(lang), { method: "POST", headers: { authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "content-type": "audio/wav" }, body: audio });
    if (!res.ok) throw new Error(`deepgram ${res.status}`);
    const j = await res.json();
    return j.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  }
  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/wav" }), "segment.wav");
  form.append("model", process.env.WHISPER_MODEL || "Systran/faster-whisper-small");
  form.append("response_format", "json");
  if (lang && lang.length === 2) form.append("language", lang);
  const res = await fetch(whisperEndpoint(process.env.WHISPER_URL), { method: "POST", body: form });
  if (!res.ok) throw new Error(`whisper ${res.status}`);
  return (await res.json()).text ?? "";
}

async function listen(source, signal) {
  const dir = await mkdtemp(path.join(tmpdir(), `nx-${source.slug || source.id}-`));
  let backoff = DEFAULT_BACKOFF_MS;
  while (!signal.aborted) {
    const startedAt = new Date();
    const out = path.join(dir, `${Date.now()}.wav`);
    const ff = spawn("ffmpeg", ffmpegArgs(source.stream_url, SEGMENT, out), { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    ff.stderr.on("data", (d) => { err += d.toString(); });
    const code = await new Promise((res) => { ff.on("close", res); signal.addEventListener("abort", () => ff.kill("SIGTERM"), { once: true }); });
    if (code !== 0) {
      log(`[${source.name}] ffmpeg exit ${code}: ${err.trim().slice(0, 160)} — retry in ${backoff / 1000}s`);
      await new Promise((r) => setTimeout(r, backoff));
      backoff = nextBackoff(backoff);
      continue;
    }
    backoff = DEFAULT_BACKOFF_MS;
    try {
      const text = (await transcribe(out, source.lang)).trim();
      if (shouldPostTranscript(text)) {
        await api("/api/worker/transcripts", { method: "POST", body: JSON.stringify(transcriptPayload(source, startedAt.toISOString(), new Date().toISOString(), text)) });
        log(`[${source.name}] ${text.split(/\s+/).length} words`);
      }
    } catch (e) { log(`[${source.name}] ${e.message}`); }
    finally { await rm(out, { force: true }); }
  }
  await rm(dir, { recursive: true, force: true });
}

const running = new Map();
const ctl = new AbortController();

async function sync() {
  const { sources } = await api("/api/worker/transcripts");
  const wanted = chooseSources(sources, { only: ONLY, max: MAX });
  for (const s of wanted) if (!running.has(s.id)) { log(`listening: ${s.name}`); running.set(s.id, listen(s, ctl.signal).catch((e) => log(`[${s.name}] stopped: ${e.message}`))); }
  log(`${running.size} stream(s) live (${PROVIDER})`);
}

function ranAsScript() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (ranAsScript()) {
  if (!KEY) { console.error("WORKER_KEY is required"); process.exit(1); }
  process.on("SIGINT", () => { log("stopping"); ctl.abort(); setTimeout(() => process.exit(0), 2000); });
  process.on("SIGTERM", () => { ctl.abort(); setTimeout(() => process.exit(0), 2000); });
  await sync();
  setInterval(() => sync().catch((e) => log("sync failed:", e.message)), 10 * 60_000);
}
