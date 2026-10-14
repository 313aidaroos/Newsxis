import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase/server";
import { BillingPanel } from "./BillingPanel";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { user } = await currentProfile();
  if (!user) redirect("/login?next=%2Fbilling");
  return (
    <div className="nx-page nx-page-narrow">
      <h1 className="nx-h1">Billing</h1>
      <p className="nx-sub">The Apixis Wallet is the checkout. Newsxis does not take card numbers and does not keep an Ixis balance. Every charge is tagged product newsxis.</p>
      <BillingPanel />
    </div>
  );
}
