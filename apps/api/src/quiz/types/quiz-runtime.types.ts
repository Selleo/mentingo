import type { QuizRuntimeRepository } from "../repositories/quiz-runtime.repository";
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
  timeLimitMinutes: number | null;
  questions: QuestionBody[];
};

export type QuizTimedAttemptStart = {
  assessmentId: UUIDType;
  learnerId: UUIDType;
  language: SupportedLanguages;
  availablePoints: string;
  timeLimitMinutes: number;
};

export type QuizOpenAttempt = NonNullable<
  Awaited<ReturnType<QuizRuntimeRepository["findOpenAttemptById"]>>
>;

export type QuizTimedSubmissionOptions = {
  /** Drops answers to questions/options that no longer exist (stale draft), scoring them 0. */
  dropInvalidAnswers?: boolean;
};

export type QuizAttemptFeedback = {
  attempt: {
    id: UUIDType;
    scorePercentage: string | null;
    gradingStatus: AssessmentAttemptGradingStatus;
  };
  questionAnswers: Array<{
    id: UUIDType;
    questionId: UUIDType;
    awardedPoints: string | null;
    gradingStatus: AssessmentAnswerGradingStatus;
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
  scaleSelections: Array<{ questionAnswerId: UUIDType; selectedScaleOptionId: UUIDType }>;
  openTextAnswers: Array<{ questionAnswerId: UUIDType; submittedText: string }>;
  latestReviews: Array<{ questionAnswerId: UUIDType; explanation: string }>;
  matchingAnswers: QuizMatchingAnswer[];
};

export type QuizMatchingAnswer = {
  questionAnswerId: UUIDType;
  pairId: UUIDType;
  submittedMatch: string;
};

export type PreparedQuizAttempt = {
  assessmentId: UUIDType;
  // Questions that earned their full points.
  correctAnswerCount: number;
  learnerId: UUIDType;
  language: SupportedLanguages;
  availablePoints: string;
  awardedPoints: string | null;
  scorePercentage: string | null;
  gradingStatus: AssessmentAttemptGradingStatus;
  result: AssessmentAttemptResult;
  submittedAt: string;
  gradedAt: string | null;
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
  matchingAnswers: QuizMatchingAnswer[];
};

export type QuizSubmission = AnswerQuestionBody;

export type QuizRuntimeSubmissionResult = {
  correctAnswerCount: number;
  wrongAnswerCount: number;
  questionCount: number;
  score: number;
  passed: boolean;
  awaitingReview: boolean;
  attemptId: UUIDType;
  attemptNumber: number;
};
