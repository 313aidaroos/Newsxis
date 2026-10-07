/** Cancel the reporter plan at the end of the paid period. The Wallet does this; we do not. */
import { fail, json } from "@/lib/api";
import { apixisOwner } from "@/lib/apixis-login";
import { cancelReporterPlan } from "@/lib/billing";
import { currentProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const { user } = await currentProfile();
  if (!user?.email) return fail("sign_in_required", 401);
  const owner = (await apixisOwner(user.email)) ?? user.email;
  const result = await cancelReporterPlan(owner);
  if (!result.ok) return json({ ok: false, gap: result.gap, todo: result.todo, message: result.message }, result.gap === "endpoint_missing" ? 501 : 503);
  return json({ ok: true, cancelAtPeriodEnd: result.data.cancelAtPeriodEnd });
}
