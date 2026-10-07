import { fail, json } from "@/lib/api";
import { AGE_COOKIE } from "@/lib/age-cookie";

export const dynamic = "force-dynamic";

/** Sets the short-lived cookie the Apixis sign-in start route requires. Not an account yet. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { ofAge?: unknown; next?: unknown };
  if (body.ofAge !== true) return fail("age_required", 403);
  const next = typeof body.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : "/";
  const res = json({ ok: true, url: `/auth/apixis/start?next=${encodeURIComponent(next)}` });
  res.cookies.set(AGE_COOKIE, "yes", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
