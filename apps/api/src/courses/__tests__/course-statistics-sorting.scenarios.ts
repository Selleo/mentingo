import { LESSON_TYPES } from "@repo/shared";

export const STATISTICS_LEARNERS = {
  ANNA: "anna",
  BEN: "ben",
  CARA: "cara",
} as const;

export const STATISTICS_LESSONS = {
  ALPHA_QUIZ: "alphaQuiz",
  BRAVO_QUIZ: "bravoQuiz",
  CHARLIE_QUIZ: "charlieQuiz",
  DELTA_CONTENT: "deltaContent",
  ECHO_MENTOR: "echoMentor",
  FOXTROT_MENTOR: "foxtrotMentor",
  GOLF_MENTOR: "golfMentor",
} as const;

export const STATISTICS_ENDPOINTS = {
  STUDENTS_PROGRESS: "students-progress",
  STUDENTS_QUIZ_RESULTS: "students-quiz-results",
  STUDENTS_AI_MENTOR_RESULTS: "students-ai-mentor-results",
} as const;

export const SORT_OUTCOMES = {
  ORDERED: "ordered",
  REJECTED_BY_DATABASE: "rejected by the database",
} as const;

export type StatisticsLearner = (typeof STATISTICS_LEARNERS)[keyof typeof STATISTICS_LEARNERS];
export type StatisticsLesson = (typeof STATISTICS_LESSONS)[keyof typeof STATISTICS_LESSONS];
export type StatisticsEndpoint = (typeof STATISTICS_ENDPOINTS)[keyof typeof STATISTICS_ENDPOINTS];
export type SortOutcome = (typeof SORT_OUTCOMES)[keyof typeof SORT_OUTCOMES];

export const LEARNER_FIXTURES: Record<
  StatisticsLearner,
  { firstName: string; lastName: string; groupName: string }
> = {
  [STATISTICS_LEARNERS.ANNA]: { firstName: "Anna", lastName: "Adams", groupName: "Group C" },
  [STATISTICS_LEARNERS.BEN]: { firstName: "Ben", lastName: "Brown", groupName: "Group A" },
  [STATISTICS_LEARNERS.CARA]: { firstName: "Cara", lastName: "Clark", groupName: "Group B" },
};

export const LESSON_FIXTURES: Record<
  StatisticsLesson,
  {
    title: string;
    type: (typeof LESSON_TYPES)[keyof typeof LESSON_TYPES];
    displayOrder: number;
    thresholdScore: number | null;
  }
> = {
  [STATISTICS_LESSONS.ALPHA_QUIZ]: {
    title: "Alpha quiz",
    type: LESSON_TYPES.QUIZ,
    displayOrder: 1,
    thresholdScore: 0,
  },
  [STATISTICS_LESSONS.BRAVO_QUIZ]: {
    title: "Bravo quiz",
    type: LESSON_TYPES.QUIZ,
    displayOrder: 2,
    thresholdScore: 0,
  },
  [STATISTICS_LESSONS.CHARLIE_QUIZ]: {
    title: "Charlie quiz",
    type: LESSON_TYPES.QUIZ,
    displayOrder: 3,
    thresholdScore: 0,
  },
  [STATISTICS_LESSONS.DELTA_CONTENT]: {
    title: "Delta content",
    type: LESSON_TYPES.CONTENT,
    displayOrder: 4,
    thresholdScore: null,
  },
  [STATISTICS_LESSONS.ECHO_MENTOR]: {
    title: "Echo mentor",
    type: LESSON_TYPES.AI_MENTOR,
    displayOrder: 5,
    thresholdScore: null,
  },
  [STATISTICS_LESSONS.FOXTROT_MENTOR]: {
    title: "Foxtrot mentor",
    type: LESSON_TYPES.AI_MENTOR,
    displayOrder: 6,
    thresholdScore: null,
  },
  [STATISTICS_LESSONS.GOLF_MENTOR]: {
    title: "Golf mentor",
    type: LESSON_TYPES.AI_MENTOR,
    displayOrder: 7,
    thresholdScore: null,
  },
};

export type LessonProgressFixture = {
  learner: StatisticsLearner;
  lesson: StatisticsLesson;
  completedAt: string | null;
  updatedAt: string;
  quizScore?: number;
  attempts?: number;
  aiMentor?: { percentage: number; updatedAt: string };
};

/**
 * Each learner differs on every sortable column so that every sort field yields a distinct order:
 * - completed lessons: Anna 1, Ben 2, Cara 3
 * - last activity (latest completion): Anna 01-02, Ben 01-05, Cara 01-06
 * - last completed lesson: Anna "Charlie quiz", Ben "Echo mentor", Cara "Delta content"
 * - last attempt (latest progress update): Ben 01-05, Cara 01-06, Anna 01-07
 */
