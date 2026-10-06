import { NextResponse } from "next/server";
import { buyIxisUrl, walletBalance, WalletError } from "@/lib/apixis-wallet";
import { apixisSubOf } from "@/lib/apixis-login";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** The signed-in person's ONE Apixis Wallet balance + a Buy Ixis link that comes back here (family pattern). */
export async function GET(request: Request) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const ref = request.headers.get("referer");
  const back = ref?.startsWith(origin) ? ref : origin + "/";
  const buy = buyIxisUrl("newsxis", back);
  const user = await currentUser();
  if (!user) return NextResponse.json({ available: null, buy, signIn: true, signedIn: false }, { status: 401 });
  const linked = Boolean(apixisSubOf(user));
  const owner = apixisSubOf(user) ?? user.email ?? null;
  if (!owner) return NextResponse.json({ available: null, buy, linked, signedIn: true });
  try {
    const balance = await walletBalance(owner, { history: 10 });
    return NextResponse.json({ ...balance, buy, linked, signedIn: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const signInWithApixis = error instanceof WalletError && (error.status === 403 || error.status === 404);
    return NextResponse.json({ available: null, buy, signInWithApixis, linked, signedIn: true }, { status: signInWithApixis ? 200 : 503 });
  }
}
