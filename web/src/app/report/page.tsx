import { apixisLoginHref } from "@/lib/public-site";
import { currentProfile, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";

export const metadata = {
  title: "Daily report",
  description: "Opt-in daily report from Cixy at 8:00 PM Central, labeled when it is AI-generated.",
};
export const dynamic = "force-dynamic";

type ReportRow = { id: string; report_date: string; title: string; body: string; ai_label: string; created_at: string };

export default async function ReportPage() {
  const { user, profile } = await currentProfile();
  let items: ReportRow[] = [];
  let unavailable = false;
  if (user && serviceConfigured()) {
    const { data, error } = await supabaseAdmin().from("daily_reports").select("id, report_date, title, body, ai_label, created_at").eq("user_id", user.id).order("report_date", { ascending: false }).limit(14);
    if (error) unavailable = true;
    else items = (data ?? []) as ReportRow[];
  }
  return (
    <div className="nx-page nx-page-narrow">
      <h1 className="nx-h1">Daily report</h1>
      <p className="nx-sub">Cixy can write you one report a day at 8:00 PM Central. It uses stories already on Newsxis. When a model writes it, the report is labeled AI. Turn it on from Account. It is off until you opt in.</p>
      {!user && <div className="nx-card"><p>Sign in with Apixis to turn the report on and to read yours.</p><a className="nx-btn" href={apixisLoginHref("/report")}>Sign in with Apixis</a></div>}
      {user && !profile?.daily_report_opt_in && <div className="nx-notice">The daily report is off for this account. <a href="/settings">Turn it on in Account.</a></div>}
      {user && profile?.daily_report_opt_in && items.length === 0 && !unavailable && <div className="nx-empty">No report yet. The next one is written at 8:00 PM Central.</div>}
      {unavailable && <div className="nx-notice">The daily report table is not on this database yet, so nothing is listed. No report is invented.</div>}
      <div className="nx-grid">
        {items.map((item) => (
          <article key={item.id} className="nx-card">
            <div className="nx-story-meta"><span className="nx-chip nx-chip-ai">AI</span><span>{item.report_date}</span></div>
            <h2 style={{ textTransform: "none", letterSpacing: 0, fontSize: 18, color: "var(--nx-ink)" }}>{item.title}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{item.body}</p>
            <p className="nx-tiny">{item.ai_label}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