export const LESSON_PROGRESS_FIXTURES: LessonProgressFixture[] = [
  {
    learner: STATISTICS_LEARNERS.ANNA,
    lesson: STATISTICS_LESSONS.CHARLIE_QUIZ,
    completedAt: "2025-01-02T10:00:00.000Z",
    updatedAt: "2025-01-07T10:00:00.000Z",
    quizScore: 70,
    attempts: 1,
  },
  {
    learner: STATISTICS_LEARNERS.ANNA,
    lesson: STATISTICS_LESSONS.GOLF_MENTOR,
    completedAt: null,
    updatedAt: "2025-01-02T10:00:00.000Z",
    aiMentor: { percentage: 40, updatedAt: "2025-01-08T10:00:00.000Z" },
  },
  {
    learner: STATISTICS_LEARNERS.BEN,
    lesson: STATISTICS_LESSONS.ALPHA_QUIZ,
    completedAt: "2025-01-03T10:00:00.000Z",
    updatedAt: "2025-01-03T10:00:00.000Z",
    quizScore: 90,
    attempts: 3,
  },
  {
    learner: STATISTICS_LEARNERS.BEN,
    lesson: STATISTICS_LESSONS.ECHO_MENTOR,
    completedAt: "2025-01-05T10:00:00.000Z",
    updatedAt: "2025-01-05T10:00:00.000Z",
    aiMentor: { percentage: 80, updatedAt: "2025-01-05T10:00:00.000Z" },
  },
  {
    learner: STATISTICS_LEARNERS.CARA,
    lesson: STATISTICS_LESSONS.BRAVO_QUIZ,
    completedAt: "2025-01-01T10:00:00.000Z",
    updatedAt: "2025-01-01T10:00:00.000Z",
    quizScore: 50,
    attempts: 2,
  },
  {
    learner: STATISTICS_LEARNERS.CARA,
    lesson: STATISTICS_LESSONS.FOXTROT_MENTOR,
    completedAt: "2025-01-04T10:00:00.000Z",
    updatedAt: "2025-01-04T10:00:00.000Z",
    aiMentor: { percentage: 60, updatedAt: "2025-01-04T10:00:00.000Z" },
  },
  {
    learner: STATISTICS_LEARNERS.CARA,
    lesson: STATISTICS_LESSONS.DELTA_CONTENT,
    completedAt: "2025-01-06T10:00:00.000Z",
    updatedAt: "2025-01-06T10:00:00.000Z",
  },
];

export type StatisticsSortCase = {
  endpoint: StatisticsEndpoint;
  sort: string;
  outcome: SortOutcome;
  expectedLearners: StatisticsLearner[];
};

const { ANNA, BEN, CARA } = STATISTICS_LEARNERS;

export const STATISTICS_SORT_CASES: StatisticsSortCase[] = [
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_PROGRESS,
    sort: "studentName",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [ANNA, BEN, CARA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_PROGRESS,
    sort: "-studentName",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [CARA, BEN, ANNA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_PROGRESS,
    sort: "completedLessonsCount",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [ANNA, BEN, CARA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_PROGRESS,
    sort: "-completedLessonsCount",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [CARA, BEN, ANNA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_PROGRESS,
    sort: "lastActivity",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [ANNA, BEN, CARA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_PROGRESS,
    sort: "-lastActivity",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [CARA, BEN, ANNA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_PROGRESS,
    sort: "lastCompletedLessonName",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [ANNA, CARA, BEN],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_PROGRESS,
    sort: "-lastCompletedLessonName",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [BEN, CARA, ANNA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_PROGRESS,
    sort: "groupName",
    outcome: SORT_OUTCOMES.REJECTED_BY_DATABASE,
    expectedLearners: [],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_QUIZ_RESULTS,
    sort: "studentName",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [ANNA, BEN, CARA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_QUIZ_RESULTS,
    sort: "quizName",
    outcome: SORT_OUTCOMES.REJECTED_BY_DATABASE,
    expectedLearners: [],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_QUIZ_RESULTS,
    sort: "-quizName",
    outcome: SORT_OUTCOMES.REJECTED_BY_DATABASE,
    expectedLearners: [],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_QUIZ_RESULTS,
    sort: "quizScore",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [CARA, ANNA, BEN],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_QUIZ_RESULTS,
    sort: "-quizScore",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [BEN, ANNA, CARA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_QUIZ_RESULTS,
    sort: "attempts",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [ANNA, CARA, BEN],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_QUIZ_RESULTS,
    sort: "-attempts",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [BEN, CARA, ANNA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_QUIZ_RESULTS,
    sort: "lastAttempt",
    outcome: SORT_OUTCOMES.REJECTED_BY_DATABASE,
    expectedLearners: [],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_QUIZ_RESULTS,
    sort: "-lastAttempt",
    outcome: SORT_OUTCOMES.REJECTED_BY_DATABASE,
    expectedLearners: [],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_AI_MENTOR_RESULTS,
    sort: "studentName",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [ANNA, BEN, CARA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_AI_MENTOR_RESULTS,
    sort: "lessonName",
    outcome: SORT_OUTCOMES.REJECTED_BY_DATABASE,
    expectedLearners: [],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_AI_MENTOR_RESULTS,
    sort: "-lessonName",
    outcome: SORT_OUTCOMES.REJECTED_BY_DATABASE,
    expectedLearners: [],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_AI_MENTOR_RESULTS,
    sort: "score",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [ANNA, CARA, BEN],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_AI_MENTOR_RESULTS,
    sort: "-score",
    outcome: SORT_OUTCOMES.ORDERED,
    expectedLearners: [BEN, CARA, ANNA],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_AI_MENTOR_RESULTS,
    sort: "lastSession",
    outcome: SORT_OUTCOMES.REJECTED_BY_DATABASE,
    expectedLearners: [],
  },
  {
    endpoint: STATISTICS_ENDPOINTS.STUDENTS_AI_MENTOR_RESULTS,
    sort: "lastCompletedLessonName",
    outcome: SORT_OUTCOMES.REJECTED_BY_DATABASE,
    expectedLearners: [],
  },
];
