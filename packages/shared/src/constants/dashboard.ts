export const DASHBOARD_WIDGET_IDS = {
  TRAINING_COMPLETION: "training-completion",
  DEADLINE_RISKS: "deadline-risks",
  INCOMPLETE_COURSES: "incomplete-courses",
  EVENT_CALENDAR: "event-calendar",
  CONTINUE_LEARNING: "continue-learning",
  REQUIRED_COURSE: "required-course",
  COURSE_COMPLETION: "course-completion",
  CERTIFICATES: "certificates",
  AI_MENTOR_PRACTICE: "ai-mentor-practice",
} as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[keyof typeof DASHBOARD_WIDGET_IDS];

export const DASHBOARD_WIDGET_SIZES = {
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
} as const;

export type DashboardWidgetSize =
  (typeof DASHBOARD_WIDGET_SIZES)[keyof typeof DASHBOARD_WIDGET_SIZES];
