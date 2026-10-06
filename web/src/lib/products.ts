/** Newsxis SKUs. Prices live in the Wallet catalog (ApixisWallet/lib/catalog.ts); these mirror them for the UI. 100 Ixis = $1. */
export const NEWSXIS_PRODUCTS = {
  "newsxis.activate": { name: "Reporter activation", ixis: 1000, days: null },
  "newsxis.reporter.monthly": { name: "Reporter seat (30 days)", ixis: 1000, days: 30 },
  "newsxis.boost.story": { name: "Pin a story to its city for 24h", ixis: 500, days: null },
} as const;
export type NewsxisProduct = keyof typeof NEWSXIS_PRODUCTS;
