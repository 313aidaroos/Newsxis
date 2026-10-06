/**
 * Cixy's voice. ElevenLabs multilingual (one voice, every language). Missing key → returns null and
 * the briefing stays text-only (never a fake audio URL). Audio is stored in the Supabase `media` bucket.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export function ttsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
}

export async function synthesize(text: string, lang: string): Promise<Buffer | null> {
  if (!ttsConfigured()) return null;
  const voice = process.env.ELEVENLABS_VOICE_ID!;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_96`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
      language_code: lang.length === 2 ? lang : undefined,
      // Soft, clear, slightly sci-fi: low style, high clarity, a little speaker boost.
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function storeAudio(db: SupabaseClient, path: string, audio: Buffer): Promise<string> {
  const { error } = await db.storage.from("media").upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  if (error) throw error;
  return db.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/** Rough spoken duration: ~2.6 words/second for a calm anchor. */
export function estimateSeconds(script: string): number {
  return Math.round(script.trim().split(/\s+/).length / 2.6);
}
