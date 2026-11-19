export const AI_MENTOR_PRACTICE_ID = "11111111-1111-4111-8111-111111111111";
export const AI_MENTOR_PRACTICE_THREAD_ID = "22222222-2222-4222-8222-222222222222";

export const AI_MENTOR_PRACTICE_SCENARIO =
  "I want to practice asking my manager for help with an overloaded workload.";
export const AI_MENTOR_PRACTICE_TASK_GOAL =
  "Explain the workload impact and agree on a practical next step.";
export const AI_MENTOR_PRACTICE_CRITERION_TITLE = "State the request clearly";

export const AI_MENTOR_PRACTICE_EVALUATION = {
  passed: true,
  minScore: 2,
  score: 3,
  maxScore: 3,
  percentage: 100,
  criteria: [
    {
      criterionId: "33333333-3333-4333-8333-333333333333",
      title: AI_MENTOR_PRACTICE_CRITERION_TITLE,
      awardedScore: 3,
      maxScore: 3,
      status: "met",
      learnerSafeFeedback: "You made the request clear and actionable.",
    },
  ],
  blockingErrors: [],
};

export type AiMentorPracticeSessionMock = {
  id: string;
  practiceDate: string;
  language: "en";
  title: string | null;
  aiMentorName: string | null;
  threadId: string | null;
  threadStatus: "active" | "completed" | null;
  taskGoal: string | null;
  evaluation: typeof AI_MENTOR_PRACTICE_EVALUATION | null;
  status: "queued" | "ready";
  errorCode: string | null;
};

export const READY_AI_MENTOR_PRACTICE: AiMentorPracticeSessionMock = {
  id: AI_MENTOR_PRACTICE_ID,
  practiceDate: "2026-08-07",
  language: "en",
  title: "A difficult workload conversation",
  aiMentorName: "Maya Chen",
  threadId: AI_MENTOR_PRACTICE_THREAD_ID,
  threadStatus: "active",
  taskGoal: `<p>${AI_MENTOR_PRACTICE_TASK_GOAL}</p>`,
  evaluation: null,
  status: "ready",
  errorCode: null,
};

export const QUEUED_AI_MENTOR_PRACTICE: AiMentorPracticeSessionMock = {
  ...READY_AI_MENTOR_PRACTICE,
  status: "queued",
  title: null,
  aiMentorName: null,
  threadId: null,
  threadStatus: null,
  taskGoal: null,
};
