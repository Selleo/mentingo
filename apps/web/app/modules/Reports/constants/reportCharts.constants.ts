import type {
  BreakdownKind,
  BreakdownStatus,
  LearningFunnelStep,
} from "../types/reportCharts.types";

export const BREAKDOWN_KINDS: BreakdownKind[] = ["courses", "groups", "paths"];

export const MAX_BREAKDOWN_BARS = 8;

export const BREAKDOWN_STATUSES = {
  COMPLETED: "completed",
  IN_PROGRESS: "inProgress",
  NOT_STARTED: "notStarted",
} as const;

export const BREAKDOWN_STATUS_COLORS: Record<BreakdownStatus, string> = {
  [BREAKDOWN_STATUSES.COMPLETED]: "var(--primary-600)",
  [BREAKDOWN_STATUSES.IN_PROGRESS]: "var(--primary-300)",
  [BREAKDOWN_STATUSES.NOT_STARTED]: "var(--neutral-200)",
};

export const ACTIVITY_TREND_CHART_HEIGHT = 200;

export const LEARNING_FUNNEL_STEPS: LearningFunnelStep[] = [
  "learners",
  "loggedIn",
  "started",
  "completed",
];
