import { MAX_COURSE_LEARNING_OUTCOMES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

export const courseLearningOutcomesSchema = Type.Array(Type.String(), {
  maxItems: MAX_COURSE_LEARNING_OUTCOMES,
});
