import { Suspense } from "react";
import { showGraphicMedia } from "@/lib/safety";
import { currentProfile } from "@/lib/supabase/server";
import { FeedPage } from "./FeedPage";
import "./feed.css";

export const metadata = { title: "Feed" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { profile } = await currentProfile();
  return (
    <div className="nx-page">
      <h1 className="nx-h1">Feed</h1>
      <p className="nx-sub">Cixy's stories as they land, reporter posts from the ground, and Socixis Social.</p>
      <Suspense fallback={<div className="nx-empty">Loading…</div>}><FeedPage showGraphic={showGraphicMedia(profile?.show_graphic_media)} /></Suspense>
    </div>
  );
}
