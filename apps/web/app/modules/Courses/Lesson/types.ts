export type QuizForm = {
  briefResponses: Record<string, string>;
  detailedResponses: Record<string, string>;
  singleAnswerQuestions: {
    [key: string]: Record<string, string | null>;
  };
  multiAnswerQuestions: {
    [key: string]: {
      [key: string]: string | null;
    };
  };
  photoQuestionSingleChoice: {
    [key: string]: Record<string, string | null>;
  };
  photoQuestionMultipleChoice: {
    [key: string]: {
      [key: string]: string | null;
    };
  };
  trueOrFalseQuestions: {
    [key: string]: {
      [key: string]: string | null;
    };
  };
  fillInTheBlanksText: {
    [key: string]: {
      [key: string]: string | null;
    };
  };
  fillInTheBlanksDnd: {
    [key: string]: {
      [key: string]: string | null;
    };
  };
};

export const LESSON_PROGRESS_STATUSES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  BLOCKED: "blocked",
} as const;

export type ProgressStatus =
  (typeof LESSON_PROGRESS_STATUSES)[keyof typeof LESSON_PROGRESS_STATUSES];
