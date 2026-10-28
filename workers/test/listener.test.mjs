import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseSources, deepgramListenUrl, ffmpegArgs, isSilence, maxStreams, nextBackoff,
  onlySlugs, providerFromEnv, segmentSeconds, shouldPostTranscript, transcriptPayload,
  whisperEndpoint, DEFAULT_BACKOFF_MS, MAX_BACKOFF_MS, MIN_WORDS, SILENCE_BYTES,
} from "../listener-lib.mjs";

const stations = [
  { id: "1", slug: "wnyc-fm", name: "WNYC", stream_url: "https://fm939.wnyc.org/wnycfm", lang: "en" },
  { id: "2", slug: "bbc-world-service", name: "BBC", stream_url: "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service", lang: "en" },
  { id: "3", slug: "quiet", name: "No stream", stream_url: "", lang: "en" },
  { id: "4", slug: "npr-news", name: "NPR", stream_url: "https://npr-ice.streamguys1.com/live.mp3", lang: "en" },
];

test("stream selection keeps streams, honors ONLY, and caps the count", () => {
  assert.deepEqual(chooseSources(stations, { max: 6 }).map((s) => s.slug), ["wnyc-fm", "bbc-world-service", "npr-news"]);
  assert.deepEqual(chooseSources(stations, { only: ["npr-news", "missing"], max: 6 }).map((s) => s.slug), ["npr-news"]);
  assert.equal(chooseSources(stations, { max: 1 }).length, 1);
  assert.deepEqual(onlySlugs(" wnyc-fm, ,npr-news "), ["wnyc-fm", "npr-news"]);
  assert.equal(maxStreams("0"), 1);
  assert.equal(maxStreams("nope"), 6);
});

test("short or silent audio is not posted, and a real sentence is", () => {
  assert.equal(isSilence(SILENCE_BYTES - 1), true);
  assert.equal(isSilence(SILENCE_BYTES), false);
  assert.equal(shouldPostTranscript("one two"), false);
  const words = Array.from({ length: MIN_WORDS }, (_, i) => `word${i}`).join(" ");
  assert.equal(shouldPostTranscript(`  ${words}  `), true);
  assert.equal(shouldPostTranscript(""), false);
});

test("ffmpeg is asked for a timed mono wav from the station url", () => {
  const args = ffmpegArgs("https://example.test/live.mp3", segmentSeconds("10"), "/tmp/out.wav");
  assert.equal(segmentSeconds("10"), 20);
  assert.equal(segmentSeconds("45"), 45);
  assert.ok(args.includes("https://example.test/live.mp3"));
  assert.ok(args.includes("/tmp/out.wav"));
  assert.ok(args.includes("wav"));
  assert.equal(args[args.indexOf("-t") + 1], "20");
  assert.equal(args[args.indexOf("-ac") + 1], "1");
  assert.equal(args[args.indexOf("-ar") + 1], "16000");
  assert.ok(args.includes("Newsxis/0.1 (+https://newsxis.apixis.dev)"));
});

test("backoff doubles and then stops growing", () => {
  assert.equal(nextBackoff(DEFAULT_BACKOFF_MS), 10_000);
  assert.equal(nextBackoff(MAX_BACKOFF_MS), MAX_BACKOFF_MS);
  assert.equal(nextBackoff(Number.NaN), DEFAULT_BACKOFF_MS);
});

test("speech provider and transcript body follow the env and the source", () => {
  assert.equal(providerFromEnv({}), "whisper");
  assert.equal(providerFromEnv({ DEEPGRAM_API_KEY: "x" }), "deepgram");
  assert.equal(providerFromEnv({ STT_PROVIDER: "Whisper", DEEPGRAM_API_KEY: "x" }), "whisper");
  assert.match(deepgramListenUrl("es"), /language=es/);
  assert.match(deepgramListenUrl("en"), /language=en/);
  assert.match(deepgramListenUrl("fr"), /language=multi/);
  assert.equal(whisperEndpoint("http://localhost:8000/"), "http://localhost:8000/v1/audio/transcriptions");
  const body = transcriptPayload(stations[0], "2026-10-28T00:00:00.000Z", "2026-10-28T00:00:45.000Z", "hello from the studio");
  assert.equal(body.source_id, "1");
  assert.equal(body.lang, "en");
  assert.match(body.text, /studio/);
});
