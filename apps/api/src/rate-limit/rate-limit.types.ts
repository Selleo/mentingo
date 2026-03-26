export type RateLimitPolicy = {
  limit: number;
  windowSec: number;
};

export type ResolvedRateLimitPolicy = RateLimitPolicy & {
  key: string;
};

export type ThrottleResult = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};
