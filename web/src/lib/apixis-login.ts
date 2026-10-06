/**
 * "Sign in with Apixis" for a Next.js (App Router) sister site that uses Supabase auth.
 * Copy next to apixis-wallet.ts (lib/apixis-login.ts), together with sdk/apixis-redirect.ts
 * as lib/apixis-redirect.ts. Server only.
 *
 *   app/auth/apixis/start/route.ts     →  export { GET } from "@/lib/apixis-login-routes/start";
 *   app/auth/apixis/callback/route.ts  →  export { GET } from "@/lib/apixis-login-routes/callback";
 * or simply:
 *   export const GET = startApixisLogin;      // in start/route.ts
 *   export const GET = finishApixisLogin;     // in callback/route.ts
 *
 * Link your "Sign in" button to /auth/apixis/start?next=/where-to-go.
 *
 * Flow: start → Wallet /sso/authorize → (person signs in once on the Wallet) → callback here →
 * exchangeLoginCode (server, with WALLET_API_KEY) → this site's own Supabase session for the same
 * verified email → redirect to `next`. The Apixis ID `sub` is saved on the user as
 * app_metadata.apixis_sub; pass it as `owner` to every Wallet call (redeem, walletBalance, …).
 *
 * Env (this site's Vercel project):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (or _PUBLISHABLE_KEY)   this site's Supabase
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)                             this site's Supabase, server only
 *   WALLET_API_KEY, APIXIS_CLIENT_ID                                               from the Wallet lead
 * Callback URL to register with the Wallet: https://<your-domain>/auth/apixis/callback
 */
import { safeLocalRedirect } from "./apixis-redirect";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, type User } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { apixisLoginUrl, exchangeLoginCode } from "./apixis-wallet";

const STATE_COOKIE = "apixis_login";


function callbackUrl(request: Request) {
  const configured = process.env.APIXIS_REDIRECT_URI;
  if (configured) return configured;
  return new URL("/auth/apixis/callback", process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).toString();
}

function siteEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !service) throw new Error("Supabase env missing for Apixis login");
  return { url, anon, service };
}

/** GET /auth/apixis/start?next=/path */
export async function startApixisLogin(request: Request) {
  const next = safeLocalRedirect(new URL(request.url).searchParams.get("next"));
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(apixisLoginUrl({ state, redirectUri: callbackUrl(request) }), 302);
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/auth/apixis",
    maxAge: 600,
  });
  return response;
}

/** GET /auth/apixis/callback?code=…&state=… */
export async function finishApixisLogin(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  let saved: { state?: string; next?: string } = {};
  try {
    saved = JSON.parse(jar.get(STATE_COOKIE)?.value ?? "{}");
  } catch {
    saved = {};
  }
  jar.delete({ name: STATE_COOKIE, path: "/auth/apixis" });
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, url.origin), 302);

  const code = url.searchParams.get("code");
  if (url.searchParams.get("error")) return fail(url.searchParams.get("error") ?? "apixis_error");
  if (!code || !saved.state || url.searchParams.get("state") !== saved.state) return fail("login_expired");

  let identity: { sub: string; email: string };
  try {
    identity = await exchangeLoginCode(code, callbackUrl(request));
  } catch {
    return fail("apixis_unavailable");
  }

  const env = siteEnv();
  const admin = createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } });

  // Same person, this site's own account: create it on first sight (email already verified by Apixis ID).
  const created = await admin.auth.admin.createUser({
    email: identity.email,
    email_confirm: true,
    app_metadata: { apixis_sub: identity.sub },
  });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) return fail("account_error");

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: identity.email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return fail("account_error");
  const userId = link.data.user?.id;
  if (userId && link.data.user?.app_metadata?.apixis_sub !== identity.sub) {
    await admin.auth.admin.updateUserById(userId, { app_metadata: { ...link.data.user?.app_metadata, apixis_sub: identity.sub } });
  }

  const supabase = createServerClient(env.url, env.anon, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list: { name: string; value: string; options?: CookieOptions }[]) =>
        list.forEach(({ name, value, options }) => jar.set(name, value, options)),
    },
  });
  // "email" accepts the magic-link token and the `signup` token GoTrue mints for a brand-new address.
  const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (error) return fail("session_error");

  return NextResponse.redirect(new URL(safeLocalRedirect(saved.next ?? "/"), url.origin), 302);
}

/** The Apixis ID `sub` saved at sign-in; pass it as `owner` to Wallet calls. Null until they use Apixis sign-in. */
export function apixisSubOf(user: Pick<User, "app_metadata"> | null | undefined): string | null {
  const sub = user?.app_metadata?.apixis_sub;
  return typeof sub === "string" && sub ? sub : null;
}

/**
 * Who pays, for the signed-in request: their Apixis ID `sub` when they signed in with Apixis,
 * otherwise `fallbackEmail` (the verified email from YOUR session). Use as `owner` in redeem().
 */
export async function apixisOwner(fallbackEmail: string | null | undefined): Promise<string | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !anon) return fallbackEmail ?? null;
    const jar = await cookies();
    const supabase = createServerClient(url, anon, { cookies: { getAll: () => jar.getAll(), setAll: () => undefined } });
    const { data } = await supabase.auth.getUser();
    return apixisSubOf(data.user) ?? data.user?.email ?? fallbackEmail ?? null;
  } catch {
    return fallbackEmail ?? null;
  }
}
