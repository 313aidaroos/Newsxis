import { apixisLoginHref } from "@/lib/public-site";
import { currentProfile } from "@/lib/supabase/server";
import { BillingPanel } from "./BillingPanel";

export const metadata = { title: "Billing", description: "Reporter seat and sponsor prices. Card or Ixis, through the Apixis Wallet." };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { user } = await currentProfile();
  return (
    <div className="nx-page nx-page-narrow">
      <h1 className="nx-h1">Billing</h1>
      <p className="nx-sub">The Apixis Wallet is the checkout. Newsxis does not take card numbers and does not keep an Ixis balance. Every charge is tagged product newsxis. A completed purchase gets a receipt on this page.</p>
      <div className="nx-grid" style={{ marginBottom: 16 }}>
        <section className="nx-card">
          <h3>Reporter seat</h3>
          <p>$10 (1,000 Ixis) to activate, then $10 (1,000 Ixis) a month. It renews until you cancel. You choose card or Ixis.</p>
        </section>
        <section className="nx-card">
          <h3>Sponsor a briefing</h3>
          <p>5,000 Ixis ($50), one time. The line is “This briefing is brought to you by…” for one day and one region. Card or Ixis, your choice.</p>
        </section>
      </div>
      {user ? <BillingPanel /> : <div className="nx-card"><p>Sign in with Apixis to pay and to see your receipts.</p><a className="nx-btn" href={apixisLoginHref("/billing")}>Sign in with Apixis</a></div>}
    </div>
  );
}
