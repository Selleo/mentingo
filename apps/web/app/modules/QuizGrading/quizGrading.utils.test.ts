import { QUIZ_REVIEW_GRADING_METHODS } from "@repo/shared";

import {
  gradeAnswerFormSchema,
  isQuizGradingStatus,
  isUuid,
  reviewVerdict,
} from "./quizGrading.utils";

import type { TFunction } from "i18next";

const t = ((key: string) => key) as unknown as TFunction;

const COURSE_ID = "8f0c2a4e-1b7d-4c3a-9e5f-2d6b8a1c3e70";

describe("isQuizGradingStatus", () => {
  it.each(["pending", "graded"])("accepts %s", (status) => {
    expect(isQuizGradingStatus(status)).toBe(true);
  });

  it.each([undefined, "", "unknown"])("rejects %s", (status) => {
    expect(isQuizGradingStatus(status)).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts filter ids that are UUIDs and rejects anything else", () => {
    expect(isUuid(COURSE_ID)).toBe(true);
    expect(isUuid("abc")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});

describe("gradeAnswerFormSchema", () => {
  const schema = gradeAnswerFormSchema(t);

  it.each(["passed", "failed"])("accepts the %s verdict", (verdict) => {
    expect(schema.safeParse({ verdict, comment: "" }).success).toBe(true);
  });

  it.each([undefined, "", "1"])("rejects a missing or unknown verdict: %s", (verdict) => {
    expect(schema.safeParse({ verdict, comment: "" }).success).toBe(false);
  });

  it("rejects comments over the limit", () => {
    expect(schema.safeParse({ verdict: "passed", comment: "a".repeat(5001) }).success).toBe(false);
  });
});

describe("reviewVerdict", () => {
  it("reads pass/fail from the stored points, whatever the question is worth now", () => {
    const method = QUIZ_REVIEW_GRADING_METHODS.PASS_FAIL;

    expect(reviewVerdict({ method, awardedPoints: 1.5 })).toBe("passed");
    expect(reviewVerdict({ method, awardedPoints: 0 })).toBe("failed");
  });
});
