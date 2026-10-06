import { NextResponse } from "next/server";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
export const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => json({ ok: false, error, ...extra }, status);

/** Vercel Cron sends `authorization: Bearer $CRON_SECRET`; workers send `x-worker-key`. */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret;
}
export function workerAuthorized(request: Request): boolean {
  const key = process.env.WORKER_KEY;
  return Boolean(key && key.length >= 16 && request.headers.get("x-worker-key") === key);
}
export function siteUrl(request?: Request): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? (request ? new URL(request.url).origin : "http://localhost:3000")).replace(/\/$/, "");
}
