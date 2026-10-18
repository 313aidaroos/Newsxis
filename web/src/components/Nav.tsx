"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LIVE_WINDOW_MS } from "@/lib/home-feed";
import { ApixisWalletChip } from "./ApixisWalletChip";
import { BrandMark } from "./BrandMark";

const LINKS: Array<[string, string]> = [
  ["/", "Globe"],
  ["/feed", "Feed"],
  ["/feed?tab=family", "Socixis Social"],
  ["/radio", "Radio"],
  ["/briefing", "Cixy"],
  ["/report", "Report"],
  ["/post", "Post"],
];

export function Nav() {
  const path = usePathname();
  const [me, setMe] = useState<{ signedIn: boolean; isOwner: boolean; signInReady: boolean } | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe({ signedIn: Boolean(d.signedIn), isOwner: Boolean(d.profile?.is_owner), signInReady: d.signInReady !== false && Boolean(d.signInReady) }))
      .catch(() => setMe({ signedIn: false, isOwner: false, signInReady: false }));
    const since = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
    fetch(`/api/stories?since=${encodeURIComponent(since)}&limit=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLive(Array.isArray(d.items) && d.items.length > 0))
      .catch(() => setLive(false));
  }, [path]);
  const current = (href: string) => {
    if (href === "/") return path === "/";
    if (href.startsWith("/feed?")) return false;
    return path === href || path?.startsWith(`${href}/`);
  };
  return (
    <header className="nx-nav">
      <Link href="/" className="nx-brand" aria-label="Newsxis home">
        <BrandMark height={40} />
        <span className="nx-word">Newsxis</span>
      </Link>
      <nav className="nx-nav-links" aria-label="Main">
        {LINKS.map(([href, label]) => <Link key={href} href={href} aria-current={current(href) ? "page" : undefined}>{label}</Link>)}
        {me?.isOwner && <Link href="/admin" aria-current={path?.startsWith("/admin") ? "page" : undefined}>Admin</Link>}
      </nav>
      <div className="nx-nav-right">
        {live ? <span className="nx-live">Live</span> : null}
        {me?.signedIn ? <ApixisWalletChip /> : null}
        {me?.signedIn ? <Link href="/billing" className="nx-btn nx-btn-2 nx-btn-sm">Billing</Link> : null}
        {me?.signedIn ? <Link href="/settings" className="nx-btn nx-btn-2 nx-btn-sm">Account</Link> : me?.signInReady ? <Link href="/login" className="nx-btn nx-btn-sm">Sign in with Apixis</Link> : null}
      </div>
    </header>
  );
}
