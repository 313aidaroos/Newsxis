// Two clients: RLS-scoped (the signed-in person) and service-role (server-only, trusted code).
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
}

export function serviceConfigured() {
  return supabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY);
}

export async function supabaseUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) throw new Error("Supabase is not configured.");
  const store = await cookies();
  const handlers: CookieMethodsServer = {
    getAll: () => store.getAll(),
    setAll: (list) => {
      try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only context */ }
    },
  };
  return createServerClient(url, anon, { cookies: handlers });
}

/** Bypasses RLS. Only inside trusted server code (cron, worker, admin). */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase service role is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The signed-in auth user, or null. Never throws. */
export async function currentUser() {
  if (!supabaseConfigured()) return null;
  try {
    const sb = await supabaseUser();
    const { data } = await sb.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

/** Signed-in user + profile row. */
export async function currentProfile() {
  const user = await currentUser();
  if (!user) return { user: null, profile: null };
  try {
    const sb = await supabaseUser();
    const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return { user, profile: (data as Profile | null) ?? null };
  } catch {
    return { user, profile: null };
  }
}

export type Profile = {
  id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string | null;
  apixis_sub: string | null; home_place: string | null; home_country: string | null; home_region: string | null; home_city: string | null;
  home_lat: number | null; home_lng: number | null; lang: string; show_graphic_media: boolean; alerts_push: boolean; alerts_email: boolean;
  alert_min_severity: number; reporter_points: number; verified_reporter: boolean; reporter_active_until: string | null;
  activated_at: string | null; is_owner: boolean; banned: boolean; age_confirmed_at: string | null; age_blocked: boolean;
  created_at: string; updated_at: string;
};
