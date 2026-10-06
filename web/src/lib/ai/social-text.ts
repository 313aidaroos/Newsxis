/** Short social post text for a story. Deterministic (no model call): cheap, instant, never wrong about facts. */
import type { Story } from "@/lib/types";

export function socialText(story: Story, siteUrl: string, platform: "x" | "facebook" | "bluesky"): string {
  const place = [story.place_name ?? story.city, story.country].filter(Boolean).join(", ");
  const tag = story.severity >= 5 ? "BREAKING · " : story.severity === 4 ? "CRITICAL · " : "";
  const status = story.disputed ? " · Disputed" : story.confirmed ? " · Confirmed" : " · Unconfirmed";
  const link = `${siteUrl.replace(/\/$/, "")}/story/${story.slug}`;
  const src = story.ai_label.replace(/^Written by Cixy from /, "");
  const limit = platform === "x" ? 280 : platform === "bluesky" ? 300 : 2000;
  const tail = `\n${place ? `📍 ${place}\n` : ""}${link}\nAI-written · source: ${src}${status}`;
  const room = limit - tail.length - tag.length - 2;
  const body = story.headline.length + story.summary.length + 3 <= room ? `${story.headline} — ${story.summary}` : story.headline.slice(0, Math.max(40, room));
  return `${tag}${body}${tail}`;
}
