/**
 * Research a story with web search: what confirms it, what disagrees ("Another side"), and whether
 * sources contradict each other on facts (Disputed). Owner rule: real, sourced disagreement only;
 * never manufactured balance.
 */
import { CIXY_NEWS_SYSTEM } from "./cixy-role";
import { citationsOf, parseJson, smartText } from "./anthropic";
import type { Story } from "@/lib/types";

export type Research = {
  confirmed: boolean;
  disputed: boolean;
  confirmations: number;
  what_we_found: string;           // 2–5 sentences, attributed
  another_side: string | null;     // null when no real disagreement exists
  disputed_facts: string[];        // e.g. "Death toll: 12 (Reuters) vs 20 (local radio)"
  correction: string | null;       // if the original summary is wrong in a material way
  sources: Array<{ url: string; title: string; publisher: string; stance: "confirms" | "disputes" | "context" }>;
};

export async function researchStory(story: Pick<Story, "headline" | "summary" | "source_url" | "place_name" | "country" | "published_at" | "lang">, sourceName: string): Promise<Research> {
  const user = `Story as first written (from ${sourceName}${story.source_url ? `, ${story.source_url}` : ""}, ${story.published_at}):
Headline: ${story.headline}
Summary: ${story.summary}
Place: ${story.place_name ?? ""} ${story.country ?? ""}

Use web search (at most 6 searches) to find other reporting on this same event from the last 48 hours.
1. "What we found": which independent outlets confirm it, in 2–5 attributed sentences.
2. "Another side": ONLY if real sources tell it differently (a different cause, a different toll, a denial by a named party, a competing account). Attribute each. If every source agrees, set it to null. Do not invent balance.
3. "Disputed": true only when sources contradict each other on a fact (numbers, who did it, whether it happened). List each disputed fact as "<fact>: <value A> (<source>) vs <value B> (<source>)".
4. "Correction": only if the first summary states something the better sources show is wrong.
Write in language "${story.lang}". Return ONLY JSON:
{"confirmed":boolean,"disputed":boolean,"confirmations":number (independent outlets confirming, including the origin),"what_we_found":string,"another_side":string|null,"disputed_facts":string[],"correction":string|null,"sources":[{"url":string,"title":string,"publisher":string,"stance":"confirms"|"disputes"|"context"}]}`;
  const { text, message } = await smartText(CIXY_NEWS_SYSTEM, user, { webSearch: true, maxTokens: 6000, effort: "medium" });
  const out = parseJson<Research>(text);
  const cited = citationsOf(message);
  const seen = new Set((out.sources ?? []).map((s) => s.url));
  out.sources = [...(out.sources ?? []), ...cited.filter((c) => !seen.has(c.url)).map((c) => ({ url: c.url, title: c.title, publisher: safeHost(c.url), stance: "context" as const }))].slice(0, 12);
  out.confirmations = Math.max(1, Math.round(Number(out.confirmations) || 1));
  out.confirmed = Boolean(out.confirmed) && out.confirmations >= 2;
  out.disputed = Boolean(out.disputed) && (out.disputed_facts?.length ?? 0) > 0;
  return out;
}

export function safeHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
