export function slugify(text: string, max = 80): string {
  const base = text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
  return base || "story";
}
export function storySlug(headline: string): string {
  return `${slugify(headline, 70)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
