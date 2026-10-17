/** Public site facts. No secrets. */

export const SITE_NAME = "Newsxis";

export const SITE_DESCRIPTION =
  "Cixy listens to public radio and free news feeds around the world, writes the story, researches it, shows the other side, and reads it on air. By Apixis Dev LLC.";

export const PUBLIC_PATHS = ["/", "/feed", "/radio", "/briefing", "/report", "/about", "/support", "/terms", "/privacy", "/login", "/billing"] as const;

export function publicSiteUrl(raw = process.env.NEXT_PUBLIC_SITE_URL): string {
  const value = (raw ?? "https://newsxis.vercel.app").trim();
  return value.replace(/\/$/, "") || "https://newsxis.vercel.app";
}

/** Official Newsxis Facebook Page. Used when NEXT_PUBLIC_FACEBOOK_PAGE_URL is unset. */
export const DEFAULT_FACEBOOK_PAGE_URL = "https://www.facebook.com/profile.php?id=61595105653913";

/**
 * Official Facebook Page.
 * A blank or missing NEXT_PUBLIC_FACEBOOK_PAGE_URL uses DEFAULT_FACEBOOK_PAGE_URL.
 * A set value overrides that default. http, a non-Facebook host, or a bare facebook.com/
 * stays unlinked. profile.php?id= is a real Page address (pathname /profile.php plus the id query).
 */
export function facebookPageUrl(raw: string | null | undefined = process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL): string | null {
  const chosen = raw?.trim() ? raw.trim() : DEFAULT_FACEBOOK_PAGE_URL;
  try {
    const url = new URL(chosen);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "facebook.com" && host !== "m.facebook.com" && host !== "fb.com") return null;
    if (url.pathname === "/" || url.pathname === "") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Facebook's page plugin does not render profile.php?id= addresses. Those stay a link. */
export function facebookPageEmbeds(url: string): boolean {
  try {
    return new URL(url).pathname !== "/profile.php";
  } catch {
    return false;
  }
}

/** Every sign-in door goes through /login so the 13+ question is the first step. */
export function apixisLoginHref(next = "/"): string {
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return `/login?next=${encodeURIComponent(safe)}`;
}

/** True only when this site has an Apixis ID client name. The value itself is never returned. */
export function apixisClientConfigured(raw: string | null | undefined = process.env.APIXIS_CLIENT_ID): boolean {
  return Boolean(raw?.trim());
}

/** Health flag for the public Facebook Page, including the built-in address when the env slot is empty. */
export function healthFacebookLinked(raw?: string | null): boolean {
  return Boolean(facebookPageUrl(raw));
}

/** Link-preview image. The brand lockup, not a generated stand-in. */
export const SHARE_IMAGE_PATH = "/brand/og-image.png";

/**
 * Other Ixis companies. Recovra is omitted: it merged into Deduxis.
 * Names without a verified site link to the family directory.
 */
export const FAMILY_COMPANIES: Array<{ name: string; href: string }> = [
  { name: "Apixis", href: "https://www.apixis.dev" },
  { name: "Apixis Wallet", href: "https://apixis-wallet.vercel.app" },
  { name: "Socixis", href: "https://www.apixis.dev/companies.html" },
  { name: "Lyrixis", href: "https://www.apixis.dev/companies.html" },
  { name: "Pinixis", href: "https://www.apixis.dev/companies.html" },
  { name: "Renoxis", href: "https://www.apixis.dev/companies.html" },
  { name: "Contraxis", href: "https://www.apixis.dev/companies.html" },
  { name: "Deduxis", href: "https://www.apixis.dev/companies.html" },
  { name: "Rawixis", href: "https://www.apixis.dev/companies.html" },
  { name: "Halaxis", href: "https://www.apixis.dev/companies.html" },
  { name: "Launchixis", href: "https://launchixis.vercel.app" },
  { name: "Geoxis", href: "https://www.apixis.dev/companies.html" },
  { name: "Ominixis", href: "https://www.apixis.dev/companies.html" },
  { name: "Wattixis", href: "https://wattixis.vercel.app" },
];
