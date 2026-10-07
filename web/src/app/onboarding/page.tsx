import { redirect } from "next/navigation";
import { ageAllowsUse } from "@/lib/safety";
import { currentProfile } from "@/lib/supabase/server";
import { AgeQuestion } from "./AgeQuestion";

export const metadata = { title: "Age" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await currentProfile();
  if (!user || !profile) redirect("/login?next=%2Fonboarding");
  if (ageAllowsUse(profile) && sp.blocked !== "1") redirect("/");
  return (
    <div className="nx-page nx-page-narrow" style={{ maxWidth: 560 }}>
      <AgeQuestion blocked={Boolean(profile.age_blocked) || sp.blocked === "1"} />
    </div>
  );
}
