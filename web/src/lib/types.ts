export type StoryCategory =
  | "war" | "attack" | "assassination" | "terror" | "disaster" | "weather" | "earthquake" | "crime" | "politics"
  | "government" | "economy" | "strike" | "health" | "tech" | "science" | "sports" | "culture" | "local" | "other";

export type Story = {
  id: string; slug: string; headline: string; summary: string; body: string | null; lang: string;
  status: "pending" | "live" | "held" | "removed"; category: StoryCategory; severity: number; breaking: boolean;
  confirmed: boolean; disputed: boolean; confirmations: number; confidence: number;
  country: string | null; region: string | null; city: string | null; county: string | null; place_name: string | null;
  lat: number | null; lng: number | null; source_id: string | null; source_url: string | null; source_quote: string | null;
  author_id: string | null; ai_label: string; image_url: string | null; media: Array<{ url: string; kind: string; graphic?: boolean }>;
  graphic: boolean; pinned_until: string | null; event_started_at: string | null; published_at: string; updated_at: string; created_at: string;
};

export type StoryThread = {
  id: string; story_id: string; kind: "research" | "another_side" | "update" | "correction" | "context" | "cixy_note";
  body: string; sources: Array<{ url: string; title?: string; publisher?: string }>; ai_label: string; created_at: string;
};

export type StorySource = { id: string; story_id: string; url: string | null; title: string | null; publisher: string | null; stance: "confirms" | "disputes" | "context" | "origin"; quote: string | null; created_at: string };

export type Source = {
  id: string; kind: "radio" | "scanner" | "rss" | "gdelt" | "gov" | "user" | "social"; name: string; slug: string | null; url: string | null;
  stream_url: string | null; lang: string; country: string | null; region: string | null; city: string | null; county: string | null;
  lat: number | null; lng: number | null; active: boolean; allows_transcript: boolean; licensed: boolean; poll_seconds: number;
  last_polled_at: string | null; last_ok_at: string | null; last_error: string | null; meta: Record<string, unknown>; created_at: string;
};

export type Briefing = {
  id: string; scope: "world" | "country" | "region" | "city"; scope_key: string; lang: string; kind: "hourly" | "regional" | "breaking" | "recap";
  title: string; script: string; audio_url: string | null; duration_s: number | null; story_ids: string[]; sponsor: string | null; created_at: string;
};

export type Post = {
  id: string; author_id: string; body: string; media: Array<{ url: string; kind: string; graphic?: boolean }>; kind: "text" | "photo" | "video" | "voice" | "live";
  lang: string; status: "pending" | "live" | "held" | "removed"; moderation: Record<string, unknown>; place_name: string | null;
  country: string | null; region: string | null; city: string | null; county: string | null; lat: number | null; lng: number | null;
  story_id: string | null; likes: number; comments: number; created_at: string;
  author?: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; verified_reporter: boolean } | null;
};

export const CATEGORY_LABEL: Record<StoryCategory, string> = {
  war: "War", attack: "Attack", assassination: "Assassination", terror: "Terror", disaster: "Disaster", weather: "Weather",
  earthquake: "Earthquake", crime: "Crime", politics: "Politics", government: "Government", economy: "Economy", strike: "Strike",
  health: "Health", tech: "Tech", science: "Science", sports: "Sports", culture: "Culture", local: "Local", other: "News",
};

export const SEVERITY_LABEL = ["", "Minor", "Notable", "Major", "Critical", "Breaking"] as const;

/** Severity → map/feed color token. */
export function severityColor(s: number) {
  return s >= 5 ? "var(--nx-breaking)" : s === 4 ? "var(--nx-critical)" : s === 3 ? "var(--nx-major)" : "var(--nx-accent)";
}
