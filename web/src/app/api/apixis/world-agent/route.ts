// Every new Newsxis account gets its own agent in the Apixis world with the shared Wallet (owner #28).
// Same flow as the rest of the family (Apixis.dev docs/APIXIS_ENTER.md "Automatic agent on signup").
import { NextResponse } from "next/server";
import { serviceConfigured, supabaseAdmin, currentUser } from "@/lib/supabase/server";
import { provisionApixisWorldAgent } from "@/lib/apixis-world-provision";
import { ensureWorldAgent, welcomeSeenMetadata } from "@/lib/apixis-world-agent";
import { enterApixisUrl } from "@/lib/apixis-world";

export const dynamic = "force-dynamic";

const CLIENT = "newsxis";
const ROLLOUT_AT = "2026-10-06T00:00:00.000Z";

async function saveAppMetadata(userId: string, appMetadata: Record<string, unknown>) {
  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, { app_metadata: appMetadata });
  if (error) throw error;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ ok: false, error: "db_not_configured" }, { status: 503 });
  const view = await ensureWorldAgent(user, { client: CLIENT, provision: (input) => provisionApixisWorldAgent({ ...input, emailVerified: true, timeoutMs: 6000 }), saveAppMetadata }, ROLLOUT_AT);
  return NextResponse.json({ ok: true, ...view, enterUrl: enterApixisUrl(CLIENT) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = body?.action === "enter" ? "enter" : "dismiss";
  try { await saveAppMetadata(user.id, welcomeSeenMetadata(user.app_metadata, action)); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 }); }
}
