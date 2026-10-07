import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { startApixisLogin } from "@/lib/apixis-login";
import { AGE_COOKIE, ageCookieYes } from "@/lib/age-cookie";

export const dynamic = "force-dynamic";

/** Sign-in starts only after the 13+ question on /login sets the cookie. */
export async function GET(request: Request) {
  const jar = await cookies();
  if (!ageCookieYes(jar.get(AGE_COOKIE)?.value)) {
    const next = new URL(request.url).searchParams.get("next") ?? "/";
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return NextResponse.redirect(new URL(`/login?error=age_required&next=${encodeURIComponent(safe)}`, request.url));
  }
  return startApixisLogin(request);
}
