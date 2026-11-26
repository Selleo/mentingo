export const STATISTICS_VIEWERS = {
  COURSE_AUTHOR: "the content creator who authored the course",
  OTHER_CONTENT_CREATOR: "a content creator who did not author the course",
  ADMIN: "an admin who did not author the course",
} as const;

export type StatisticsViewer = (typeof STATISTICS_VIEWERS)[keyof typeof STATISTICS_VIEWERS];

export const STATISTICS_ACCESS_CASES = [
  {
    viewer: STATISTICS_VIEWERS.COURSE_AUTHOR,
    expectedStatus: 200,
    expectedBody: { data: { averageScoresPerQuiz: [] } },
  },
  {
    viewer: STATISTICS_VIEWERS.OTHER_CONTENT_CREATOR,
    expectedStatus: 403,
    expectedBody: { message: "adminCourseView.errors.statisticsAccessForbidden" },
  },
  {
    viewer: STATISTICS_VIEWERS.ADMIN,
    expectedStatus: 200,
    expectedBody: { data: { averageScoresPerQuiz: [] } },
  },
];

export const QUIZZES = {
  FIRST: "First quiz",
  SECOND: "Second quiz",
} as const;

export type Quiz = (typeof QUIZZES)[keyof typeof QUIZZES];

export const QUIZ_LEARNERS = {
  GROUP_MEMBER: "enrolled group member",
  ENROLLED: "enrolled learner",
  UNENROLLED: "unenrolled learner",
  DELETED: "deleted learner",
} as const;

export type QuizLearner = (typeof QUIZ_LEARNERS)[keyof typeof QUIZ_LEARNERS];

export const QUIZ_RESULTS: Array<{ learner: QuizLearner; quiz: Quiz; quizScore: number }> = [
  { learner: QUIZ_LEARNERS.GROUP_MEMBER, quiz: QUIZZES.FIRST, quizScore: 80 },
  { learner: QUIZ_LEARNERS.GROUP_MEMBER, quiz: QUIZZES.SECOND, quizScore: 50 },
  { learner: QUIZ_LEARNERS.ENROLLED, quiz: QUIZZES.FIRST, quizScore: 100 },
  { learner: QUIZ_LEARNERS.UNENROLLED, quiz: QUIZZES.FIRST, quizScore: 20 },
  { learner: QUIZ_LEARNERS.DELETED, quiz: QUIZZES.FIRST, quizScore: 40 },
];

export const QUIZ_GROUP_FILTERS = {
  NONE: "no group filter",
  MEMBER_GROUP: "the group of one enrolled learner",
  EMPTY_GROUP: "an empty group",
} as const;

export type QuizGroupFilter = (typeof QUIZ_GROUP_FILTERS)[keyof typeof QUIZ_GROUP_FILTERS];

export const AVERAGE_QUIZ_SCORE_CASES: Array<{
  groupFilter: QuizGroupFilter;
  expectedAverages: Array<{
    quiz: Quiz;
    averageScore: number;
    finishedCount: number;
    lessonOrder: number;
  }>;
}> = [
  {
    groupFilter: QUIZ_GROUP_FILTERS.NONE,
    expectedAverages: [
      { quiz: QUIZZES.FIRST, averageScore: 90, finishedCount: 2, lessonOrder: 1 },
      { quiz: QUIZZES.SECOND, averageScore: 50, finishedCount: 1, lessonOrder: 2 },
    ],
  },
  {
    groupFilter: QUIZ_GROUP_FILTERS.MEMBER_GROUP,
    expectedAverages: [
      { quiz: QUIZZES.FIRST, averageScore: 80, finishedCount: 1, lessonOrder: 1 },
      { quiz: QUIZZES.SECOND, averageScore: 50, finishedCount: 1, lessonOrder: 2 },
    ],
  },
  {
    groupFilter: QUIZ_GROUP_FILTERS.EMPTY_GROUP,
    expectedAverages: [],
  },
];
