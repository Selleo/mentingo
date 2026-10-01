import type { PgInsertValue, PgUpdateSetSource } from "drizzle-orm/pg-core";
import type {
  assessmentQuestions,
  assessmentQuestionScaleOptions,
  assessmentQuestionChoiceOptions,
  assessmentQuestionTrueFalseStatements,
  assessmentQuestionOpenTextSettings,
  assessmentQuestionBlanks,
  assessmentQuestionBlankAnswerSets,
  assessmentQuestionDragAndDropOptions,
} from "src/storage/schema";

export type QuizQuestionInsert = Omit<
  PgInsertValue<typeof assessmentQuestions>,
  "prompt" | "title" | "description"
> & {
  prompt: string;
  title: string;
  description: string | null;
};

export type QuizScaleOptionInsert = Omit<
  PgInsertValue<typeof assessmentQuestionScaleOptions>,
  "label"
> & {
  label: string;
};

export type QuizChoiceOptionInsert = PgInsertValue<typeof assessmentQuestionChoiceOptions>;
export type QuizTrueFalseStatementInsert = PgInsertValue<
  typeof assessmentQuestionTrueFalseStatements
>;
export type QuizOpenTextSettingsInsert = PgInsertValue<typeof assessmentQuestionOpenTextSettings>;
export type QuizBlankInsert = PgInsertValue<typeof assessmentQuestionBlanks>;
export type QuizBlankAnswerSetInsert = PgInsertValue<typeof assessmentQuestionBlankAnswerSets>;
export type QuizDragAndDropOptionInsert = PgInsertValue<
  typeof assessmentQuestionDragAndDropOptions
>;

export type QuizChoiceOptionUpdate = PgUpdateSetSource<typeof assessmentQuestionChoiceOptions>;
export type QuizTrueFalseStatementUpdate = PgUpdateSetSource<
  typeof assessmentQuestionTrueFalseStatements
>;
export type QuizDragAndDropOptionUpdate = PgUpdateSetSource<
  typeof assessmentQuestionDragAndDropOptions
>;
export type QuizBlankUpdate = PgUpdateSetSource<typeof assessmentQuestionBlanks>;
