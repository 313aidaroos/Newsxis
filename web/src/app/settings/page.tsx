import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase/server";
import { apixisSubOf } from "@/lib/apixis-login";
import { SettingsForm } from "./SettingsForm";
import { WorldAgentCard } from "@/components/WorldAgentCard";

export const metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { user, profile } = await currentProfile();
  if (!user || !profile) redirect("/login?next=%2Fsettings");
  return (
    <div className="nx-page nx-page-narrow">
      <h1 className="nx-h1">Account</h1>
      <p className="nx-sub">{user.email} · {apixisSubOf(user) ? "Apixis ID linked" : "Not linked to Apixis ID yet"} · {profile.reporter_points} reporter points{profile.verified_reporter ? " · Verified reporter ✓" : ""}</p>
      <WorldAgentCard />
      <SettingsForm profile={profile} />
      <form action="/auth/signout" method="post" style={{ marginTop: 16 }}><button className="nx-btn nx-btn-2" type="submit">Sign out</button></form>
    </div>
  );
}
