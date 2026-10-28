/**
 * A sponsor purchase is one day and one briefing scope.
 * The line lives in revenue_events.note so it can be saved before migration 005
 * adds a method column. Briefings read that note. Nothing is invented when it is missing.
 */
import type { PayMethod } from "@/lib/billing";
import { REGIONS } from "@/lib/geo";
import { receiptNote } from "@/lib/receipts";

export const SPONSOR_DAY_MS = 24 * 60 * 60 * 1000;

export function sponsorScopes(): Array<{ key: string; label: string }> {
  return [
    { key: "world", label: "World" },
    ...Object.entries(REGIONS).map(([key, region]) => ({ key: `region:${key}`, label: region.name })),
    { key: "US", label: "United States" },
    { key: "US-New York", label: "New York City" },
  ];
}

export function cleanSponsorName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function sponsorScopeKey(raw: unknown): string | null {
  const key = typeof raw === "string" ? raw.trim() : "";
  return sponsorScopes().some((scope) => scope.key === key) ? key : null;
}

export function sponsorNote(method: PayMethod, name: string, scope: string): string {
  return receiptNote(method, `Sponsor line: ${name}. Sponsor scope: ${scope}`);
}

/** Lines saved before a scope was collected are read on the world briefing only. */
export function parseSponsorNote(note: string | null | undefined): { name: string; scope: string } | null {
  if (!note) return null;
  const nameMatch = note.match(/Sponsor line:\s*(.+?)(?:\.\s*Sponsor scope:|$)/i);
  const name = nameMatch?.[1]?.replace(/\s+/g, " ").trim().replace(/\.$/, "").slice(0, 80);
  if (!name) return null;
  const scopeMatch = note.match(/Sponsor scope:\s*([A-Za-z0-9:_-]+)/);
  const scope = scopeMatch?.[1] && sponsorScopeKey(scopeMatch[1]) ? scopeMatch[1] : "world";
  return { name, scope };
}

export function activeSponsorName(
  rows: Array<{ note: string | null; created_at: string }>,
  scopeKey: string,
  now = Date.now(),
): string | null {
  const fresh = rows
    .filter((row) => {
      const at = Date.parse(row.created_at);
      return Number.isFinite(at) && now - at <= SPONSOR_DAY_MS && now >= at;
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const row of fresh) {
    const parsed = parseSponsorNote(row.note);
    if (parsed && parsed.scope === scopeKey) return parsed.name;
  }
  return null;
}
