import { describe, expect, it } from "vitest";

import { makeQuizLessonFormValues } from "../testFactories";

import { FEEDBACK_RANGE_VALIDATION_KEYS } from "./feedbackRanges";
import { quizLessonFormSchema } from "./quizLessonFormSchema";

// The schema surfaces i18n keys as messages, so the identity `t` keeps assertions readable.
const schema = quizLessonFormSchema((key) => key);

describe("quizLessonFormSchema feedback", () => {
  it("accepts the default three feedback buckets", () => {
    expect(schema.safeParse(makeQuizLessonFormValues()).success).toBe(true);
  });

  it("rejects feedback ranges that leave a gap", () => {
    const result = schema.safeParse(
      makeQuizLessonFormValues({
        feedbackRanges: [
          { minPercent: 0, maxPercent: 40, message: "" },
          { minPercent: 50, maxPercent: 100, message: "" },
        ],
      }),
    );

    expect(result.success).toBe(false);

    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);

    expect(messages).toContain(FEEDBACK_RANGE_VALIDATION_KEYS.gapOrOverlap);
  });

  it("accepts an empty feedback-range set", () => {
    expect(schema.safeParse(makeQuizLessonFormValues({ feedbackRanges: [] })).success).toBe(true);
  });

  it("rejects an unknown feedback mode", () => {
    const result = schema.safeParse(
      makeQuizLessonFormValues({
        // @ts-expect-error - exercising runtime rejection of an out-of-enum value
        feedbackMode: "verbose",
      }),
    );

    expect(result.success).toBe(false);
  });
});
