/** Browser-safe local redirect validation shared by login pages and the Apixis SDK. */
export function safeLocalRedirect(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(raw)) return fallback;
  try {
    const base = "https://local.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    let path = url.pathname;
    for (let i = 0; i < 8; i++) {
      if (path.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(path)) return fallback;
      const decoded = decodeURIComponent(path);
      if (decoded === path) return url.pathname + url.search + url.hash;
      path = decoded;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
