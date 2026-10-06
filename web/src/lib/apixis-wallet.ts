/**
 * Apixis Wallet — shared server-side client for sister sites.
 *
 * Copy this ONE file into your repo (lib/apixis-wallet.ts). Do not fork the logic.
 * Runs on the SERVER only (Route Handler / Server Action). Never import from a
 * client component: it reads WALLET_API_KEY, which must never reach a browser.
 *
 * Env (already set on every family Vercel project):
 *   WALLET_API_KEY          this site's own Wallet API key (`apx_live_…`, scoped to your app).
 *                           Legacy: the Wallet service key still works until the Wallet turns it off.
 *   APIXIS_WALLET_API_URL   https://apixis-wallet.vercel.app
 *   APIXIS_CLIENT_ID        this site's Apixis ID client name (e.g. "renoxis") — for "Sign in with Apixis"
 *
 * SDK version: 3.1 (2026-09-30: marketplace orders). Replace older copies with this file.
 *
 * WHO a call is about (`owner` below): pass the Apixis ID `sub` (a Wallet user id, from
 * exchangeLoginCode) — preferred — or, until your site uses Apixis ID, the user's VERIFIED email.
 *
 * Rules this client enforces so you don't have to remember them:
 *   - Wallet is the single source of truth for what a user owns. Read entitlements
 *     from here; never author your own authoritative balance or ownership.
 *   - Every redeem = quote → reserve → (you provision) → capture, or release on ANY
 *     failure. `redeem()` does that dance for you and never leaves a hold dangling.
 *   - Identity is the Apixis ID `sub` (Wallet user id). Email only as a fallback; never your own
 *     site's Supabase uid (uids differ per project).
 *   - Idempotency keys are stable per attempt: retrying the same attempt is safe.
 *   - 402 is a normal outcome ("not enough Ixis"), not an error. Show a Buy Ixis link.
 *   - Never fake success. If the Wallet is unreachable, say so.
 */

const BASE = (process.env.APIXIS_WALLET_API_URL ?? "https://apixis-wallet.vercel.app").replace(/\/$/, "");
const KEY = process.env.WALLET_API_KEY ?? process.env.APIXIS_WALLET_API_KEY ?? "";

export type Quote = { quoteId: string; productKey: string; app: string; name: string; xp: number; usdEquivalent: number; expiresAt: string };
export type Reservation = { reservationId: string; status: "held"; productKey: string; app?: string; ixis: number };
export type ReservationStatus = {
  reservationId: string;
  /** held = open · expired = open past its hold time (will be released) · captured = charged · released = not charged */
  status: "held" | "expired" | "captured" | "released";
  app: string | null;
  productKey: string | null;
  ixis: number;
  holdExpiresAt: string | null;
  settledAt: string | null;
  receiptId: string | null;
};
export type Entitlement = {
  id: string;
  owner_id: string;
  app_slug: string;
  product_key: string;
  status: "active" | string;
  xp_price: number | null;
  renews_at: string | null;
  created_at: string;
};

/** Apixis ID `sub` (Wallet user id) or a verified email. */
export type Owner = string;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ownerFields(owner: Owner): { owner_id: string } | { owner_email: string } {
  const value = owner.trim();
  return UUID.test(value) ? { owner_id: value } : { owner_email: value };
}

function ownerQuery(owner: Owner) {
  const fields = ownerFields(owner);
  return "owner_id" in fields ? `owner_id=${encodeURIComponent(fields.owner_id)}` : `owner_email=${encodeURIComponent(fields.owner_email)}`;
}

export class WalletError extends Error {
  status: number;
  body?: unknown;
  /** Machine code from the Wallet, e.g. "insufficient_balance", "already_captured", "already_released", "conflict". */
  code?: string;
  // No parameter properties: sister sites run tests with node --experimental-strip-types,
  // which rejects that shorthand. Keep this file erasable-syntax only.
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    const maybe = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
    this.code = typeof maybe === "string" ? maybe : undefined;
  }
  /** Customer has fewer Ixis than the product costs. Show "Buy Ixis". */
  get insufficient() { return this.status === 402; }
}

export function isWalletConfigured(): boolean {
  return KEY.length > 20;
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!isWalletConfigured()) throw new WalletError(503, "Wallet not configured on this server (WALLET_API_KEY missing)");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const msg = typeof json === "object" && json !== null && typeof (json as { error?: unknown }).error === "string"
      ? (json as { error: string }).error
      : `Wallet ${res.status}`;
    throw new WalletError(res.status, msg, json);
  }
  return json as T;
}

