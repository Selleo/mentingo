import { flattenFilterConditions, getReferencedRecordIds } from "../utils/reports-filter.utils";

import type { ReportsQuery } from "../schemas/reports.schema";

const groupId = "11111111-1111-4111-8111-111111111111";
const otherGroupId = "22222222-2222-4222-8222-222222222222";
const courseId = "33333333-3333-4333-8333-333333333333";
const learnerId = "44444444-4444-4444-8444-444444444444";

const baseQuery: ReportsQuery = {
  view: "organisation",
  language: "en",
  timezone: "UTC",
  groupIds: [groupId],
  page: 1,
  pageSize: 25,
};

describe("reports filter utils", () => {
  it("flattens nested condition groups into one list", () => {
    const conditions = flattenFilterConditions({
      match: "all",
      rules: [
        { field: "status", operator: "eq", value: "completed" },
        { match: "any", rules: [{ field: "score", operator: "gte", value: 80 }] },
      ],
    });

    expect(conditions.map(({ field }) => field)).toEqual(["status", "score"]);
    expect(flattenFilterConditions(undefined)).toEqual([]);
  });

  it("collects the records a query names without duplicates", () => {
    const references = getReferencedRecordIds({
      ...baseQuery,
      filter: {
        match: "all",
        rules: [
          { field: "groupId", operator: "in", value: [groupId, otherGroupId] },
          { field: "courseId", operator: "neq", value: courseId },
          {
            match: "any",
            rules: [{ field: "learner", operator: "in", value: [learnerId, "Mina"] }],
          },
        ],
      },
    });

    expect(references).toEqual({
      groupIds: [groupId, otherGroupId],
      courseIds: [courseId],
      pathIds: [],
      learnerIds: [learnerId],
    });
  });

  it("ignores conditions that do not point at specific records", () => {
    const references = getReferencedRecordIds({
      ...baseQuery,
      groupIds: [],
      filter: {
        match: "all",
        rules: [
          { field: "courseId", operator: "isEmpty" },
          { field: "learner", operator: "contains", value: learnerId },
        ],
      },
    });

    expect(references).toEqual({ groupIds: [], courseIds: [], pathIds: [], learnerIds: [] });
  });
});
