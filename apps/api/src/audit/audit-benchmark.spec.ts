import { buildAuditBenchmark } from "./audit-benchmark";

import type { AuditBenchmarkSubmission } from "./audit.types";

const CURRENT_TENANT_ID = "242359db-654d-4af2-93ee-71ac0ddb4d9f";

const submission = (
  tenantId: string,
  name: string,
  score: number,
  submissionOrder = 1,
): AuditBenchmarkSubmission => ({
  tenantId,
  name,
  score,
  submissionOrder,
});

describe("buildAuditBenchmark", () => {
  it("calculates ranking, average, improvement, and nearby comparisons", () => {
    const result = buildAuditBenchmark(
      [
        submission("11111111-1111-4111-8111-111111111111", "Northfield", 90),
        submission("22222222-2222-4222-8222-222222222222", "St Mary's", 80),
        submission(CURRENT_TENANT_ID, "Riverside", 70),
        submission(CURRENT_TENANT_ID, "Riverside", 60, 2),
        submission("33333333-3333-4333-8333-333333333333", "Greenwood", 60),
        submission("44444444-4444-4444-8444-444444444444", "Oaklands", 50),
        submission("55555555-5555-4555-8555-555555555555", "Westfield", 40),
      ],
      CURRENT_TENANT_ID,
    );

    expect(result).toMatchObject({
      currentScore: 70,
      averageScore: 65,
      improvement: 10,
      rank: 3,
      participantCount: 6,
    });
    expect(result.comparisons).toHaveLength(5);
    expect(result.comparisons.map(({ name }) => name)).toEqual([
      "Northfield",
      "St Mary's",
      "Riverside",
      "Greenwood",
      "Oaklands",
    ]);
  });

  it("uses competition ranking for tied scores", () => {
    const result = buildAuditBenchmark(
      [
        submission("11111111-1111-4111-8111-111111111111", "Northfield", 80),
        submission("22222222-2222-4222-8222-222222222222", "St Mary's", 80),
        submission(CURRENT_TENANT_ID, "Riverside", 70),
      ],
      CURRENT_TENANT_ID,
    );

    expect(result.rank).toBe(3);
    expect(result.comparisons.map(({ rank }) => rank)).toEqual([1, 1, 3]);
  });

  it("returns an empty current-school result when the tenant has no submission", () => {
    const result = buildAuditBenchmark(
      [submission("11111111-1111-4111-8111-111111111111", "Northfield", 80)],
      CURRENT_TENANT_ID,
    );

    expect(result).toMatchObject({
      currentScore: null,
      improvement: null,
      rank: null,
      participantCount: 1,
      comparisons: [],
    });
  });
});
