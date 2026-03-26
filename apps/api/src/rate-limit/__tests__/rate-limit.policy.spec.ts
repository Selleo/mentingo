import { RATE_LIMITS, RATE_LIMIT_WINDOW_SEC } from "src/rate-limit/rate-limit.constants";
import { resolveRateLimitPolicy } from "src/rate-limit/rate-limit.utils";

describe("resolveRateLimitPolicy", () => {
  it("returns strict policy for login", () => {
    const policy = resolveRateLimitPolicy("POST", "/api/auth/login");

    expect(policy).toEqual({
      key: "auth.strict.5",
      limit: RATE_LIMITS.AUTH_SENSITIVE_ENDPOINTS_REQUESTS_PER_MINUTE,
      windowSec: RATE_LIMIT_WINDOW_SEC,
    });
  });

  it("returns integration read policy for integration GET routes", () => {
    const policy = resolveRateLimitPolicy("GET", "/api/integration/groups");

    expect(policy).toEqual({
      key: "integration.read",
      limit: RATE_LIMITS.INTEGRATION_READ_REQUESTS_PER_MINUTE,
      windowSec: RATE_LIMIT_WINDOW_SEC,
    });
  });

  it("returns integration write policy for integration mutating routes", () => {
    const policy = resolveRateLimitPolicy("PATCH", "/api/integration/users/123");

    expect(policy).toEqual({
      key: "integration.write",
      limit: RATE_LIMITS.INTEGRATION_WRITE_REQUESTS_PER_MINUTE,
      windowSec: RATE_LIMIT_WINDOW_SEC,
    });
  });

  it("returns general GET policy for non-special routes", () => {
    const policy = resolveRateLimitPolicy("GET", "/api/course");

    expect(policy).toEqual({
      key: "general.get",
      limit: RATE_LIMITS.GENERAL_GET_REQUESTS_PER_MINUTE,
      windowSec: RATE_LIMIT_WINDOW_SEC,
    });
  });

  it("returns null for technical routes", () => {
    expect(resolveRateLimitPolicy("GET", "/api/healthcheck")).toBeNull();
    expect(resolveRateLimitPolicy("GET", "/api/integration-json")).toBeNull();
  });
});
