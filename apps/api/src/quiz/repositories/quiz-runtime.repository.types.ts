import type {
  assessmentAttempts,
  assessmentAttemptQuestionAnswers,
  assessmentAttemptChoiceSelections,
  assessmentAttemptStatementAnswers,
  assessmentAttemptBlankAnswers,
  assessmentAttemptOpenTextAnswers,
  assessmentAttemptScaleSelections,
} from "src/storage/schema";

export type QuizAttemptInsert = typeof assessmentAttempts.$inferInsert;
export type QuizAttemptQuestionAnswerInsert = typeof assessmentAttemptQuestionAnswers.$inferInsert;
export type QuizAttemptChoiceSelectionInsert =
  typeof assessmentAttemptChoiceSelections.$inferInsert;
export type QuizAttemptStatementAnswerInsert =
  typeof assessmentAttemptStatementAnswers.$inferInsert;
export type QuizAttemptBlankAnswerInsert = typeof assessmentAttemptBlankAnswers.$inferInsert;
export type QuizAttemptOpenTextAnswerInsert = typeof assessmentAttemptOpenTextAnswers.$inferInsert;
export type QuizAttemptScaleSelectionInsert = typeof assessmentAttemptScaleSelections.$inferInsert;
