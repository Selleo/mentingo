import type { LocalizedText } from "@repo/shared";

export type QuizSettings = {
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
  timeLimitMinutes?: number | null;
  passedFeedback?: LocalizedText;
  failedFeedback?: LocalizedText;
};

export type QuizAttemptState = {
  id: string;
  startedAt: string;
  expiresAt: string | null;
  status: "active" | "submitted" | "expired";
  questionOrder: string[];
  optionOrder: Record<string, string[]>;
};

export type QuizEvaluationResult = {
  correctAnswerCount: number;
  wrongAnswerCount: number;
  questionCount: number;
  score: number;
};
