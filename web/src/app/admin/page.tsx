import { redirect } from "next/navigation";
import { currentProfile, serviceConfigured, supabaseAdmin } from "@/lib/supabase/server";
import { AdminPanel } from "./AdminPanel";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { profile } = await currentProfile();
  if (!profile?.is_owner) redirect("/login?next=%2Fadmin");
  if (!serviceConfigured()) return <div className="nx-page"><div className="nx-alert">Service role not configured.</div></div>;
  const db = supabaseAdmin();
  const day = new Date(Date.now() - 86400e3).toISOString();
  const [stories, posts, tickets, sources, social, runs, revenue, counts] = await Promise.all([
    db.from("stories").select("id,slug,headline,severity,status,confirmed,disputed,country,city,published_at,pinned_until,ai_label").order("published_at", { ascending: false }).limit(60),
    db.from("posts").select("id,body,status,place_name,created_at,moderation,author:profiles(display_name,username)").in("status", ["pending", "held"]).order("created_at", { ascending: false }).limit(40),
    db.from("tickets").select("*").neq("status", "closed").order("created_at", { ascending: false }).limit(40),
    db.from("sources").select("id,kind,name,active,country,city,last_ok_at,last_error,stream_url").order("kind").order("name"),
    db.from("social_accounts").select("id,platform,handle,scope,scope_key,active,last_posted_at,last_error,min_severity,min_gap_seconds").order("platform"),
    db.from("agent_runs").select("agent,ok,items,ms,detail,created_at").order("created_at", { ascending: false }).limit(30),
    db.from("revenue_events").select("kind,ixis,usd,created_at").gte("created_at", new Date(Date.now() - 30 * 86400e3).toISOString()),
    Promise.all([
      db.from("stories").select("id", { count: "exact", head: true }).gte("published_at", day).eq("status", "live"),
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "posted").gte("posted_at", day),
      db.from("transcripts").select("id", { count: "exact", head: true }).gte("created_at", day),
    ]),
  ]);
  const usd30 = (revenue.data ?? []).reduce((a, r) => a + Number(r.usd), 0);
  return (
    <div className="nx-page">
      <h1 className="nx-h1">Newsroom control</h1>
      <p className="nx-sub">Pin, edit, hold or remove anything. Approve reporters. Sources, social accounts, tickets, money, and what the agents did.</p>
      <div className="nx-grid nx-grid-3" style={{ marginBottom: 16 }}>
        <div className="nx-card nx-stat"><b>{counts[0].count ?? 0}</b><span>stories · 24h</span></div>
        <div className="nx-card nx-stat"><b>{counts[3].count ?? 0}</b><span>radio segments · 24h</span></div>
        <div className="nx-card nx-stat"><b>{counts[2].count ?? 0}</b><span>social posts · 24h</span></div>
        <div className="nx-card nx-stat"><b>{counts[1].count ?? 0}</b><span>accounts</span></div>
        <div className="nx-card nx-stat"><b>${usd30.toFixed(0)}</b><span>revenue · 30d (Ixis redeemed)</span></div>
        <div className="nx-card nx-stat"><b>{(tickets.data ?? []).length}</b><span>open tickets</span></div>
      </div>
      <AdminPanel stories={stories.data ?? []} posts={(posts.data ?? []) as never} tickets={tickets.data ?? []} sources={sources.data ?? []} social={social.data ?? []} runs={runs.data ?? []} />
    </div>
  );
}
