/**
 * Pure pieces of the radio listener. No network, no ffmpeg, no process exit.
 * radio-listener.mjs is the process that uses these.
 */

export const DEFAULT_BACKOFF_MS = 5_000;
export const MAX_BACKOFF_MS = 120_000;
export const MIN_SEGMENT_SECONDS = 20;
export const SILENCE_BYTES = 20_000;
export const MIN_WORDS = 12;

export function segmentSeconds(raw) {
  const n = Number(raw ?? 45);
  if (!Number.isFinite(n)) return 45;
  return Math.max(MIN_SEGMENT_SECONDS, n);
}

export function maxStreams(raw) {
  const n = Number(raw ?? 6);
  if (!Number.isFinite(n)) return 6;
  return Math.max(1, Math.floor(n));
}

export function onlySlugs(raw) {
  return String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function providerFromEnv(env) {
  const explicit = String(env.STT_PROVIDER ?? "").trim().toLowerCase();
  if (explicit) return explicit;
  return env.DEEPGRAM_API_KEY ? "deepgram" : "whisper";
}

export function nextBackoff(current) {
  const n = Number(current);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_BACKOFF_MS;
  return Math.min(n * 2, MAX_BACKOFF_MS);
}

export function isSilence(byteLength) {
  return !(Number(byteLength) >= SILENCE_BYTES);
}

export function wordCount(text) {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

export function shouldPostTranscript(text) {
  return wordCount(text) >= MIN_WORDS;
}

/** Active streams the worker was given, narrowed by ONLY and capped by MAX. */
export function chooseSources(sources, { only = [], max = 6 } = {}) {
  const wanted = new Set(only);
  return (sources ?? [])
    .filter((source) => source && source.stream_url && (!wanted.size || wanted.has(source.slug)))
    .slice(0, max);
}

export function ffmpegArgs(streamUrl, seconds, outPath) {
  return [
    "-hide_banner", "-loglevel", "error",
    "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "10",
    "-user_agent", "Newsxis/0.1 (+https://newsxis.apixis.dev)",
    "-i", streamUrl,
    "-t", String(seconds),
    "-ac", "1", "-ar", "16000",
    "-f", "wav", "-y", outPath,
  ];
}

export function deepgramListenUrl(lang) {
  const language = lang === "es" ? "es" : lang === "en" ? "en" : "multi";
  const params = new URLSearchParams({ model: "nova-3", smart_format: "true", punctuate: "true", language });
  return `https://api.deepgram.com/v1/listen?${params}`;
}

export function whisperEndpoint(base) {
  return `${String(base || "http://localhost:8000").replace(/\/$/, "")}/v1/audio/transcriptions`;
}

export function transcriptPayload(source, startedAt, endedAt, text) {
  return {
    source_id: source.id,
    started_at: startedAt,
    ended_at: endedAt,
    lang: source.lang,
    text,
  };
}
