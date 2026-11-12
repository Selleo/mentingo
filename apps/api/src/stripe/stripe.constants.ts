/** Largest page Stripe returns from a list call. */
export const STRIPE_LIST_PAGE_SIZE = 100;

export const MAX_LISTED_PROMOTION_CODES = 10_000;

export const PROMOTION_CODES_MAX_PAGE_SIZE = 100;

/** Keeps paging and search typing from re-reading every code from Stripe on each request. */
export const PROMOTION_CODES_CACHE_TTL_MS = 60 * 1000;

export const PROMOTION_CODES_CACHE_PREFIX = "stripe:promotion-codes:";
