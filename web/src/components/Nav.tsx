"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ApixisWalletChip } from "./ApixisWalletChip";

const LINKS: Array<[string, string]> = [["/", "Globe"], ["/feed", "Feed"], ["/radio", "Radio"], ["/briefing", "Cixy"], ["/post", "Post"]];

export function Nav() {
  const path = usePathname();
  const [me, setMe] = useState<{ signedIn: boolean; isOwner: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).then((d) => setMe({ signedIn: Boolean(d.signedIn), isOwner: Boolean(d.profile?.is_owner) })).catch(() => setMe({ signedIn: false, isOwner: false }));
  }, [path]);
  return (
    <header className="nx-nav">
      <Link href="/" className="nx-brand" aria-label="Newsxis home"><span className="nx-brand-dot" />NEWSXIS<small>by Apixis</small></Link>
      <nav className="nx-nav-links" aria-label="Main">
        {LINKS.map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>)}
        {me?.isOwner && <Link href="/admin" aria-current={path?.startsWith("/admin") ? "page" : undefined}>Admin</Link>}
      </nav>
      <div className="nx-nav-right">
        <span className="nx-live">Live</span>
        <ApixisWalletChip />
        {me?.signedIn ? <Link href="/billing" className="nx-btn nx-btn-2 nx-btn-sm">Billing</Link> : null}
        {me?.signedIn ? <Link href="/settings" className="nx-btn nx-btn-2 nx-btn-sm">Account</Link> : <Link href="/login" className="nx-btn nx-btn-sm">Sign in</Link>}
      </div>
    </header>
  );
}
