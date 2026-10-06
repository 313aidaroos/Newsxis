import { Suspense } from "react";
import { FeedPage } from "./FeedPage";
import "./feed.css";

export const metadata = { title: "Feed" };
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="nx-page">
      <h1 className="nx-h1">Feed</h1>
      <p className="nx-sub">Cixy's stories as they land, reporter posts from the ground, and the shared Apixis family feed.</p>
      <Suspense fallback={<div className="nx-empty">Loading…</div>}><FeedPage /></Suspense>
    </div>
  );
}
