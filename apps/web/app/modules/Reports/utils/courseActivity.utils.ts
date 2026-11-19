import { match } from "ts-pattern";

import {
  ACTIVITY_PERIOD_PRESETS,
  COURSE_ACTIVITY_CHART,
  INACTIVITY_LEVEL_THRESHOLD_DAYS,
  INACTIVITY_LEVELS,
  ROLLING_PERIOD_PRESET_DAYS,
} from "../constants/courseActivity.constants";

import { getActivityPeriodForLastDays } from "./reports.utils";

import type {
  ActivityPeriodPreset,
  InactivityLevel,
  RollingActivityPeriodPreset,
} from "../types/courseActivity.types";
import type { ReportActivityPeriod } from "../types/reports-api.types";

export const truncateCourseLabel = (label: string) =>
  label.length > COURSE_ACTIVITY_CHART.LABEL_MAX_LENGTH
    ? `${label.slice(0, COURSE_ACTIVITY_CHART.LABEL_MAX_LENGTH - 1)}…`
    : label;

export const getInactivityLevel = (inactiveDays: number): InactivityLevel =>
  match(inactiveDays)
    .when(
      (days) => days >= INACTIVITY_LEVEL_THRESHOLD_DAYS.DORMANT,
      () => INACTIVITY_LEVELS.DORMANT,
    )
    .when(
      (days) => days >= INACTIVITY_LEVEL_THRESHOLD_DAYS.STALE,
      () => INACTIVITY_LEVELS.STALE,
    )
    .otherwise(() => INACTIVITY_LEVELS.RECENT);

export const getRollingPeriod = (preset: RollingActivityPeriodPreset) =>
  getActivityPeriodForLastDays(ROLLING_PERIOD_PRESET_DAYS[preset]);

export const findPresetForPeriod = (period: ReportActivityPeriod): ActivityPeriodPreset =>
  (Object.keys(ROLLING_PERIOD_PRESET_DAYS) as RollingActivityPeriodPreset[]).find((preset) => {
    const presetPeriod = getRollingPeriod(preset);
    return presetPeriod.from === period.from && presetPeriod.to === period.to;
  }) ?? ACTIVITY_PERIOD_PRESETS.CUSTOM;
