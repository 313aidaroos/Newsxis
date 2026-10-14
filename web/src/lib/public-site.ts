/** Public site facts. No secrets. */

export const SITE_NAME = "Newsxis";

export const SITE_DESCRIPTION =
  "Cixy listens to public radio and free news feeds around the world, writes the story, researches it, shows the other side, and reads it on air. By Apixis Dev LLC.";

export const PUBLIC_PATHS = ["/", "/feed", "/radio", "/briefing", "/about", "/support", "/terms", "/privacy", "/login"] as const;

export function publicSiteUrl(raw = process.env.NEXT_PUBLIC_SITE_URL): string {
  const value = (raw ?? "https://newsxis.vercel.app").trim();
  return value.replace(/\/$/, "") || "https://newsxis.vercel.app";
}

/**
 * Official Facebook Page. Returns null until NEXT_PUBLIC_FACEBOOK_PAGE_URL is a real https Page URL.
 * A missing or non-Facebook value is left unlinked. Nothing is invented.
 */
export function facebookPageUrl(raw = process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "facebook.com" && host !== "m.facebook.com" && host !== "fb.com") return null;
    if (url.pathname === "/" || url.pathname === "") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Every sign-in door goes through /login so the 13+ question is the first step. */
export function apixisLoginHref(next = "/"): string {
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return `/login?next=${encodeURIComponent(safe)}`;
}
