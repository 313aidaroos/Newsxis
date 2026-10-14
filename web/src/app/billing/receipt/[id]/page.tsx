import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/billing";
import { localReceipts, type RevenueRow } from "@/lib/receipts";
import { currentProfile, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import { apixisLoginHref } from "@/lib/public-site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: "Receipt", robots: { index: false, follow: false }, alternates: { canonical: `/billing/receipt/${id}` } };
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await currentProfile();
  if (!user) {
    return (
      <div className="nx-page nx-page-narrow">
        <h1 className="nx-h1">Receipt</h1>
        <div className="nx-card"><p>Sign in with Apixis to open this receipt.</p><a className="nx-btn" href={apixisLoginHref(`/billing/receipt/${id}`)}>Sign in with Apixis</a></div>
      </div>
    );
  }
  if (!serviceConfigured()) {
    return (
      <div className="nx-page nx-page-narrow">
        <h1 className="nx-h1">Receipt</h1>
        <div className="nx-notice">Receipts are stored after a Wallet purchase. The database is not connected on this server, so this receipt cannot be loaded. Nothing is invented.</div>
      </div>
    );
  }
  const { data } = await supabaseAdmin().from("revenue_events").select("id, ixis, usd, wallet_receipt_id, product_key, note, created_at").eq("id", id).eq("user_id", user.id).maybeSingle();
  const receipt = localReceipts(data ? [data as RevenueRow] : [])[0];
  if (!receipt) notFound();
  const when = new Date(receipt.occurredAt);
  return (
    <div className="nx-page nx-page-narrow">
      <h1 className="nx-h1">Receipt</h1>
      <p className="nx-sub">Recorded when the Apixis Wallet accepted this purchase. Newsxis did not charge a card itself.</p>
      <article className="nx-card">
        <div className="nx-card-head"><h3>{receipt.description}</h3><span className="nx-chip nx-chip-ai">AI product · newsxis</span></div>
        <p>Amount: <strong>{formatMoney(receipt)}</strong></p>
        <p>Paid with: <strong>{receipt.method === "card" ? "Card" : "Ixis"}</strong></p>
        <p>Date: <strong>{Number.isFinite(when.getTime()) ? when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : receipt.occurredAt}</strong></p>
        {receipt.walletReceiptId && <p>Wallet receipt: <span className="nx-mono">{receipt.walletReceiptId}</span></p>}
        <p className="nx-tiny">Product {receipt.lookupKey}. Tagged product newsxis.</p>
        <p><Link href="/billing">Back to billing</Link></p>
      </article>
    </div>
  );
}
