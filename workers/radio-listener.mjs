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
 * Env: SITE_URL (https://newsxis.vercel.app), WORKER_KEY, STT_PROVIDER, DEEPGRAM_API_KEY | WHISPER_URL,
 *      SEGMENT_SECONDS (default 45), MAX_STREAMS (default 6), ONLY (comma list of source slugs, optional).
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITE = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.WORKER_KEY || "";
const PROVIDER = (process.env.STT_PROVIDER || (process.env.DEEPGRAM_API_KEY ? "deepgram" : "whisper")).toLowerCase();
const SEGMENT = Math.max(20, Number(process.env.SEGMENT_SECONDS || 45));
const MAX = Math.max(1, Number(process.env.MAX_STREAMS || 6));
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);

if (!KEY) { console.error("WORKER_KEY is required"); process.exit(1); }

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function api(path, init = {}) {
  const res = await fetch(`${SITE}${path}`, { ...init, headers: { "x-worker-key": KEY, "content-type": "application/json", ...(init.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status} ${body.error || ""}`);
  return body;
}

// ---------------------------------------------------------------- speech to text
async function transcribe(wavPath, lang) {
  const audio = await readFile(wavPath);
  if (audio.length < 20_000) return "";    // silence / stream hiccup
  if (PROVIDER === "deepgram") {
    const params = new URLSearchParams({ model: "nova-3", smart_format: "true", punctuate: "true", language: lang === "es" ? "es" : lang === "en" ? "en" : "multi" });
    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, { method: "POST", headers: { authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "content-type": "audio/wav" }, body: audio });
    if (!res.ok) throw new Error(`deepgram ${res.status}`);
    const j = await res.json();
    return j.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  }
  const url = (process.env.WHISPER_URL || "http://localhost:8000").replace(/\/$/, "");
  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/wav" }), "segment.wav");
  form.append("model", process.env.WHISPER_MODEL || "Systran/faster-whisper-small");
  form.append("response_format", "json");
  if (lang && lang.length === 2) form.append("language", lang);
  const res = await fetch(`${url}/v1/audio/transcriptions`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`whisper ${res.status}`);
  return (await res.json()).text ?? "";
}

// ---------------------------------------------------------------- one stream → endless segments
async function listen(source, signal) {
  const dir = await mkdtemp(join(tmpdir(), `nx-${source.slug || source.id}-`));
  let backoff = 5_000;
  while (!signal.aborted) {
    const startedAt = new Date();
    const out = join(dir, `${Date.now()}.wav`);
    // 16 kHz mono PCM, exactly SEGMENT seconds, reconnect-friendly flags.
    const ff = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "10", "-user_agent", "Newsxis/0.1 (+https://newsxis.vercel.app)", "-i", source.stream_url, "-t", String(SEGMENT), "-ac", "1", "-ar", "16000", "-f", "wav", "-y", out], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    ff.stderr.on("data", (d) => { err += d.toString(); });
    const code = await new Promise((res) => { ff.on("close", res); signal.addEventListener("abort", () => ff.kill("SIGTERM"), { once: true }); });
    if (code !== 0) {
      log(`[${source.name}] ffmpeg exit ${code}: ${err.trim().slice(0, 160)} — retry in ${backoff / 1000}s`);
      await new Promise((r) => setTimeout(r, backoff)); backoff = Math.min(backoff * 2, 120_000);
      continue;
    }
    backoff = 5_000;
    try {
      const text = (await transcribe(out, source.lang)).trim();
      if (text.split(/\s+/).length >= 12) {
        await api("/api/worker/transcripts", { method: "POST", body: JSON.stringify({ source_id: source.id, started_at: startedAt.toISOString(), ended_at: new Date().toISOString(), lang: source.lang, text }) });
        log(`[${source.name}] ${text.split(/\s+/).length} words`);
      }
    } catch (e) { log(`[${source.name}] ${e.message}`); }
    finally { await rm(out, { force: true }); }
  }
  await rm(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------- main
const running = new Map();
const ctl = new AbortController();
process.on("SIGINT", () => { log("stopping"); ctl.abort(); setTimeout(() => process.exit(0), 2000); });
process.on("SIGTERM", () => { ctl.abort(); setTimeout(() => process.exit(0), 2000); });

async function sync() {
  const { sources } = await api("/api/worker/transcripts");
  const wanted = sources.filter((s) => s.stream_url && (!ONLY.length || ONLY.includes(s.slug))).slice(0, MAX);
  for (const s of wanted) if (!running.has(s.id)) { log(`listening: ${s.name}`); running.set(s.id, listen(s, ctl.signal).catch((e) => log(`[${s.name}] stopped: ${e.message}`))); }
  log(`${running.size} stream(s) live (${PROVIDER})`);
}
await sync();
setInterval(() => sync().catch((e) => log("sync failed:", e.message)), 10 * 60_000);
