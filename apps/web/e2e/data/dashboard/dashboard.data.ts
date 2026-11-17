import { DASHBOARD_WIDGET_TYPES } from "@repo/shared";

import { AI_MENTOR_PRACTICE_HANDLES } from "../ai-mentor-practice/handles";

import { DASHBOARD_WIDGET_HANDLES } from "./handles";

import type {
  DashboardDeadlineRiskType,
  DashboardLayoutWidget,
  DashboardWidgetSize,
  DashboardWidgetType,
} from "@repo/shared";

export const DASHBOARD_WIDGET_HANDLE_BY_TYPE: Record<DashboardWidgetType, string> = {
  [DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE]: AI_MENTOR_PRACTICE_HANDLES.WIDGET,
  [DASHBOARD_WIDGET_TYPES.TODO_LIST]: DASHBOARD_WIDGET_HANDLES.TODO_TASKS,
  [DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR]: DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR,
  [DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS]: DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS,
  [DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION]: DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION,
  [DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING]: DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING,
  [DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES]: DASHBOARD_WIDGET_HANDLES.STUDENT_REQUIRED_COURSE,
  [DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION]: DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION,
  [DASHBOARD_WIDGET_TYPES.CERTIFICATES]: DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES,
  [DASHBOARD_WIDGET_TYPES.GAMIFICATION]: DASHBOARD_WIDGET_HANDLES.STUDENT_GAMIFICATION,
};

export const dashboardWidget = (
  type: DashboardWidgetType,
  size: DashboardWidgetSize,
): DashboardLayoutWidget => ({ type, size, visible: true });

export const DASHBOARD_MOCK_IDS = {
  user: "66666666-6666-4666-8666-666666666666",
  continueCourse: "11111111-1111-4111-8111-111111111111",
  continueLesson: "22222222-2222-4222-8222-222222222222",
  requiredCourse: "33333333-3333-4333-8333-333333333333",
  practice: "44444444-4444-4444-8444-444444444444",
  thread: "55555555-5555-4555-8555-555555555555",
} as const;

export const deadlineRiskCourse = (
  id: string,
  title: string,
  urgency: DashboardDeadlineRiskType = "overdue",
) => ({
  id,
  title,
  thumbnailUrl: null,
  overdueCount: urgency === "overdue" ? 2 : 0,
  dueSoonCount: urgency === "dueSoon" ? 2 : 0,
  nearestDueDate: urgency === "overdue" ? "2026-08-01T00:00:00.000Z" : "2026-08-30T00:00:00.000Z",
  urgency,
});

export const deadlineRiskGroup = (
  id: string,
  name: string,
  learner: { id: string; name: string },
  urgency: DashboardDeadlineRiskType = "overdue",
) => ({
  id,
  name,
  dueDate: "2026-08-20T00:00:00.000Z",
  urgency,
  studentCount: 1,
  students: [learner],
});

export const deadlineRiskPage = <Item>(data: Item[], page: number, totalItems: number) => ({
  data,
  pagination: { totalItems, page, perPage: 20 },
});

export const learnerDashboardSummary = (overrides: Record<string, unknown> = {}) => ({
  data: {
    continueLearningCourses: [],
    requiredCourses: [],
    completion: { total: 0, completed: 0, inProgress: 0, notStarted: 0, percentage: 0 },
    ...overrides,
  },
});

export const LEARNER_SUMMARY = learnerDashboardSummary({
  continueLearningCourses: [
    {
      courseId: DASHBOARD_MOCK_IDS.continueCourse,
      slug: "customer-onboarding",
      title: "Customer onboarding",
      thumbnailUrl: null,
      completedChapterCount: 2,
      courseChapterCount: 4,
      lesson: { id: DASHBOARD_MOCK_IDS.continueLesson, title: "Prepare the call" },
    },
  ],
  requiredCourses: [
    {
      courseId: DASHBOARD_MOCK_IDS.requiredCourse,
      slug: "security-basics",
      title: "Security basics",
      thumbnailUrl: null,
      dueDate: "2026-08-01T00:00:00.000Z",
      urgency: "overdue",
    },
  ],
  completion: { total: 5, completed: 3, inProgress: 1, notStarted: 1, percentage: 60 },
});

export const MOCK_STUDENT_SESSION = {
  data: {
    id: DASHBOARD_MOCK_IDS.user,
    roleSlugs: ["student"],
    permissions: ["dashboard.read"],
    onboardingStatus: { settings: true },
  },
};

type PracticeSession = {
  id: string;
  practiceDate: string;
  language: "en";
  title: string | null;
  aiMentorName: string | null;
  threadId: string | null;
  threadStatus: "active" | "completed" | "archived" | null;
  taskGoal: string | null;
  evaluation: object | null;
  status: "queued" | "processing" | "ready" | "failed";
  errorCode: string | null;
};

export const aiPracticeSession = (overrides: Partial<PracticeSession> = {}): PracticeSession => ({
  id: DASHBOARD_MOCK_IDS.practice,
  practiceDate: "2026-08-17",
  language: "en",
  title: "A difficult workload conversation",
  aiMentorName: "Maya Chen",
  threadId: DASHBOARD_MOCK_IDS.thread,
  threadStatus: "active",
  taskGoal: "Agree on a practical next step.",
  evaluation: null,
  status: "ready",
  errorCode: null,
  ...overrides,
});

export const AI_PRACTICE_MESSAGES = {
  data: [
    {
      id: "77777777-7777-4777-8777-777777777777",
      role: "assistant",
      content: "Let us work through the workload conversation.",
      userName: "Maya Chen",
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      role: "user",
      content: "I need help prioritizing the committed work.",
      userName: null,
    },
  ],
};

export const dashboardCertificate = (id: string, courseTitle: string) => ({
  id,
  userId: DASHBOARD_MOCK_IDS.user,
  courseId: DASHBOARD_MOCK_IDS.continueCourse,
  courseTitle,
  completionDate: "2026-07-20T00:00:00.000Z",
  fullName: "Taylor Student",
  certificateSignatureUrl: null,
  certificateFontColor: null,
  issuedAt: "2026-07-20T00:00:00.000Z",
  expiresAt: null,
  createdAt: "2026-07-20T00:00:00.000Z",
});
