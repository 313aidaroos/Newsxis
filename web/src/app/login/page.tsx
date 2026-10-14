import { safeLocalRedirect } from "@/lib/apixis-redirect";
import { LoginCard } from "./LoginCard";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeLocalRedirect(sp.next, "/");
  return (
    <div className="nx-page nx-page-narrow" style={{ maxWidth: 480 }}>
      <LoginCard next={next} error={sp.error} />
    </div>
  );
}
