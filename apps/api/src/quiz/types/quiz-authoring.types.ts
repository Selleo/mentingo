import type {
  AssessmentGradingMode,
  AssessmentAttemptLimitMode,
  AssessmentQuestionType,
  AssessmentTextComparisonMode,
  SupportedLanguages,
} from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type {
  assessmentQuestionBlanks,
  assessmentQuestionBlankAnswerSets,
  assessmentQuestionChoiceOptions,
  assessmentQuestionDragAndDropOptions,
  assessmentQuestionOpenTextSettings,
  assessmentQuestionScaleOptions,
  assessmentQuestionTrueFalseStatements,
} from "src/storage/schema";

export type QuizAuthoringInput = {
  lessonId?: UUIDType;
  chapterId?: UUIDType;
  title: string;
  description?: string;
  thresholdScore: number;
  attemptsLimit: number | null;
  quizCooldownInHours: number | null;
  displayOrder?: number;
  language: SupportedLanguages;
  questions?: QuizAuthoringQuestion[];
};

export type QuizAuthoringQuestion = {
  id: UUIDType;
  questionType: AssessmentQuestionType;
  displayOrder: number;
  maximumPoints: string;
  gradingMode: AssessmentGradingMode;
  prompt: string;
  title: string;
  description: string | null;
  photoS3Key: string | null;
  options: QuizAuthoringOption[];
  trueFalseStatements: QuizAuthoringTrueFalseStatement[];
  scaleOptions: QuizAuthoringScaleOption[];
  openTextSettings: QuizAuthoringOpenTextSettings | null;
  blanks: QuizAuthoringBlank[];
  dragAndDropOptions: QuizAuthoringDragAndDropOption[];
};

export type QuizAuthoringOption = {
  id: UUIDType;
  displayOrder: number;
  isCorrect: boolean;
  label: string;
};

export type QuizAuthoringTrueFalseStatement = {
  id: UUIDType;
  displayOrder: number;
  correctValue: boolean;
  statement: string;
};

export type QuizAuthoringScaleOption = {
  id: UUIDType;
  displayOrder: number;
  scaleValue: number;
  label: string;
};

export type QuizAuthoringOpenTextSettings = {
  minimumCharacters: number | null;
  maximumCharacters: number | null;
  reviewerInstructions: string | null;
};

export type QuizAuthoringBlank = {
  id: UUIDType;
  textComparisonMode: AssessmentTextComparisonMode;
  answerSets: Array<{
    preferredAnswer: string;
    acceptedAnswers: string[];
  }>;
};

export type QuizAuthoringDragAndDropOption = {
  id: UUIDType;
  label: string;
  targetBlankId: UUIDType | null;
  displayOrder: number;
};

export type QuizLessonCreateData = {
  language: SupportedLanguages;
  lesson: {
    chapterId: UUIDType;
    type: string;
    title: string;
    description: string | null;
    thresholdScore: number;
    attemptsLimit: number | null;
    quizCooldownInHours: number | null;
    displayOrder?: number;
  };
  assessment: {
    passingScorePercentage: string;
    attemptLimitMode: AssessmentAttemptLimitMode;
    maximumAttempts: number | null;
    attemptCooldown: string | null;
    baseLanguage: SupportedLanguages;
    availableLocales: SupportedLanguages[];
  };
  questions: QuizAuthoringQuestion[];
};

export type QuizLessonUpdateData = {
  lessonId: UUIDType;
  lesson: {
    language: SupportedLanguages;
    title?: string;
    description?: string | null;
    thresholdScore?: number;
    attemptsLimit?: number | null;
    quizCooldownInHours?: number | null;
  };
  assessment: {
    passingScorePercentage?: string;
    attemptLimitMode?: AssessmentAttemptLimitMode;
    maximumAttempts?: number | null;
    attemptCooldown?: string | null;
  };
  questions?: QuizAuthoringQuestion[];
};

export type QuizAuthoringAssessment = {
  id: UUIDType;
  passingScorePercentage: string;
  attemptLimitMode: AssessmentAttemptLimitMode;
  maximumAttempts: number | null;
  attemptCooldown: string | null;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
};

export type QuizAuthoringLocalizedQuestion = Omit<
  QuizAuthoringQuestion,
  "prompt" | "title" | "description" | "scaleOptions"
> & {
  prompt: string;
  title: string;
  description: string | null;
  scaleOptions: Array<Omit<QuizAuthoringScaleOption, "label"> & { label: string }>;
};

export type QuizAuthoringLocalizedReadModel = {
  lesson: {
    id: UUIDType;
    chapterId: UUIDType;
    title: string;
    description: string | null;
    displayOrder: number | null;
  };
  assessment: QuizAuthoringAssessment;
  questions: QuizAuthoringLocalizedQuestion[];
};

export type ChoiceOptionRow = InferSelectModel<typeof assessmentQuestionChoiceOptions>;
export type TrueFalseStatementRow = InferSelectModel<typeof assessmentQuestionTrueFalseStatements>;
export type ScaleOptionRow = InferSelectModel<typeof assessmentQuestionScaleOptions>;
export type OpenTextSettingsRow = InferSelectModel<typeof assessmentQuestionOpenTextSettings>;
export type BlankRow = InferSelectModel<typeof assessmentQuestionBlanks>;
export type DragAndDropOptionRow = InferSelectModel<typeof assessmentQuestionDragAndDropOptions>;
export type BlankAnswerSetRow = InferSelectModel<typeof assessmentQuestionBlankAnswerSets>;

export type PromptImageRow = {
  questionId: UUIDType;
  reference: string;
};
