/**
 * Cixy's spoken briefings: hourly world, 3-hourly regional, breaking right away. Script only here;
 * audio is lib/tts/elevenlabs.ts. Owner: "same anchor speaks whatever language is wide in that area".
 */
import { CIXY_ANCHOR_STYLE, CIXY_NEWS_SYSTEM } from "./cixy-role";
import { smartText } from "./anthropic";
import type { Story } from "@/lib/types";

export async function writeBriefing(opts: {
  scopeLabel: string;        // "the world" | "New York" | "the Middle East"
  kind: "hourly" | "regional" | "breaking" | "recap";
  lang: string;
  stories: Story[];
  sponsor?: string | null;
  maxWords?: number;
}): Promise<{ title: string; script: string }> {
  const items = opts.stories.slice(0, 12).map((s, i) =>
    `${i + 1}. [sev ${s.severity}${s.confirmed ? ", confirmed" : ""}${s.disputed ? ", disputed" : ""}] ${s.headline} — ${s.summary} (${[s.place_name, s.country].filter(Boolean).join(", ")}; source: ${s.ai_label.replace(/^Written by Cixy from /, "")}; ${s.published_at})`).join("\n");
  const user = `${CIXY_ANCHOR_STYLE}
Briefing kind: ${opts.kind}. Scope: ${opts.scopeLabel}. Language: "${opts.lang}". Word limit: ${opts.maxWords ?? 320}.
${opts.sponsor ? `Sponsor line to read once at the start, plainly: "This briefing is brought to you by ${opts.sponsor}."` : ""}
Stories (use only these; say "unconfirmed" where not confirmed; mention disagreement in one clause where disputed):
${items || "(no stories: say so in one calm sentence and close)"}

Return ONLY JSON: {"title": string (≤ 80 chars, e.g. "World · 14:00 UTC"), "script": string}`;
  const { text } = await smartText(CIXY_NEWS_SYSTEM, user, { maxTokens: 3000, effort: "low" });
  const fenced = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(fenced ? fenced[0] : text) as { title: string; script: string };
  if (!parsed.script) throw new Error("Empty briefing script");
  return parsed;
}

/** Time-slider narration: how an event unfolded over the last days (owner #18). */
export async function narrateTimeline(opts: { placeLabel: string; lang: string; stories: Story[]; from: string; to: string }): Promise<string> {
  const items = opts.stories.slice(0, 30).map((s) => `${s.published_at} · [sev ${s.severity}] ${s.headline} — ${s.summary}`).join("\n");
  const user = `In language "${opts.lang}", tell the listener, as a calm anchor, what happened in ${opts.placeLabel} between ${opts.from} and ${opts.to}, in order, and what led up to it, using only these items. Attribute. 120–220 words. Plain paragraphs, no lists. Return only the text.
${items || "(nothing recorded)"}`;
  const { text } = await smartText(CIXY_NEWS_SYSTEM, user, { maxTokens: 1500, effort: "low" });
  return text;
}
