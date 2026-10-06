import Link from "next/link";
import { CATEGORY_LABEL, type Story } from "@/lib/types";

export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = Math.max(1, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function SeverityChip({ s }: { s: Pick<Story, "severity" | "category"> }) {
  const label = s.severity >= 5 ? "BREAKING" : s.severity === 4 ? "CRITICAL" : s.severity === 3 ? "MAJOR" : CATEGORY_LABEL[s.category] ?? "News";
  return <span className={`nx-chip ${s.severity >= 3 ? `nx-chip-sev${s.severity}` : ""}`}>{label}</span>;
}

export function StatusChip({ s }: { s: Pick<Story, "confirmed" | "disputed" | "confirmations"> }) {
  if (s.disputed) return <span className="nx-chip nx-chip-warn">Disputed</span>;
  if (s.confirmed) return <span className="nx-chip nx-chip-ok">Confirmed · {s.confirmations} sources</span>;
  return <span className="nx-chip">Unconfirmed</span>;
}

export function StoryCard({ s, compact, onFocus }: { s: Story; compact?: boolean; onFocus?: (s: Story) => void }) {
  const place = [s.place_name ?? s.city, s.region, s.country].filter(Boolean).join(", ");
  return (
    <article className={`nx-story nx-story-sev${s.severity}`} onMouseEnter={onFocus ? () => onFocus(s) : undefined}>
      <div className="nx-story-meta">
        <SeverityChip s={s} />
        {s.severity < 3 && <span className="nx-chip">{CATEGORY_LABEL[s.category]}</span>}
        <StatusChip s={s} />
        <span>{ago(s.published_at)}</span>
        {place && <span>· {place}</span>}
      </div>
      <h3><Link href={`/story/${s.slug}`}>{s.headline}</Link></h3>
      {!compact && <p>{s.summary}</p>}
      <div className="nx-story-foot">
        <span className="nx-chip nx-chip-ai" title="Every Cixy story is AI-generated from a named source">AI · {s.ai_label.replace("Written by Cixy from ", "")}</span>
        {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer">Source ↗</a>}
        {s.lat !== null && s.lng !== null && <Link href={`/?lat=${s.lat}&lng=${s.lng}&z=9&story=${s.slug}`}>On the globe</Link>}
      </div>
    </article>
  );
}
