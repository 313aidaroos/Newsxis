/**
 * Moderation for user posts and comments. Cheap model. Returns a decision + whether media is graphic
 * (graphic news is allowed, blurred, and switchable off in settings; prohibited content is held).
 */
import { CIXY_NEWS_SYSTEM } from "./cixy-role";
import { fastJson } from "./anthropic";

export type Moderation = {
  decision: "live" | "held" | "removed";
  reason: string | null;
  graphic: boolean;
  categories: string[];       // "violence_news" | "gore" | "adult" | "hate" | "harassment" | "spam" | "self_harm" | "private_info" | "misinformation_risk" | "ok"
  is_news: boolean;
  lang: string;
};

export async function moderateText(body: string, context: { hasMedia: boolean; place?: string | null }): Promise<Moderation> {
  const user = `A person posted this on Newsxis (a 13+ real-time news site where graphic news is allowed but blurred):
"""
${body.slice(0, 4000)}
"""
Has media attached: ${context.hasMedia}. Place: ${context.place ?? "unknown"}.
Rules: remove adult content, hate, harassment of private people, doxxing (addresses, phone numbers), spam/scams, self-harm encouragement. Hold (for the owner) anything that reads like a serious unverified claim about a named private person. Graphic descriptions of real news events are allowed (mark graphic=true). Opinions are allowed.
Return ONLY JSON: {"decision":"live"|"held"|"removed","reason":string|null,"graphic":boolean,"categories":string[],"is_news":boolean,"lang":ISO-639-1}`;
  return fastJson<Moderation>(CIXY_NEWS_SYSTEM, user, 400);
}
