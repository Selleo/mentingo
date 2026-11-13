import type { QuizGradingRepository } from "./quiz-grading.repository";
import type { QuizGradingStatus } from "./quiz-grading.schema";
import type { InferInsertModel } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type {
  assessmentAttemptQuestionAnswerReviews,
  assessmentAttempts,
} from "src/storage/schema";

export type QuizGradingAnswerFilters = {
  status?: QuizGradingStatus;
  courseId?: UUIDType;
  lessonId?: UUIDType;
  studentId?: UUIDType;
};

export type QuizAnswerForGrading = NonNullable<
  Awaited<ReturnType<QuizGradingRepository["findAnswerForGrading"]>>
>;

export type QuizAnswerReviewInsert = InferInsertModel<
  typeof assessmentAttemptQuestionAnswerReviews
>;

export type QuizGradedAttemptUpdate = Pick<
  InferInsertModel<typeof assessmentAttempts>,
  "gradingStatus" | "result" | "awardedPoints" | "scorePercentage" | "gradedAt"
>;
