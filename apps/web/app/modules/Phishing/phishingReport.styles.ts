import { ACTIVITY_TYPES } from "./phishingReport.utils";

// One palette for every phishing report surface: donut, activity feed and people table.
export const PHISHING_ACTIVITY_COLORS = {
  [ACTIVITY_TYPES.CLICKED]: {
    fill: "var(--zest-300)",
    icon: "text-zest-300",
    text: "text-zest-700",
  },
  [ACTIVITY_TYPES.SUBMITTED]: {
    fill: "var(--secondary-400)",
    icon: "text-secondary-400",
    text: "text-secondary-700",
  },
} as const;

export const PHISHING_NO_ACTION_FILL = "var(--neutral-200)";
