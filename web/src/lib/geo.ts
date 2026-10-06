/** Small geo helpers: distance, region groups, scope keys for briefings and social accounts. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371, d2r = Math.PI / 180;
  const dLat = (bLat - aLat) * d2r, dLng = (bLng - aLng) * d2r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * d2r) * Math.cos(bLat * d2r) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** Phase-1 regions and the ISO country codes in them. */
export const REGIONS: Record<string, { name: string; countries: string[]; center: [number, number]; zoom: number }> = {
  ME: { name: "Middle East", countries: ["IL", "PS", "LB", "SY", "IQ", "IR", "JO", "SA", "YE", "AE", "QA", "KW", "BH", "OM", "TR", "EG"], center: [40, 30], zoom: 3.5 },
  EU: { name: "Europe", countries: ["GB", "FR", "DE", "ES", "IT", "NL", "BE", "PL", "UA", "RU", "SE", "NO", "DK", "FI", "AT", "CH", "PT", "GR", "RO", "HU", "CZ", "IE"], center: [12, 50], zoom: 3.4 },
  AF: { name: "Africa", countries: ["NG", "ET", "EG", "CD", "ZA", "KE", "SD", "SS", "SO", "ML", "NE", "BF", "GH", "SN", "TZ", "UG", "MZ", "LY", "TN", "DZ", "MA"], center: [20, 2], zoom: 2.8 },
  NA: { name: "North America", countries: ["US", "CA", "MX"], center: [-98, 40], zoom: 3 },
  AS: { name: "Asia", countries: ["CN", "JP", "KR", "KP", "IN", "PK", "AF", "BD", "ID", "PH", "VN", "TH", "MM", "TW"], center: [100, 30], zoom: 2.8 },
  SA: { name: "South America", countries: ["BR", "AR", "CO", "VE", "PE", "CL", "EC", "BO"], center: [-60, -15], zoom: 2.8 },
  OC: { name: "Oceania", countries: ["AU", "NZ", "PG"], center: [140, -25], zoom: 3 },
};

export function regionOf(country: string | null | undefined): string | null {
  if (!country) return null;
  for (const [key, r] of Object.entries(REGIONS)) if (r.countries.includes(country.toUpperCase())) return key;
  return null;
}

/** Briefing / social scope keys. */
export function scopeKeys(s: { country?: string | null; region?: string | null; city?: string | null }): string[] {
  const keys = ["world"];
  if (s.country) keys.push(s.country.toUpperCase());
  if (s.country && s.region) keys.push(`${s.country.toUpperCase()}-${s.region}`);
  if (s.country && s.city) keys.push(`${s.country.toUpperCase()}-${s.city}`);
  const reg = regionOf(s.country);
  if (reg) keys.push(`region:${reg}`);
  return keys;
}

export const PHASE1_CITIES: Array<{ name: string; country: string; region?: string; lat: number; lng: number; lang: string }> = [
  { name: "New York", country: "US", region: "NY", lat: 40.7128, lng: -74.006, lang: "en" },
  { name: "Chicago", country: "US", region: "IL", lat: 41.8781, lng: -87.6298, lang: "en" },
  { name: "Los Angeles", country: "US", region: "CA", lat: 34.0522, lng: -118.2437, lang: "en" },
  { name: "Washington", country: "US", region: "DC", lat: 38.9072, lng: -77.0369, lang: "en" },
  { name: "London", country: "GB", lat: 51.5074, lng: -0.1278, lang: "en" },
  { name: "Paris", country: "FR", lat: 48.8566, lng: 2.3522, lang: "fr" },
  { name: "Berlin", country: "DE", lat: 52.52, lng: 13.405, lang: "de" },
  { name: "Madrid", country: "ES", lat: 40.4168, lng: -3.7038, lang: "es" },
  { name: "Kyiv", country: "UA", lat: 50.4501, lng: 30.5234, lang: "uk" },
  { name: "Jerusalem", country: "IL", lat: 31.7683, lng: 35.2137, lang: "he" },
  { name: "Gaza", country: "PS", lat: 31.5017, lng: 34.4668, lang: "ar" },
  { name: "Beirut", country: "LB", lat: 33.8938, lng: 35.5018, lang: "ar" },
  { name: "Tehran", country: "IR", lat: 35.6892, lng: 51.389, lang: "fa" },
  { name: "Baghdad", country: "IQ", lat: 33.3152, lng: 44.3661, lang: "ar" },
  { name: "Riyadh", country: "SA", lat: 24.7136, lng: 46.6753, lang: "ar" },
  { name: "Cairo", country: "EG", lat: 30.0444, lng: 31.2357, lang: "ar" },
  { name: "Khartoum", country: "SD", lat: 15.5007, lng: 32.5599, lang: "ar" },
  { name: "Lagos", country: "NG", lat: 6.5244, lng: 3.3792, lang: "en" },
  { name: "Nairobi", country: "KE", lat: -1.2921, lng: 36.8219, lang: "en" },
  { name: "Johannesburg", country: "ZA", lat: -26.2041, lng: 28.0473, lang: "en" },
  { name: "Mexico City", country: "MX", lat: 19.4326, lng: -99.1332, lang: "es" },
  { name: "São Paulo", country: "BR", lat: -23.5505, lng: -46.6333, lang: "pt" },
  { name: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503, lang: "ja" },
  { name: "Delhi", country: "IN", lat: 28.6139, lng: 77.209, lang: "hi" },
  { name: "Sydney", country: "AU", lat: -33.8688, lng: 151.2093, lang: "en" },
];

/** Language Cixy should speak for a place (owner: "whatever language is common there"). */
export function langForPlace(country: string | null | undefined, fallback = "en"): string {
  const map: Record<string, string> = { US: "en", GB: "en", CA: "en", AU: "en", NZ: "en", IE: "en", NG: "en", KE: "en", ZA: "en", IN: "en",
    ES: "es", MX: "es", AR: "es", CO: "es", PE: "es", CL: "es", VE: "es", EC: "es", BO: "es",
    FR: "fr", DE: "de", IT: "it", PT: "pt", BR: "pt", NL: "nl", PL: "pl", UA: "uk", RU: "ru", TR: "tr", JP: "ja", KR: "ko", CN: "zh",
    SA: "ar", EG: "ar", IQ: "ar", SY: "ar", LB: "ar", JO: "ar", AE: "ar", QA: "ar", KW: "ar", YE: "ar", PS: "ar", SD: "ar", LY: "ar", DZ: "ar", MA: "ar", TN: "ar",
    IL: "he", IR: "fa", AF: "fa", PK: "ur" };
  return (country && map[country.toUpperCase()]) || fallback;
}
