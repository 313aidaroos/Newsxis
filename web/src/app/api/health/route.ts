import { json } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/anthropic";
import { ttsConfigured } from "@/lib/tts/elevenlabs";
import { isWalletConfigured } from "@/lib/apixis-wallet";
import { serviceConfigured, supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** What is wired and what is not: never fake readiness. */
export async function GET() {
  return json({
    ok: true, site: "newsxis",
    supabase: supabaseConfigured(), service_role: serviceConfigured(), ai: aiConfigured(), tts: ttsConfigured(),
    wallet: isWalletConfigured(), world: Boolean(process.env.APIXIS_WORLD_KEY), maps: Boolean(process.env.NEXT_PUBLIC_MAPTILER_KEY),
    cron: Boolean(process.env.CRON_SECRET), worker: Boolean(process.env.WORKER_KEY),
    social: { bluesky: Boolean(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD), x: Boolean(process.env.X_CLIENT_ID), facebook: Boolean(process.env.META_APP_ID) },
  });
}
