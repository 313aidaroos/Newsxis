/**
 * Cixy's brain: Anthropic only (family rule). Two models: a fast cheap one for classification and
 * moderation, a strong one for research, "Another side" and briefings. Missing key → aiConfigured()
 * is false and callers answer 503. Nothing is ever faked.
 */
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function anthropic(): Anthropic {
  if (!aiConfigured()) throw new AiUnavailable("ai_not_configured");
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 });
  return client;
}

export const FAST_MODEL = process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-4-5";
export const SMART_MODEL = process.env.ANTHROPIC_SMART_MODEL || "claude-opus-5-5";

export class AiUnavailable extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

/** Text of a response (all text blocks joined). */
export function textOf(message: Anthropic.Message): string {
  return message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
}

/** Pull the first JSON object/array out of model text, tolerating code fences and prose around it. */
export function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try { return JSON.parse(candidate) as T; } catch { /* fall through */ }
  const start = candidate.search(/[[{]/);
  if (start >= 0) {
    const open = candidate[start], close = open === "{" ? "}" : "]";
    const end = candidate.lastIndexOf(close);
    if (end > start) return JSON.parse(candidate.slice(start, end + 1)) as T;
  }
  throw new Error("No JSON in model output");
}

/** One fast JSON call (classification, moderation). No thinking: Haiku 4.5 is a plain call. */
export async function fastJson<T>(system: string, user: string, maxTokens = 1200): Promise<T> {
  const res = await anthropic().messages.create({ model: FAST_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
  if (res.stop_reason === "refusal") throw new AiUnavailable("refused");
  return parseJson<T>(textOf(res));
}

/** One strong call (research with web search, briefings). Adaptive thinking is the model default. */
export async function smartText(system: string, user: string, opts: { webSearch?: boolean; maxTokens?: number; effort?: "low" | "medium" | "high" } = {}): Promise<{ text: string; message: Anthropic.Message }> {
  const tools = opts.webSearch ? [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }] : undefined;
  const stream = anthropic().messages.stream({
    model: SMART_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system,
    messages: [{ role: "user", content: user }],
    // Typed loosely so an SDK whose types lag the API still compiles; the API validates the shape.
    ...(tools ? { tools: tools as unknown as Anthropic.Tool[] } : {}),
    ...(opts.effort ? { output_config: { effort: opts.effort } } : {}),
  } as Anthropic.MessageStreamParams);
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new AiUnavailable("refused");
  return { text: textOf(message), message };
}

/** Citations the web_search tool returned (url + title), for the sources list. */
export function citationsOf(message: Anthropic.Message): Array<{ url: string; title: string }> {
  const out = new Map<string, string>();
  for (const block of message.content as unknown as Array<Record<string, unknown>>) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content as Array<Record<string, unknown>>) {
        if (r.type === "web_search_result" && typeof r.url === "string") out.set(r.url, typeof r.title === "string" ? r.title : r.url);
      }
    }
    if (block.type === "text" && Array.isArray(block.citations)) {
      for (const c of block.citations as Array<Record<string, unknown>>) {
        if (typeof c.url === "string") out.set(c.url, typeof c.title === "string" ? c.title : c.url);
      }
    }
  }
  return [...out].map(([url, title]) => ({ url, title }));
}
