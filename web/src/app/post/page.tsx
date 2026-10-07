import { reporterSeatActive } from "@/lib/safety";
import { currentProfile } from "@/lib/supabase/server";
import { Composer } from "./Composer";

export const metadata = { title: "Post" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { user, profile } = await currentProfile();
  const seat = reporterSeatActive(profile);
  return (
    <div className="nx-page nx-page-narrow">
      <h1 className="nx-h1">Report from the ground</h1>
      <p className="nx-sub">Text, photos, video, voice notes and live clips. Everything is checked by Cixy before it goes live and shows on the globe where it happened.</p>
      {!user ? (
        <div className="nx-card"><p>Sign in to post. Watching is always free.</p><a className="nx-btn" href="/auth/apixis/start?next=%2Fpost">Sign in with Apixis</a></div>
      ) : (
        <Composer activated={Boolean(profile?.activated_at)} seatUntil={profile?.reporter_active_until ?? null} canPost={seat} home={{ lat: profile?.home_lat ?? null, lng: profile?.home_lng ?? null, name: profile?.home_place ?? null }} userId={user.id} />
      )}
    </div>
  );
}