/** Public price check. No auth needed. Use it to render prices from the one canonical catalog. */
export async function quote(productKey: string): Promise<Quote> {
  const res = await fetch(`${BASE}/api/v1/quotes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productKey }),
    cache: "no-store",
  });
  if (!res.ok) throw new WalletError(res.status, `Unknown product ${productKey}`);
  return res.json();
}

/**
 * Put a hold on the customer's Ixis. `owner` = the Apixis ID `sub` you stored at sign-in (or the
 * VERIFIED email from YOUR session). Never take it from the request body.
 */
export async function reserve(owner: Owner, productKey: string, idempotencyKey: string): Promise<Reservation> {
  return call("POST", "/api/v1/reservations", { productKey, idempotencyKey, ...ownerFields(owner) });
}

export async function capture(reservationId: string) {
  return call<{ reservationId: string; status: "captured"; receiptId: string }>("POST", `/api/v1/reservations/${reservationId}/capture`);
}

/**
 * Give the held Ixis back. Throws WalletError 409 with code "already_captured" if the hold was
 * captured — the customer WAS charged, so keep their access.
 */
export async function release(reservationId: string) {
  return call<{ reservationId: string; status: "released" }>("POST", `/api/v1/reservations/${reservationId}/release`);
}

/** Where a hold stands. Use it to reconcile after a timeout or crash. */
export async function reservationStatus(reservationId: string): Promise<ReservationStatus> {
  return call<ReservationStatus>("GET", `/api/v1/reservations/${reservationId}`);
}

// ---------------------------------------------------------------- marketplace orders (person → person)

export type MarketplaceOrder = { reservationId: string; status: "held"; app: string; ixis: number };
export type MarketplaceSettlement = {
  reservationId: string; status: "settled"; receiptId: string; payoutId: string | null;
  app: string; ixis: number; fee: number; feeBps: number; payout: number;
};

/**
 * Open a marketplace order: hold `amount` Ixis on the buyer until the seller delivers (up to
 * `holdDays`, default 14, max 30). `buyer` = the buyer's Apixis ID `sub` (or verified email).
 * Same rules as reserve(): stable idempotencyKey per order, 402 = "not enough Ixis".
 * Cancel with release(reservationId); the Wallet also releases it itself when the hold expires.
 */
export async function marketplaceOrder(opts: {
  buyer: Owner; amount: number; idempotencyKey: string; reference?: string; description?: string; holdDays?: number; app?: string;
}): Promise<MarketplaceOrder> {
  const { buyer, ...rest } = opts;
  const fields = ownerFields(buyer);
  return call("POST", "/api/v1/marketplace/orders", {
    ...rest,
    ...("owner_id" in fields ? { buyer_id: fields.owner_id } : { buyer_email: fields.owner_email }),
  });
}

/**
 * Settle a delivered order: the buyer's hold is captured and the seller is paid amount − fee
 * (family fee 5% unless you pass feeBps). Idempotent — retry the same call after a lost response.
 * A WalletError with code "payout_pending" means the buyer WAS charged and the seller payout must
 * be retried (call again with the same arguments); never refund the buyer on that code.
 */
export async function marketplaceSettle(reservationId: string, opts: { seller: Owner; feeBps?: number; description?: string }): Promise<MarketplaceSettlement> {
  const { seller, ...rest } = opts;
  const fields = ownerFields(seller);
  return call("POST", `/api/v1/marketplace/orders/${reservationId}/settle`, {
    ...rest,
    ...("owner_id" in fields ? { seller_id: fields.owner_id } : { seller_email: fields.owner_email }),
  });
}

/** What this user owns on your app. Wallet writes these on capture; you only read. */
export async function entitlements(owner: Owner, app: string): Promise<Entitlement[]> {
  const r = await call<{ entitlements: Entitlement[] }>("GET", `/api/v1/entitlements?app=${encodeURIComponent(app)}&${ownerQuery(owner)}`);
  return r.entitlements ?? [];
}

export async function hasEntitlement(owner: Owner, app: string, productKey: string): Promise<boolean> {
  const list = await entitlements(owner, app);
  return list.some((e) => e.product_key === productKey && e.status === "active");
}

/**
 * The whole redeem, done right:
 *   reserve → provision() → capture (retried once).
 *   provision() throws           → release, rethrow (nothing granted, nothing charged).
 *   capture fails after retry    → release: if the Wallet says "already_captured" the customer WAS
 *                                  charged → keep access, return ok. If the release succeeds the
 *                                  customer was NOT charged → unprovision(), rethrow.
 *                                  If even that is unknown (Wallet down) → rethrow WITHOUT
 *                                  unprovisioning; reconcile later with reservationStatus().
 * `provision` is YOUR side effect (create the subscription row, unlock the file, start the job).
 *
 * Returns { ok:true, receiptId } or { ok:false, insufficient:true } for the 402 case.
 */
export async function redeem<T>(opts: {
  /** Apixis ID `sub` (preferred) or the verified email from YOUR session. */
  owner?: Owner;
  /** @deprecated use `owner`. Kept so SDK v2 call sites keep working. */
  ownerEmail?: string;
  productKey: string;
  idempotencyKey: string;
  provision: (reservation: Reservation) => Promise<T>;
  /**
   * Undo what provision() did. Called only when the Wallet confirms the customer was NOT charged
   * (capture failed and the hold was released). Every site that writes access in provision() should pass it.
   */
  unprovision?: (reservation: Reservation, result: T) => Promise<void>;
}): Promise<{ ok: true; receiptId: string; result: T } | { ok: false; insufficient: true; needed: number; message: string }> {
  let held: Reservation;
  try {
    held = await reserve(opts.owner ?? opts.ownerEmail ?? "", opts.productKey, opts.idempotencyKey);
  } catch (e) {
    if (e instanceof WalletError && e.insufficient) {
      const q = await quote(opts.productKey).catch(() => null);
      return { ok: false, insufficient: true, needed: q?.xp ?? 0, message: e.message };
    }
    throw e;
  }

  let result: T;
  try {
    result = await opts.provision(held);
  } catch (e) {
    await release(held.reservationId).catch(() => { /* already settled or wallet down; the hold expires on its own */ });
    throw e;
  }

  let captureError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const cap = await capture(held.reservationId);
      return { ok: true, receiptId: cap.receiptId, result };
    } catch (e) {
      captureError = e;
      // A definite answer (4xx) will not change on retry.
      if (e instanceof WalletError && e.status >= 400 && e.status < 500) break;
    }
  }

  try {
    await release(held.reservationId);
  } catch (e) {
    if (e instanceof WalletError && e.code === "already_captured") {
      // The capture went through; only its response was lost. Charged → keep access.
      const status = await reservationStatus(held.reservationId).catch(() => null);
      return { ok: true, receiptId: status?.receiptId ?? "", result };
    }
    console.error("wallet: capture and release both failed; access kept, reconcile with reservationStatus()", {
      reservationId: held.reservationId,
    });
    throw captureError;
  }
  // Released → the customer was not charged → take the access back.
  if (opts.unprovision) {
    await opts.unprovision(held, result).catch((u) => console.error("wallet unprovision failed", u));
  }
  throw captureError;
}

// ---------------------------------------------------------------- shared wallet (balance inside your site)

export type WalletBalance = {
  currency: "Ixis";
  available: number;
  paid: number;
  bonus: number;
  reserved: number;
  usd: number;
  history: { id: string; kind: string; description: string; app: string | null; productKey: string | null; amount: number; createdAt: string }[];
};

/**
 * The person's ONE family balance, to show in your header / billing page. `history` = how many
 * recent receipts to include (your app's spends and their Ixis purchases only, max 50).
 * With a per-site key this only works for people who signed in to your site with Apixis ID.
 */
export async function walletBalance(owner: Owner, options: { history?: number } = {}): Promise<WalletBalance> {
  return call<WalletBalance>("GET", `/api/v1/balance?${ownerQuery(owner)}&history=${Math.max(0, Math.min(options.history ?? 0, 50))}`);
}

// ---------------------------------------------------------------- Apixis ID ("Sign in with Apixis")

/**
 * Where to send the browser to sign in. `state` = a random value you also put in an httpOnly cookie;
 * `redirectUri` must be registered for your client exactly (ask the Wallet lead).
 */
export function apixisLoginUrl(opts: { state: string; redirectUri: string; clientId?: string }): string {
  const clientId = opts.clientId ?? process.env.APIXIS_CLIENT_ID ?? "";
  const u = new URL(`${BASE}/sso/authorize`);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", opts.state);
  return u.toString();
}

/** Server-side, in your callback: trade the one-time `code` for who signed in. Single use. */
export async function exchangeLoginCode(code: string, redirectUri: string): Promise<{ sub: string; email: string; email_verified: true }> {
  return call("POST", "/api/sso/token", { code, redirect_uri: redirectUri });
}

// ---------------------------------------------------------------- buy Ixis

/**
 * "Buy Ixis" link: the Wallet sells a pack, then sends the person back to `returnUrl` on your site
 * (host must be on the Wallet allowlist) with the Ixis already in their balance.
 */
export function buyIxisUrl(product: string, returnUrl: string): string {
  const u = new URL(`${BASE}/buy`);
  u.searchParams.set("product", product);
  u.searchParams.set("return_url", returnUrl);
  return u.toString();
}
