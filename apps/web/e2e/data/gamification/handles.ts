export const LEADERBOARD_HANDLES = {
  PAGE: "leaderboard-page",
  SCOPE_SELECT: "leaderboard-scope-select",
  METRIC_SELECT: "leaderboard-metric-select",
  PERIOD_SELECT: "leaderboard-period-select",
  periodOption: (period: string) => `leaderboard-period-option-${period}`,
  FROM_INPUT: "leaderboard-from-input",
  TO_INPUT: "leaderboard-to-input",
  ENTRY: "leaderboard-entry",
  NEARBY: "leaderboard-nearby",
  EMPTY: "leaderboard-empty",
  UNAVAILABLE: "leaderboard-unavailable",
  ERROR: "leaderboard-error",
  RANGE_HINT: "leaderboard-range-hint",
  SETTINGS_CARD: "leaderboard-settings-card",
  SETTINGS_ENABLED_SWITCH: "leaderboard-settings-enabled-switch",
  SETTINGS_VISIBILITY: "leaderboard-settings-visibility",
} as const;

export const GAMIFICATION_SETTINGS_HANDLES = {
  ENABLED_SWITCH: "gamification-settings-enabled-switch",
} as const;
