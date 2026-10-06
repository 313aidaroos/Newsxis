"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * The shared Apixis Wallet inside this site: the person's one Ixis balance as a small pill
 * (links to Buy Ixis on Apixis Wallet, which comes back here), plus "Sign in with Apixis" when the
 * person is signed out, or "Link Apixis ID" when signed in but not linked yet (never both).
 *
 * One fetch of GET /api/wallet/balance is shared by every chip on the page. It refetches when the
 * tab regains focus / becomes visible and on pageshow (back/forward cache), so the number updates
 * right after a purchase on Apixis Wallet sends the person back. Never shows a made-up number.
 * Updated 2026-09-27 (Grok, balance pill).
 */

type WalletState = { available: number | null; buy: string | null; linked: boolean; signedIn: boolean; loaded: boolean };

const INITIAL: WalletState = { available: null, buy: null, linked: false, signedIn: false, loaded: false };
const FALLBACK_BUY = "https://apixis-wallet.vercel.app/buy?product=newsxis";
let current: WalletState = INITIAL;
let inFlight = false;
let started = false;
const listeners = new Set<() => void>();

function load() {
  if (inFlight) return;
  inFlight = true;
  fetch("/api/wallet/balance", { cache: "no-store", credentials: "same-origin" })
    .then(async (response) => ({ status: response.status, data: await response.json().catch(() => null) }))
    .then(({ status, data }) => {
      const d = (data ?? {}) as Record<string, unknown>;
      current = {
        available: typeof d.available === "number" && Number.isFinite(d.available) ? d.available : null,
        buy: typeof d.buy === "string" ? d.buy : current.buy,
        linked: d.linked === true,
        signedIn: typeof d.signedIn === "boolean" ? d.signedIn : status !== 401,
        loaded: true,
      };
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined)
    .finally(() => {
      inFlight = false;
    });
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  load();
  window.addEventListener("focus", load);
  window.addEventListener("pageshow", load);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

export function useApixisWallet(): WalletState {
  return useSyncExternalStore(subscribe, () => current, () => INITIAL);
}

export function ApixisWalletChip({ className, next }: { className?: string; next?: string }) {
  const wallet = useApixisWallet();
  const [here, setHere] = useState("/");
  useEffect(() => {
    setHere(window.location.pathname + window.location.search);
  }, []);
  const signIn = `/auth/apixis/start?next=${encodeURIComponent(next ?? here)}`;
  const amount = wallet.available === null ? "—" : wallet.available.toLocaleString();
  return (
    <span className={["apx-wallet", className].filter(Boolean).join(" ")} style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <a
        className="apx-wallet-pill"
        href={wallet.buy ?? FALLBACK_BUY}
        title="Your Apixis Wallet balance · Buy Ixis"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 11px",
          borderRadius: 999,
          border: "1px solid color-mix(in srgb, currentColor 35%, transparent)",
          background: "color-mix(in srgb, currentColor 8%, transparent)",
          color: "inherit",
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.4,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden="true">✦</span>
        {amount} Ixis
      </a>
      {/* 2026-09-28 Grok Developer Bot: never ask a signed-in person to "Sign in" again. Signed out →
          "Sign in"; signed in with email only → "Link Apixis ID". */}
      {wallet.loaded && !wallet.signedIn && (
        <a className="apx-wallet-signin" href={`/login?next=${encodeURIComponent(next ?? here)}`} style={{ color: "inherit", fontSize: 11, textDecoration: "underline", whiteSpace: "nowrap", opacity: 0.85 }}>
          Sign in
        </a>
      )}
      {wallet.loaded && wallet.signedIn && !wallet.linked && (
        <a className="apx-wallet-signin" href={signIn} title="Connect this account to your Apixis ID to use one Wallet everywhere" style={{ color: "inherit", fontSize: 11, textDecoration: "underline", whiteSpace: "nowrap", opacity: 0.85 }}>
          Link Apixis ID
        </a>
      )}
    </span>
  );
}
