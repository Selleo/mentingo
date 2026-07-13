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

export const IMPLEMENTED_DASHBOARD_WIDGET_IDS = [
  DASHBOARD_WIDGET_IDS.TRAINING_COMPLETION,
  DASHBOARD_WIDGET_IDS.DEADLINE_RISKS,
  DASHBOARD_WIDGET_IDS.INCOMPLETE_COURSES,
  DASHBOARD_WIDGET_IDS.EVENT_CALENDAR,
  DASHBOARD_WIDGET_IDS.CONTINUE_LEARNING,
] satisfies DashboardWidgetId[];

export function isImplementedDashboardWidget(
  widgetId: DashboardWidgetId,
): widgetId is (typeof IMPLEMENTED_DASHBOARD_WIDGET_IDS)[number] {
  return IMPLEMENTED_DASHBOARD_WIDGET_IDS.some(
    (implementedWidgetId) => implementedWidgetId === widgetId,
  );
}

export type DashboardWidgetLayout = import("~/api/generated-api").GetLayoutResponse["data"][number];
