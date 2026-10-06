"use client";

/** "Sign in with Apixis": one Apixis account for every family site. Keeps the page's ?next=. */
export function SignInWithApixis({ next, className }: { next?: string; className?: string }) {
  const href = (target: string) => `/auth/apixis/start?next=${encodeURIComponent(target)}`;
  return (
    <p className={className} style={{ textAlign: "center", margin: "12px 0" }}>
      <a
        href={href(next ?? "/")}
        onClick={(event) => {
          if (next) return;
          const raw = new URLSearchParams(window.location.search).get("next");
          if (raw && raw.startsWith("/") && !raw.startsWith("//")) event.currentTarget.href = href(raw);
        }}
        style={{ fontWeight: 700, textDecoration: "underline" }}
      >
        Sign in with Apixis
      </a>
      <br />
      <small>One Apixis account for every family site.</small>
    </p>
  );
}
