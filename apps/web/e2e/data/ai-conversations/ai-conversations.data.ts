export const AI_CONVERSATION_THREAD_ID = "f6731652-8121-49d6-8d1c-dfe71e8ae515";

export const AI_CONVERSATION = {
  id: AI_CONVERSATION_THREAD_ID,
  type: "practice",
  practiceSessionId: "5b02b66d-16e4-45ba-93aa-35241e4f1fd3",
  aiMentorLessonId: null,
  lessonId: null,
  courseId: null,
  courseTitle: null,
  title: "Historical interview",
  openingPreview: "Welcome to the saved interview.",
  owner: {
    id: "722f08f5-e085-43d7-a6e7-60599dd4038c",
    firstName: "Alex",
    lastName: "Learner",
    profilePictureUrl: null,
  },
  status: "archived",
  language: "en",
  createdAt: "2026-09-01T10:00:00.000Z",
  lastActivityAt: "2026-09-01T10:05:00.000Z",
};

export const AI_CONVERSATION_EVALUATION = {
  passed: true,
  score: 8,
  maxScore: 10,
  percentage: 80,
  criteria: [],
  blockingErrors: [],
};

export const AI_CONVERSATION_MESSAGES = {
  learnerAnswer: "Saved learner answer",
  mentorFeedback: "Saved mentor feedback",
};
