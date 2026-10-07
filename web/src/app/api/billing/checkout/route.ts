/**
 * Reporter seat checkout. Card or Ixis, the customer's choice, through the Apixis Wallet.
 * Newsxis holds no Stripe key. If the Wallet route is not shipped yet, this returns a gap
 * and does not mark the person as paid.
 */
import { fail, json, siteUrl } from "@/lib/api";
import { apixisOwner } from "@/lib/apixis-login";
import { startReporterCheckout, type PayMethod } from "@/lib/billing";
import { ageAllowsUse } from "@/lib/safety";
import { currentProfile, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, profile } = await currentProfile();
  if (!user?.email || !profile) return fail("sign_in_required", 401);
  if (profile.banned || profile.age_blocked) return fail("not_allowed", 403);
  if (!ageAllowsUse(profile)) return fail("age_required", 403);
  const body = await request.json().catch(() => ({})) as { method?: string };
  const method: PayMethod | null = body.method === "card" || body.method === "ixis" ? body.method : null;
  if (!method) return fail("method_required");
  const owner = (await apixisOwner(user.email)) ?? user.email;
  const origin = siteUrl(request);
  const result = await startReporterCheckout({
    owner,
    method,
    activated: Boolean(profile.activated_at),
    successUrl: `${origin}/billing?checkout=return`,
    cancelUrl: `${origin}/post?checkout=cancel`,
  });
  if (!result.ok) return json({ ok: false, gap: result.gap, todo: result.todo, message: result.message }, result.gap === "endpoint_missing" ? 501 : 503);

  if (result.data.periodEnd && serviceConfigured()) {
    const patch: { reporter_active_until: string; activated_at?: string } = { reporter_active_until: result.data.periodEnd };
    if (!profile.activated_at) patch.activated_at = new Date().toISOString();
    await supabaseAdmin().from("profiles").update(patch).eq("id", user.id);
  }
  return json({ ok: true, url: result.data.url, receiptId: result.data.receiptId, periodEnd: result.data.periodEnd });
}
