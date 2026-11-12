import type { PgInsertValue } from "drizzle-orm/pg-core";
import type {
  AssessmentAttemptDraftAnswers,
  assessmentAttempts,
  assessmentAttemptQuestionAnswers,
  assessmentAttemptChoiceSelections,
  assessmentAttemptStatementAnswers,
  assessmentAttemptBlankAnswers,
  assessmentAttemptOpenTextAnswers,
  assessmentAttemptScaleSelections,
  assessmentAttemptMatchingAnswers,
} from "src/storage/schema";

// Allows SQL values such as a database-clock `expiresAt`.
export type QuizAttemptInsert = PgInsertValue<typeof assessmentAttempts>;
export type QuizAttemptQuestionAnswerInsert = typeof assessmentAttemptQuestionAnswers.$inferInsert;
export type QuizAttemptChoiceSelectionInsert =
  typeof assessmentAttemptChoiceSelections.$inferInsert;
export type QuizAttemptStatementAnswerInsert =
  typeof assessmentAttemptStatementAnswers.$inferInsert;
export type QuizAttemptBlankAnswerInsert = typeof assessmentAttemptBlankAnswers.$inferInsert;
export type QuizAttemptOpenTextAnswerInsert = typeof assessmentAttemptOpenTextAnswers.$inferInsert;
export type QuizAttemptScaleSelectionInsert = typeof assessmentAttemptScaleSelections.$inferInsert;
export type QuizAttemptDraftAnswers = AssessmentAttemptDraftAnswers;
export type QuizAttemptFinalizeUpdate = Pick<
  typeof assessmentAttempts.$inferInsert,
  "gradingStatus" | "result" | "availablePoints" | "awardedPoints" | "scorePercentage" | "gradedAt"
> & { submittedAt: string };
export type QuizAttemptMatchingAnswerInsert = typeof assessmentAttemptMatchingAnswers.$inferInsert;
