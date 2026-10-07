/**
 * Newsxis SKUs. Prices live in the Wallet catalog; these mirror them for the UI.
 * 100 Ixis = $1. lookupKey is the family billing-plan name (`<product>_<tier>_<kind>`).
 * The dotted key is the alias the current Wallet redeem path still uses.
 */
export const NEWSXIS_PRODUCTS = {
  "newsxis.activate": {
    name: "Reporter activation",
    ixis: 1000,
    usd: 10,
    days: null,
    lookupKey: "newsxis_reporter_activation",
    kind: "activation",
  },
  "newsxis.reporter.monthly": {
    name: "Reporter seat",
    ixis: 1000,
    usd: 10,
    days: 30,
    lookupKey: "newsxis_reporter_monthly",
    kind: "monthly",
  },
  "newsxis.boost.story": {
    name: "Pin a story to its city for 24h",
    ixis: 500,
    usd: 5,
    days: null,
    lookupKey: "newsxis_boost_story_onetime",
    kind: "onetime",
  },
  "newsxis.sponsor.briefing": {
    name: "This briefing is brought to you by… (1 day, 1 region)",
    ixis: 5000,
    usd: 50,
    days: 1,
    lookupKey: "newsxis_sponsor_briefing_onetime",
    kind: "onetime",
  },
} as const;

export type NewsxisProduct = keyof typeof NEWSXIS_PRODUCTS;

/** Activation plus the auto-renewing monthly seat. Charged together at checkout. */
export const REPORTER_CHECKOUT_KEYS = [
  NEWSXIS_PRODUCTS["newsxis.activate"].lookupKey,
  NEWSXIS_PRODUCTS["newsxis.reporter.monthly"].lookupKey,
] as const;

export const NEWSXIS_BILLING_PRODUCT = "newsxis";
