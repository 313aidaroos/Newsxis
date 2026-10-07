"use client";
import { useEffect, useState } from "react";
type BillingPayment = {
  id: string;
  occurredAt: string;
  description: string;
  method: "card" | "ixis";
  amountUsdCents: number | null;
  ixisAmount: number | null;
  receiptUrl: string | null;
};

function formatMoney(payment: Pick<BillingPayment, "method" | "amountUsdCents" | "ixisAmount">): string {
  if (payment.method === "ixis" && payment.ixisAmount !== null) {
    const usd = payment.amountUsdCents !== null ? ` ($${(payment.amountUsdCents / 100).toFixed(2)})` : "";
    return `${payment.ixisAmount.toLocaleString("en-US")} Ixis${usd}`;
  }
  if (payment.amountUsdCents !== null) return `$${(payment.amountUsdCents / 100).toFixed(2)}`;
  return "Amount unavailable";
}

type Gap = { path: string; gap: string; todo: string; message: string };
type IxisRow = { id: string; description: string; amount: number; createdAt: string; method: "ixis" };
type Payload = {
  ok: boolean;
  accessUntil: string | null;
  activated: boolean;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionKnown: boolean;
  payments: BillingPayment[];
  paymentsKnown: boolean;
  ixisActivity: IxisRow[];
  ixisError: string | null;
  gaps: Gap[];
  message?: string;
};

function when(iso: string | null): string {
  if (!iso) return "Not available yet";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Not available yet";
  return new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function BillingPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/billing", { cache: "no-store" }).then((r) => r.json()).then(setData).catch(() => setData(null));
  }, []);

  const cancel = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/billing/cancel", { method: "POST" }).then((x) => x.json()).catch(() => ({ ok: false, message: "Could not reach the Wallet." }));
    setBusy(false);
    if (r.ok) {
      setMsg("Cancellation is set for the end of this paid period. You keep access until then.");
      setData((d) => d ? { ...d, cancelAtPeriodEnd: true } : d);
      return;
    }
    setMsg(r.gap === "endpoint_missing"
      ? "Cancel is not available yet. The Apixis Wallet has not shipped plan cancellation, so nothing was changed and your seat stays as it is."
      : r.message ?? "The Wallet could not cancel this plan. Nothing was changed.");
  };

  if (!data) return <div className="nx-empty">Loading billing…</div>;
  if (!data.ok) return <div className="nx-alert">{data.message ?? "Sign in to see billing."}</div>;

  return (
    <div className="nx-grid">
      <section className="nx-card">
        <div className="nx-card-head"><h3>Reporter seat</h3><span className={`nx-chip ${data.activated ? "nx-chip-ok" : ""}`}>{data.activated ? "Activated" : "Not activated"}</span></div>
        <p className="nx-muted">$10 (1,000 Ixis) to activate, then $10 (1,000 Ixis) a month. Card or Ixis, your choice, through the Apixis Wallet. Tagged product newsxis. Cancel any time; access stays until the paid period ends.</p>
        <p>Seat access until: <strong>{when(data.accessUntil)}</strong></p>
        <p>Next renewal: <strong>{data.subscriptionKnown || data.renewsAt ? when(data.renewsAt) : "Coming soon"}</strong></p>
        {data.cancelAtPeriodEnd && <p className="nx-tiny">Cancellation is already scheduled for the end of this period.</p>}
        {!data.subscriptionKnown && <p className="nx-tiny">The Wallet does not report a renewal date yet. The date above is blank on purpose. Nothing is invented.</p>}
        <div className="nx-actions">
          <button className="nx-btn" type="button" disabled={busy || data.cancelAtPeriodEnd} onClick={cancel}>{busy ? "Contacting the Wallet…" : "Cancel renewal"}</button>
          <a className="nx-btn nx-btn-2" href="/post">Reporter seat</a>
        </div>
      </section>
      {msg && <div className={msg.startsWith("Cancellation is set") ? "nx-notice" : "nx-alert"}>{msg}</div>}
      <section className="nx-card">
        <h3>Payment history</h3>
        {data.paymentsKnown && data.payments.length === 0 && <p className="nx-empty">No Newsxis payments on the Wallet yet.</p>}
        {data.paymentsKnown && data.payments.length > 0 && (
          <table className="nx-table">
            <thead><tr><th>Date</th><th>For</th><th>Amount</th><th>Paid with</th></tr></thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>{when(p.occurredAt)}</td>
                  <td>{p.description}{p.receiptUrl && <> · <a href={p.receiptUrl}>Receipt</a></>}</td>
                  <td>{formatMoney(p)}</td>
                  <td>{p.method === "card" ? "Card" : "Ixis"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!data.paymentsKnown && (
          <div className="nx-notice">
            Payment history is coming soon. The Wallet does not have a billing-history route for sister sites yet, so this list is empty. Card charges and Ixis subscription renewals will show here when it does.
          </div>
        )}
      </section>
      <section className="nx-card">
        <h3>Ixis activity</h3>
        <p className="nx-tiny">From the Wallet balance you already have. These are Ixis movements, not card charges.</p>
        {data.ixisError && <p className="nx-muted">{data.ixisError}</p>}
        {!data.ixisError && data.ixisActivity.length === 0 && <p className="nx-empty">No Newsxis Ixis activity yet.</p>}
        {data.ixisActivity.length > 0 && (
          <table className="nx-table">
            <thead><tr><th>Date</th><th>For</th><th>Amount</th><th>Paid with</th></tr></thead>
            <tbody>
              {data.ixisActivity.map((row) => (
                <tr key={row.id}>
                  <td>{when(row.createdAt)}</td>
                  <td>{row.description}</td>
                  <td>{Math.abs(row.amount).toLocaleString("en-US")} Ixis</td>
                  <td>Ixis</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {data.gaps.length > 0 && (
        <section className="nx-card">
          <h3>Waiting on the Wallet</h3>
          <ul>
            {data.gaps.map((g) => <li key={g.path}><span className="nx-mono">{g.path}</span> — {g.message}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
