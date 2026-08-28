import type {
  AssessmentAnswerGradingStatus,
  AssessmentAttemptGradingStatus,
  AssessmentAttemptResult,
  SupportedLanguages,
} from "@repo/shared";
import type { UUIDType } from "src/common";
import type { AnswerQuestionBody, QuestionBody } from "src/lesson/lesson.schema";

export type QuizDelivery = {
  assessmentId: UUIDType;
  questions: QuestionBody[];
};

export type PreparedQuizAttempt = {
  assessmentId: UUIDType;
  learnerId: UUIDType;
  language: SupportedLanguages;
  availablePoints: string;
  awardedPoints: string;
  scorePercentage: string;
  gradingStatus: AssessmentAttemptGradingStatus;
  result: AssessmentAttemptResult;
  submittedAt: string;
  gradedAt: string;
  questionAnswers: Array<{
    id: UUIDType;
    questionId: UUIDType;
    gradingStatus: AssessmentAnswerGradingStatus;
    awardedPoints: string;
    submittedAt: string;
  }>;
  choiceSelections: Array<{ questionAnswerId: UUIDType; selectedOptionId: UUIDType }>;
  statementAnswers: Array<{
    questionAnswerId: UUIDType;
    statementId: UUIDType;
    submittedValue: boolean;
  }>;
  blankAnswers: Array<{
    questionAnswerId: UUIDType;
    blankId: UUIDType;
    submittedText: string | null;
    selectedDragOptionId: UUIDType | null;
  }>;
  openTextAnswers: Array<{ questionAnswerId: UUIDType; submittedText: string }>;
  scaleSelections: Array<{ questionAnswerId: UUIDType; selectedScaleOptionId: UUIDType }>;
};

export type QuizSubmission = AnswerQuestionBody;

export type QuizRuntimeSubmissionResult = {
  correctAnswerCount: number;
  wrongAnswerCount: number;
  questionCount: number;
  score: number;
  passed: boolean;
  attemptId: UUIDType;
  attemptNumber: number;
};
