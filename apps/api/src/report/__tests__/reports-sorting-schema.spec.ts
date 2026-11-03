import { Value } from "@sinclair/typebox/value";

import { reportsQuerySchema } from "../schemas/reports.schema";

const query = {
  view: "organisation",
  timezone: "UTC",
  groupIds: [],
  language: "en",
  page: 1,
  pageSize: 25,
};

it("accepts optional whitelisted report sorting and rejects arbitrary SQL identifiers/directions", () => {
  expect(Value.Check(reportsQuerySchema, query)).toBe(true);
  for (const sortBy of [
    "learner",
    "course",
    "path",
    "status",
    "progress",
    "score",
    "attempts",
    "lastActivity",
  ]) {
    for (const sortDirection of ["asc", "desc"]) {
      expect(Value.Check(reportsQuerySchema, { ...query, sortBy, sortDirection })).toBe(true);
    }
  }
  expect(Value.Check(reportsQuerySchema, { ...query, sortBy: "learner; DROP TABLE users" })).toBe(
    false,
  );
  expect(Value.Check(reportsQuerySchema, { ...query, sortDirection: "DESC NULLS FIRST" })).toBe(
    false,
  );
});
