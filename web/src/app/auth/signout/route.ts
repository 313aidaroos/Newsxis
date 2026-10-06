import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (supabaseConfigured()) { try { await (await supabaseUser()).auth.signOut(); } catch { /* already out */ } }
  return NextResponse.redirect(new URL("/", request.url), 303);
}
