/** Short social post text for a story. Deterministic (no model call): cheap, instant, never wrong about facts. */
import type { Story } from "@/lib/types";

export function socialText(story: Story, siteUrl: string, platform: "x" | "facebook" | "bluesky"): string {
  const place = [story.place_name ?? story.city, story.country].filter(Boolean).join(", ");
  const tag = story.severity >= 5 ? "BREAKING · " : story.severity === 4 ? "CRITICAL · " : "";
  const status = story.disputed ? " · Disputed" : story.confirmed ? " · Confirmed" : " · Unconfirmed";
  const link = `${siteUrl.replace(/\/$/, "")}/story/${story.slug}`;
  const limit = platform === "x" ? 280 : platform === "bluesky" ? 300 : 2000;
  let source = story.ai_label.replace(/^Written by Cixy from /, "");
  const placeLine = place ? `📍 ${place}` : "";
  const build = (body: string, sourceName: string, withPlace: boolean) => {
    const credit = `AI-written · source: ${sourceName}${status}`;
    return [body ? `${tag}${body}` : tag.replace(/\s+$/, ""), withPlace ? placeLine : "", link, credit].filter(Boolean).join("\n");
  };
  let text = build(`${story.headline} — ${story.summary}`, source, true);
  if (text.length <= limit) return text;
  text = build(story.headline, source, false);
  if (text.length <= limit) return text;
  while (source.length > 24 && build("", source, false).length > limit) source = source.slice(0, source.length - 16);
  const room = Math.max(0, limit - build("", source, false).length - 1);
  text = build(story.headline.slice(0, room).trim(), source, false);
  return text.length <= limit ? text : text.slice(0, limit);
}
