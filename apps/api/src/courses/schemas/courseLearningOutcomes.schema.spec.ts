import { MAX_COURSE_LEARNING_OUTCOMES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { baseCourseSchema } from "./createCourse.schema";
import { updateCourseSchema } from "./updateCourse.schema";

describe("course learning outcomes schemas", () => {
  it("accepts at most five learning outcomes when creating or updating a course", () => {
    const outcomes = Array.from(
      { length: MAX_COURSE_LEARNING_OUTCOMES },
      (_, index) => `Outcome ${index + 1}`,
    );
    const tooManyOutcomes = [...outcomes, "One too many"];

    expect(Value.Check(baseCourseSchema.properties.learningOutcomes, outcomes)).toBe(true);
    expect(Value.Check(baseCourseSchema.properties.learningOutcomes, tooManyOutcomes)).toBe(false);
    expect(Value.Check(updateCourseSchema.properties.learningOutcomes, outcomes)).toBe(true);
    expect(Value.Check(updateCourseSchema.properties.learningOutcomes, tooManyOutcomes)).toBe(
      false,
    );
  });
});
