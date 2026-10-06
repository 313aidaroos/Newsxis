import { SignInWithApixis } from "@/components/SignInWithApixis";
import { safeLocalRedirect } from "@/lib/apixis-redirect";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeLocalRedirect(sp.next, "/");
  const errors: Record<string, string> = { login_expired: "That sign-in link expired. Try again.", apixis_unavailable: "Apixis ID is busy right now. Try again in a moment.", account_error: "We could not create your account. Contact newsxis@apixis.dev.", session_error: "Sign-in did not complete. Try again." };
  return (
    <div className="nx-page nx-page-narrow" style={{ maxWidth: 480 }}>
      <div className="nx-card" style={{ textAlign: "center", padding: 28 }}>
        <div className="nx-brand" style={{ justifyContent: "center", marginBottom: 10 }}><span className="nx-brand-dot" />NEWSXIS</div>
        <h1 className="nx-h1" style={{ fontSize: 24 }}>One Apixis account for every family site</h1>
        <p className="nx-muted">Watching Newsxis is free, no account needed. Sign in to post from the ground, chat, pick your home area and get breaking alerts. Every new account gets its own agent in the Apixis world with the shared Wallet.</p>
        {sp.error && <div className="nx-alert" style={{ margin: "12px 0" }}>{errors[sp.error] ?? "Sign-in failed. Try again."}</div>}
        <a className="nx-btn" href={`/auth/apixis/start?next=${encodeURIComponent(next)}`} style={{ width: "100%", marginTop: 8 }}>Sign in with Apixis</a>
        <SignInWithApixis next={next} className="nx-tiny" />
        <p className="nx-tiny">13+. By signing in you accept the Newsxis terms: AI-written news is labeled, posts are moderated, and posting needs a reporter seat paid in Ixis.</p>
      </div>
    </div>
  );
}
