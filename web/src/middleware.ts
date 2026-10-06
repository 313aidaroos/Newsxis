import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

// Refreshes the Supabase session on every request so people stay signed in; only /settings, /admin
// and /post require a session (the rest of Newsxis is free to watch).
const PROTECTED = ["/settings", "/admin"];

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const path = req.nextUrl.pathname;
  const needs = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  if (!url || !anon) return needs ? NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url)) : NextResponse.next();
  let res = NextResponse.next({ request: req });
  const cookies: CookieMethodsServer = {
    getAll: () => req.cookies.getAll(),
    setAll: (list) => {
      list.forEach(({ name, value }) => req.cookies.set(name, value));
      res = NextResponse.next({ request: req });
      list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    },
  };
  const supabase = createServerClient(url, anon, { cookies });
  let user: unknown = null;
  try { user = (await supabase.auth.getUser()).data.user; } catch { user = null; }
  if (!user && needs) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, req.url));
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg|manifest.json|api/cron|api/worker|api/card).*)"] };
