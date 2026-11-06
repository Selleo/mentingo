import { applyFormats } from "nestjs-typebox";
import { createClient } from "redis";

import { RATE_LIMIT_STORAGE_KEY_PREFIX } from "../src/rate-limit/redis-throttler.storage";
import { setupValidation } from "../src/utils/setup-validation";

import { TEST_REDIS_URL } from "./test-database";

const originalLog = console.log;

// Custom log filter function - filter only PostgreSQL NOTICE logs
const filteredLog = (...args: any[]) => {
  if (
    args.some(
      (arg) =>
        typeof arg === "object" &&
        arg !== null &&
        (arg.severity_local === "WARNING" || arg.severity === "NOTICE"),
    )
  ) {
    return;
  }

  originalLog(...args);
};

const rateLimitRedis = createClient({ url: TEST_REDIS_URL });

const resetRateLimits = async () => {
  const keys: string[] = [];
  for await (const key of rateLimitRedis.scanIterator({
    MATCH: `${RATE_LIMIT_STORAGE_KEY_PREFIX}:*`,
  })) {
    keys.push(key);
  }

  if (keys.length) await rateLimitRedis.del(keys);
};

beforeAll(async () => {
  applyFormats();
  setupValidation();
  jest.spyOn(console, "log").mockImplementation(filteredLog);
  await rateLimitRedis.connect();
});

beforeEach(async () => {
  await resetRateLimits();
});

afterAll(async () => {
  jest.restoreAllMocks();
  await rateLimitRedis.quit();
});
